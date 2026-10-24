// Offline render of STARBURST's generated audio (music tracks, stings, sfx) to WAV/MP3 plus loudness checks.
//   node tools/render-audio.mjs [--out tmp/audio] [--only title-music,sector1,sting-boss,sfx] [--loops 1] [--mp3]
//                               [--layers] [--check] [--no-files]
// Music + stings need Web Audio, so they are rendered by headless Chrome (OfflineAudioContext) running the exact
// modules the game uses (src/audio/*); sfx recipes are plain JS and render right here in Node.
// --check prints a table and exits 1 when a render clips (>-1 dBFS peak), contains NaN, is silent, or has a loop click.
// Also importable: `import { renderAll } from './render-audio.mjs'` returns { name: { file, stats } }.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome, chromeArgs } from './lib/browser.mjs';
import { TRACK_KEYS } from '../src/audio/tracks/index.js';
import { STING_KEYS } from '../src/audio/stings.js';
import { SFX_KEYS, renderSfx } from '../src/audio/sfx/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };

function serve() {
    const srv = http.createServer((req, res) => {
        const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
        fs.createReadStream(p).pipe(res);
    });
    return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

export function wavBuffer(int16, sr, channels = 2) {
    const data = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * channels * 2, 28);
    h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
}

const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
function sfxStats(f32, sr) {
    let peak = 0, sum = 0, bad = 0;
    for (const v of f32) { if (!Number.isFinite(v)) { bad++; continue; } peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    return { seconds: +(f32.length / sr).toFixed(2), peakDb: +db(peak).toFixed(2), rmsDb: +db(Math.sqrt(sum / f32.length)).toFixed(2), nan: bad };
}

/** opts { out, only: [names]|null, loops, mp3, layers, files = true, sr } -> { name: { file, stats } } */
export async function renderAll(opts = {}) {
    const out = opts.out || path.join(ROOT, 'tmp/audio'), files = opts.files !== false;
    const want = (name, group) => !opts.only || opts.only.includes(name) || opts.only.includes(group);
    if (files) fs.mkdirSync(out, { recursive: true });
    const result = {};
    const write = (name, int16, sr) => {
        if (!files) return null;
        const wav = path.join(out, `${name}.wav`);
        fs.writeFileSync(wav, wavBuffer(int16, sr));
        if (!opts.mp3) return wav;
        const mp3 = path.join(out, `${name}.mp3`);
        const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3]);
        return r.status === 0 ? mp3 : wav;
    };

    for (const key of SFX_KEYS.filter((k) => want(k, 'sfx'))) {
        const sr = opts.sr || 44100, f = renderSfx(key, sr);
        const i16 = new Int16Array(f.length);
        for (let i = 0; i < f.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)));
        // mono -> stereo for the file
        const st = new Int16Array(f.length * 2);
        for (let i = 0; i < f.length; i++) st[2 * i] = st[2 * i + 1] = i16[i];
        result[key] = { file: write(`sfx-${key}`, st, sr), stats: sfxStats(f, sr) };
    }

    const jobs = [...TRACK_KEYS.map((k) => ['track', k, 'music']), ...STING_KEYS.map((k) => ['sting', k, 'stings'])].filter(([, k, g]) => want(k, g));
    if (jobs.length) {
        const srv = await serve();
        const browser = await puppeteer.launch({ executablePath: findChrome(opts.chrome), headless: true, args: chromeArgs(320, 240) });
        try {
            const page = await browser.newPage();
            page.on('pageerror', (e) => console.error('page error:', e.message));
            page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()); });
            await page.goto(`http://127.0.0.1:${srv.address().port}/tools/lib/render-audio.html`);
            await page.waitForFunction('window.ready === true', { timeout: 20000 });
            for (const [kind, key] of jobs) {
                const r = await page.evaluate((k, n, o) => window.job(k, n, o), kind, key, { loops: opts.loops || 1, layers: !!opts.layers, noPcm: !files });
                const i16 = r.pcm ? new Int16Array(Uint8Array.from(Buffer.from(r.pcm, 'base64')).buffer) : null;
                r.stats.renderMs = r.ms;
                result[key] = { file: i16 ? write(key, i16, r.sr) : null, stats: r.stats };
            }
        } finally { await browser.close(); srv.close(); }
    }
    return result;
}

/** pass/fail rules for --check; returns a list of problems */
export function problems(name, s) {
    const p = [];
    if (s.nan) p.push(`${s.nan} NaN/Inf samples`);
    if (s.peakDb > -1) p.push(`peak ${s.peakDb} dBFS > -1`);
    if (s.rmsDb < -40) p.push(`rms ${s.rmsDb} dBFS: silent?`);
    if (s.seamDiffDb !== undefined && s.seamDiffDb > -80) p.push(`loop seam: wrap differs from the continuing signal by ${s.seamDiffDb} dBFS`);
    if (s.loopMismatchDb !== undefined && s.loopMismatchDb > -60) p.push(`loop not periodic (pass-to-pass difference ${s.loopMismatchDb} dB)`);
    return p;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const argv = process.argv.slice(2), get = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; }, has = (n) => argv.includes(n);
    const t0 = Date.now();
    const res = await renderAll({
        out: get('--out', null), only: get('--only', null)?.split(','), loops: Number(get('--loops', 1)), mp3: has('--mp3'),
        layers: has('--layers'), files: !has('--no-files'), chrome: get('--chrome', undefined)
    });
    let bad = 0;
    for (const [name, { stats: s }] of Object.entries(res)) {
        const pr = problems(name, s);
        console.log(`${name.padEnd(18)} ${String(s.seconds).padStart(6)}s  peak ${String(s.peakDb).padStart(6)}  rms ${String(s.rmsDb).padStart(6)} dBFS`
            + (s.rawPeakDb !== undefined ? `  pre-limiter ${s.rawPeakDb}` : '') + (s.seamDiffDb !== undefined ? `  seam ${s.seamDiffDb} dBFS  loop-diff ${s.loopMismatchDb} dB` : '')
            + (s.layers ? '  layers ' + Object.entries(s.layers).map(([k, v]) => `${k} ${v.rmsDb}`).join(' / ') : '')
            + (s.renderMs ? `  [${s.renderMs}ms]` : '') + (pr.length ? `  !! ${pr.join('; ')}` : ''));
        bad += pr.length;
    }
    console.log(`${Object.keys(res).length} renders in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${get('--out', 'tmp/audio')}`);
    if (has('--check') && bad) process.exit(1);
}
