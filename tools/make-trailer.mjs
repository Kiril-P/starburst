// Builds the launch trailer, captioned stills and social GIFs from REAL gameplay (npm run trailer). Needs Chrome + ffmpeg.
//   node tools/make-trailer.mjs [--skip-capture] [--only trailer|stills|gifs] [--music-start 0] [--track boss]
// 1. capture: tools/make-gif.mjs --frames records each clip frame-exact and deterministic (autopilot, god mode) at 30 fps.
// 2. compose: every output frame is a 1920x1080 screenshot of an HTML page: the 640x360 frame at exactly 3x (nearest
//    neighbour, so pixels stay square) plus pixel-font captions in the game's own fonts. Hard cuts, integer-pixel shake.
// 3. encode: ffmpeg with the game's own generated music + a few sfx, rendered offline by tools/render-audio.mjs (no audio
//    files exist in the repo; docs/AUDIO.md). Everything lands in marketing/ (git-ignored).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { findChrome } from './lib/browser.mjs';
import { renderAll } from './render-audio.mjs';
import { loopSeconds } from '../src/audio/sequencer.js';
import { TRACKS } from '../src/audio/tracks/index.js';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const only = get('--only', '');
const musicStart = parseFloat(get('--music-start', '0'));   // seconds into the rendered loop(s)
const track = get('--track', 'boss');                       // any key from src/audio/tracks (docs/AUDIO.md)
const FPS = 30;
const OUT = 'marketing', WORK = `${OUT}/work`;
fs.mkdirSync(WORK, { recursive: true });

// ---- clips to record (id, make-gif args, length in seconds) ------------------------------------------------------------
const CLIPS = [
    { id: 'boss1',  args: ['--boss', '--warmup', '9'], seconds: 4, seed: 11 },
    { id: 'wave3',  args: ['--wave', '4', '--warmup', '9'], seconds: 4, seed: 5 },
    { id: 'wave8',  args: ['--wave', '7', '--warmup', '10'], seconds: 4, seed: 7 },
    { id: 'gear',   args: ['--wave', '14', '--warmup', '10', '--eval', "__dbg.weapon('spread',3);__dbg.weapon('missiles',2);__dbg.buff('rapid')"], seconds: 4, seed: 3 },
    { id: 'sec3',   args: ['--wave', '17', '--warmup', '9'], seconds: 4, seed: 9 },
    { id: 'boss2',  args: ['--eval', "__dbg.fight('hive')", '--wave', '10', '--warmup', '10'], seconds: 5, seed: 21 },
    { id: 'boss3',  args: ['--boss', '--wave', '15', '--warmup', '10', '--eval', "__dbg.boss(3)"], seconds: 4, seed: 13 }
];

// ---- timeline (seconds). clip = frames from CLIPS, at = start offset inside the clip --------------------------------------
const T = [
    { kind: 'clip', clip: 'boss1', at: 1.0, dur: 2.2, caption: 'ONE SHIP.|A THOUSAND BULLETS.', cap: 'bottom' },
    { kind: 'logo', clip: 'boss1', at: 3.0, dur: 2.2, sub: 'A NEON BULLET HELL', sfx: 'player-death' },
    { kind: 'clip', clip: 'wave3', at: 0.5, dur: 3.2, caption: 'GRAZE DEATH. BUILD THE COMBO.', cap: 'bottom' },
    { kind: 'clip', clip: 'wave8', at: 0.5, dur: 3.2, caption: '20 WAVES. EVERY ONE DIFFERENT.', cap: 'bottom' },
    { kind: 'clip', clip: 'gear', at: 0.5, dur: 3.4, caption: 'FIND WEAPONS. BREAK THE GAME.', cap: 'bottom' },
    { kind: 'clip', clip: 'boss2', at: 1.0, dur: 3.4, caption: 'BOSSES THAT FIGHT BACK.', cap: 'bottom' },
    { kind: 'clip', clip: 'sec3', at: 0.3, dur: 0.9, caption: '' },
    { kind: 'clip', clip: 'boss3', at: 0.3, dur: 0.9, caption: '' },
    { kind: 'clip', clip: 'wave8', at: 2.4, dur: 0.9, caption: '' },
    { kind: 'clip', clip: 'boss2', at: 3.2, dur: 0.9, caption: '' },
    { kind: 'end', clip: 'boss1', at: 3.4, dur: 3.4, sfx: 'wave-complete' }
];

