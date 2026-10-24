// Records a gameplay GIF for the README / itch page (npm run gif). Needs ffmpeg on PATH.
//   node tools/make-gif.mjs [--out docs/media/gameplay.gif] [--seconds 6] [--fps 20] [--wave 7] [--boss] [--warmup 6] [--seed 7] [--scale 1]
// Frame-exact and deterministic: starts its own Vite dev server, seeds Math.random, stops Phaser's RAF loop and advances
// the game by exactly 1000/fps ms per frame with game.step(), grabbing the 640x360 canvas right after each render. So
// the GIF plays at true speed however slow headless SwiftShader is. A tiny autopilot flies the ship (dodges the nearest
// bullets, weaves, slides under the nearest enemy, holds fire) with god mode on, so the clip never ends early.
// GIF encoding: ffmpeg palettegen (stats_mode=diff favours moving pixels) + paletteuse without dithering (pixel art).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { findChrome, chromeArgs, seedRandom } from './lib/browser.mjs';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const out = get('--out', 'docs/media/gameplay.gif');
const seconds = parseFloat(get('--seconds', '6'));
const fps = parseInt(get('--fps', '20'), 10);
const wave = parseInt(get('--wave', '7'), 10);
const scale = parseInt(get('--scale', '1'), 10);
const seed = parseInt(get('--seed', '7'), 10);
const boss = a.includes('--boss');
const keepFrames = get('--frames', '');   // copy raw 640x360 PNG frames here and skip the GIF (used by tools/make-trailer.mjs)
const warmup = parseFloat(get('--warmup', '6'));   // seconds of real play before recording, so the wave has filled up

if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg not found on PATH (brew install ffmpeg / apt install ffmpeg)'); process.exit(1); }
const work = 'tmp/gif';
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(path.join(work, 'frames'), { recursive: true });

const server = await createServer({ logLevel: 'error', server: { port: 5320, strictPort: false } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: findChrome(get('--chrome')), headless: 'new', args: chromeArgs(1280, 720) });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.evaluateOnNewDocument(seedRandom, seed, true);
await page.goto(server.resolvedUrls.local[0] + '?scene=Game', { waitUntil: 'load' });
await page.waitForFunction(() => window.__dbg && __dbg.scene.player, { timeout: 20000 });

// set the scene up in real time, then freeze the loop and step it by hand
await page.evaluate((w, b) => {
    __dbg.godMode(true);
    __dbg.unlockAll();
    if (b) __dbg.boss(1); else __dbg.skipToWave(w);
}, wave, boss);
await new Promise((r) => setTimeout(r, warmup * 1000));
await page.evaluate(() => {
    const g = __game;
    g.loop.sleep();
    window.__clock = performance.now();
    // autopilot: steer away from bullets inside 48px, otherwise weave toward a wandering point; always fire
    window.__pilot = (frame) => {
        const sc = __dbg.scene, p = sc.player, held = p.input.held;
        held.clear();
        held.add('Space');
        let fx = 0, fy = 0;
        for (const b of sc.enemyBullets.live) {
            if (!b.alive) continue;
            const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
            if (d2 < 48 * 48 && d2 > 0) { const k = 1 / d2; fx += dx * k; fy += dy * k; }
        }
        // the ship only fires straight up, so slide under the nearest enemy ahead (blended with a weave) to keep landing hits
        let tx = 320 + Math.sin(frame / 45) * 170;
        const ty = 270 + Math.sin(frame / 31) * 40;
        let best = null, bd = Infinity;
        for (const e of [...sc.waves.live, ...sc.bosses.targets]) {
            if (!e.alive || e.y > p.y - 20) continue;
            const d = Math.abs(e.x - p.x) + (p.y - e.y) * 0.3;
            if (d < bd) { bd = d; best = e; }
        }
        if (best) tx = best.x * 0.75 + tx * 0.25;
        fx += (tx - p.x) * 0.00012; fy += (ty - p.y) * 0.00012;
        if (fx < -0.002) held.add('ArrowLeft'); else if (fx > 0.002) held.add('ArrowRight');
        if (fy < -0.002) held.add('ArrowUp'); else if (fy > 0.002) held.add('ArrowDown');
        if (frame % 90 === 45) p.queued.dash = true;
        if (frame === 70) p.queued.forcefield = true;
    };
});

const total = Math.round(seconds * fps), dt = 1000 / fps;
for (let i = 0; i < total; i++) {
    const data = await page.evaluate((i, dt) => {
        window.__pilot(i);
        window.__clock += dt;
        // what TimeStep.step would have set: HUD tweens / blinks read loop.time and loop.delta
        const loop = __game.loop;
        loop.time = window.__clock; loop.delta = loop.rawDelta = dt; loop.frame++;
        __game.step(window.__clock, dt);
        return __game.canvas.toDataURL('image/png');
    }, i, dt);
    fs.writeFileSync(path.join(work, 'frames', `${String(i).padStart(4, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
    if (i % 25 === 0) process.stdout.write(`frame ${i}/${total}\r`);
}
await browser.close();
await server.close();

if (keepFrames) {
    fs.rmSync(keepFrames, { recursive: true, force: true });
    fs.cpSync(path.join(work, 'frames'), keepFrames, { recursive: true });
    console.log(`\nwrote ${total} frames to ${keepFrames}`);
    process.exit(0);
}
const sc = scale > 1 ? `,scale=iw*${scale}:ih*${scale}:flags=neighbor` : '';
const frames = path.join(work, 'frames', '%04d.png');
const pal = path.join(work, 'palette.png');
const run = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status !== 0) process.exit(1); };
run(['-framerate', String(fps), '-i', frames, '-vf', `fps=${fps}${sc},palettegen=max_colors=256:stats_mode=diff`, pal]);
run(['-framerate', String(fps), '-i', frames, '-i', pal, '-lavfi', `fps=${fps}${sc}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, '-loop', '0', out]);
console.log(`\nwrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB, ${total} frames @ ${fps} fps)`);