// ---- 1. capture ----------------------------------------------------------------------------------------------------------
if (!a.includes('--skip-capture')) {
    for (const c of CLIPS) {
        const dir = `${WORK}/clips/${c.id}`;
        console.log(`capture ${c.id}`);
        const r = spawnSync('node', ['tools/make-gif.mjs', '--frames', dir, '--seconds', String(c.seconds), '--fps', String(FPS), '--seed', String(c.seed), ...c.args], { stdio: 'inherit' });
        if (r.status !== 0) { console.error(`capture failed: ${c.id}`); process.exit(1); }
    }
}

// ---- tiny static server (page, fonts, frames) ------------------------------------------------------------------------------
const FONTS = { '/f/press.woff2': 'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2', '/f/silk.woff2': 'node_modules/@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2' };
const PAGE = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:P;src:url(/f/press.woff2)} @font-face{font-family:S;src:url(/f/silk.woff2)}
html,body{margin:0;background:#000;overflow:hidden} #root{position:relative;width:1920px;height:1080px;overflow:hidden;background:#070b1a}
#g{position:absolute;left:0;top:0;width:1920px;height:1080px;image-rendering:pixelated}
#dim{position:absolute;inset:0;background:#070b1a}
#scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px);pointer-events:none}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 58%,rgba(3,5,16,.72) 100%);pointer-events:none}
#flash{position:absolute;inset:0;background:#fff;opacity:0}
.t{position:absolute;left:0;width:1920px;text-align:center;font-family:P;white-space:pre;color:#f4faff}
#cap{font-size:42px;line-height:66px;bottom:96px;text-shadow:6px 6px 0 #0a0d1f}
#cap b{font-weight:400;color:#39e7ff} #bar{position:absolute;left:0;width:1920px;height:0;bottom:60px;background:linear-gradient(0deg,rgba(7,11,26,.88),rgba(7,11,26,0))}
#logoC{font-size:150px;top:330px;color:#39e7ff;text-shadow:9px 9px 0 #ff43c8,18px 18px 0 #0a0d1f} 
#sub{font-family:S;font-size:48px;top:560px;color:#ffc94a;text-shadow:6px 6px 0 #0a0d1f;letter-spacing:6px}
#cta{font-family:P;font-size:36px;top:700px;color:#c8ff5a;text-shadow:6px 6px 0 #0a0d1f}
#url{font-family:S;font-size:56px;top:790px;color:#f4faff;text-shadow:6px 6px 0 #0a0d1f}
#tag{font-family:S;font-size:40px;top:960px;color:#8fa6d8;letter-spacing:4px}
</style><div id=root><img id=g><div id=dim></div><div id=bar></div><div id=scan></div><div id=vig></div>
<div class=t id=cap></div><div class=t id=logoC></div><div class=t id=sub></div><div class=t id=cta></div><div class=t id=url></div><div class=t id=tag></div><div id=flash></div></div>
<script>
const $=(i)=>document.getElementById(i);
const ease=(x)=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
window.setFrame=(src)=>new Promise((r)=>{const g=$('g');g.onload=r;g.src=src;});
window.draw=(s,t)=>{
  // s = shot, t = seconds into the shot
  const g=$('g'),root=$('root');
  const sh=(amp)=>[(Math.round(Math.sin(t*95)*amp))*3,(Math.round(Math.cos(t*83)*amp))*3];
  let [dx,dy]=[0,0];
  for(const id of ['cap','logoC','sub','cta','url','tag','flash','dim','bar'])$(id).style.cssText='';
  $('cap').innerHTML='';['logoC','sub','cta','url','tag'].forEach(id=>$(id).textContent='');
  $('dim').style.opacity=s.kind==='clip'?0:(s.kind==='end'?.8:.55);
  $('bar').style.height=s.kind==='clip'&&s.caption?'360px':'0';$('bar').style.opacity=s.kind==='clip'&&s.caption?Math.min(1,t*4):0;
  // cut flash on every shot start
  $('flash').style.opacity=Math.max(0,.55-t*5);
  if(s.kind==='clip'&&s.caption){
    const lines=s.caption.split('|'),total=lines.join('').length;let shown=Math.floor(t*40),out=[];
    for(const l of lines){out.push(l.slice(0,Math.max(0,shown)));shown-=l.length;}
    $('cap').innerHTML=out.join('\\n').replace(/\\n$/,'');
    const fade=Math.min(1,Math.max(0,(s.dur-t)*8));$('cap').style.opacity=fade;
  }
  if(s.kind==='logo'||s.kind==='end'){
    const k=ease(t/.28);[dx,dy]=t<.4?sh(1.2*(1-t/.4)+.01):[0,0];
    const el=$('logoC');el.textContent='STARBURST';el.style.opacity=Math.min(1,t*14);
    el.style.transform='translate('+dx+'px,'+(dy+Math.round((1-k)*-60/3)*3)+'px) scale('+(1+(1-k)*.35)+')';
    if(s.kind==='logo'){$('sub').textContent='A NEON BULLET HELL'.slice(0,Math.max(0,Math.floor((t-.5)*28)));$('sub').style.opacity=t>.5?1:0;}
    if(s.kind==='end'){
      $('logoC').style.top='250px';
      if(t>.5){$('cta').textContent='PLAY FREE IN YOUR BROWSER';$('cta').style.opacity=ease((t-.5)/.4);}
      if(t>1.1){$('url').textContent='kirilp.itch.io/starburst';$('url').style.opacity=ease((t-1.1)/.4);}
      if(t>1.8){$('tag').textContent='MADE FOR BULLET HELL JAM 6';$('tag').style.opacity=ease((t-1.8)/.4);}
      $('dim').style.opacity=.8;
    }
  }
  g.style.transform='translate('+dx+'px,'+dy+'px)';
  // fade to black at the very end of the final shot
  if(s.kind==='end'){const f=Math.min(1,Math.max(0,(s.dur-t)/.7));root.style.opacity=f;}else root.style.opacity=1;
};
</script>`;
const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') { res.setHeader('content-type', 'text/html'); return res.end(PAGE); }
    const file = FONTS[u] || (u.startsWith('/w/') ? path.join(WORK, u.slice(3)) : null);
    if (!file || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', file.endsWith('.png') ? 'image/png' : 'font/woff2');
    fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: findChrome(get('--chrome')), headless: 'new', args: ['--window-size=1920,1080', '--force-device-scale-factor=1'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(base, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const frameUrl = (clip, i) => `${base}/w/clips/${clip}/${String(i).padStart(4, '0')}.png`;
const clipLen = (clip) => fs.readdirSync(`${WORK}/clips/${clip}`).length;
async function render(shot, t, dir, n, withText = true) {
    const i = Math.min(clipLen(shot.clip) - 1, Math.round((shot.at + t) * FPS));
    await page.evaluate((u) => window.setFrame(u), frameUrl(shot.clip, i));
    await page.evaluate((s, t, w) => window.draw(w ? s : { ...s, kind: 'clip', caption: '' }, t), shot, t, withText);
    await page.screenshot({ path: path.join(dir, `${String(n).padStart(5, '0')}.png`), type: 'png' });
}

// ---- 2. trailer frames -----------------------------------------------------------------------------------------------------
if (!only || only === 'trailer') {
    const dir = `${WORK}/out`;
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    let n = 0, clock = 0;
    const sfx = [];
    for (const s of T) {
        if (s.sfx) sfx.push({ f: s.sfx, at: clock });
        else if (s.kind === 'clip' && s.dur < 1.2) sfx.push({ f: 'enemy-death', at: clock });
        const frames = Math.round(s.dur * FPS);
        for (let f = 0; f < frames; f++) await render(s, f / FPS, dir, n++);
        clock += frames / FPS;
        process.stdout.write(`trailer ${clock.toFixed(1)}s\r`);
    }
    const total = n / FPS;
    // generated audio: enough passes of the track to cover the trailer, plus the sfx it uses
    const need = Math.ceil((total + musicStart) / loopSeconds(TRACKS[track]));
    const audio = await renderAll({ out: `${WORK}/audio`, only: [track, ...new Set(sfx.map((x) => x.f))], loops: need });
    const inputs = ['-framerate', String(FPS), '-i', `${dir}/%05d.png`, '-ss', String(musicStart), '-i', audio[track].file];
    let filter = `[1:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=0.8,afade=t=in:d=0.4,afade=t=out:st=${(total - 1.6).toFixed(2)}:d=1.6[m]`;
    const mix = ['[m]'];
    sfx.forEach((x, k) => {
        inputs.push('-i', audio[x.f].file);
        const ms = Math.round(x.at * 1000);
        filter += `;[${k + 2}:a]adelay=${ms}|${ms},volume=${x.f === 'enemy-death' ? 0.5 : 1}[s${k}]`;
        mix.push(`[s${k}]`);
    });
    filter += `;${mix.join('')}amix=inputs=${mix.length}:normalize=0,alimiter=limit=0.95[aout]`;
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-t', String(total),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${OUT}/starburst-trailer.mp4`], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(1);
    console.log(`\nwrote ${OUT}/starburst-trailer.mp4 (${total.toFixed(1)}s)`);
}

// ---- 3. stills (raw 3x frames plus captioned versions) ------------------------------------------------------------------------
if (!only || only === 'stills') {
    const dir = `${OUT}/stills`;
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const shots = [
        { name: 'boss-warden', clip: 'boss1', at: 2.2, caption: 'BOSSES THAT FIGHT BACK.' },
        { name: 'swarm-sector1', clip: 'wave3', at: 2.0, caption: 'GRAZE DEATH. BUILD THE COMBO.' },
        { name: 'arsenal', clip: 'gear', at: 2.0, caption: 'FIND WEAPONS. BREAK THE GAME.' },
        { name: 'sector-three', clip: 'sec3', at: 2.0, caption: '20 WAVES. EVERY ONE DIFFERENT.' },
        { name: 'boss-hive', clip: 'boss2', at: 2.6, caption: 'ONE SHIP.|A THOUSAND BULLETS.' },
        { name: 'boss-prism', clip: 'boss3', at: 2.4, caption: 'DODGE. DASH. SURVIVE.' }
    ];
    for (const s of shots) {
        const sh = { kind: 'clip', clip: s.clip, at: s.at, dur: 99, caption: s.caption };
        await render(sh, 2, dir, 0, true); fs.renameSync(`${dir}/00000.png`, `${dir}/${s.name}-caption.png`);
        await render(sh, 2, dir, 0, false); fs.renameSync(`${dir}/00000.png`, `${dir}/${s.name}.png`);
    }
    console.log(`wrote ${shots.length * 2} stills to ${dir}`);
}
await browser.close();
server.close();

// ---- 4. GIFs for reddit / twitter (≤ ~8 MB each; 960x540, 15 fps, nearest-neighbour 1.5x is not pixel-perfect so use 2x of 640) ----------
if (!only || only === 'gifs') {
    fs.mkdirSync(`${OUT}/gifs`, { recursive: true });
    const gifs = [
        { name: 'boss-hive', clip: 'boss2', at: 0.8, secs: 4 },
        { name: 'swarm', clip: 'wave8', at: 0.3, secs: 3.5 },
        { name: 'arsenal', clip: 'gear', at: 0.3, secs: 3.5 },
        { name: 'sector3', clip: 'sec3', at: 0.3, secs: 3.5 }
    ];
    for (const g of gifs) {
        const src = `${WORK}/clips/${g.clip}/%04d.png`, pal = `${WORK}/pal.png`, out = `${OUT}/gifs/${g.name}.gif`;
        const base = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(Math.round(g.at * FPS)), '-i', src, '-t', String(g.secs)];
        const vf = `fps=15,scale=1280:720:flags=neighbor`;
        spawnSync('ffmpeg', [...base, '-vf', `${vf},palettegen=max_colors=128:stats_mode=diff`, pal], { stdio: 'inherit' });
        spawnSync('ffmpeg', [...base, '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', out], { stdio: 'inherit' });
        console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
    }
}
