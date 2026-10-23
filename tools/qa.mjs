// Headless QA smoke + leak test (dev server must be up). Drives every screen, screenshots each step into --out,
// and loops play -> die -> retry/menu to check that object / listener / texture counts don't grow.
//   node tools/qa.mjs --url http://localhost:5173 [--out tmp/qa-run] [--loops 4] [--size 1280x720]
// Prints page errors, failed requests (4xx/5xx) and a per-loop stats table. Exit code 1 if anything looks wrong.
// Uses the dev-only window.__game / window.__dbg hooks, so run it against `vite`, not a production build.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const base = get('--url', 'http://localhost:5173').replace(/\/$/, '');
const outDir = get('--out', 'tmp/qa-run');
const loops = parseInt(get('--loops', '4'), 10);
const [vw, vh] = get('--size', '1280x720').split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${vw},${vh}`]
});
const page = await browser.newPage();
await page.setViewport({ width: vw, height: vh });
const problems = [];
page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (k, hold = 60) => { await page.keyboard.down(k); await sleep(hold); await page.keyboard.up(k); };
const shot = (f) => page.screenshot({ path: path.join(outDir, f) });
const ev = (fn) => page.evaluate(fn);
const active = () => ev(() => __game.scene.getScenes(true).map((s) => s.sys.settings.key).filter((k) => k !== 'SysOverlay'));
const expect = async (scene, step) => { const s = await active(); if (!s.includes(scene)) problems.push(`${step}: expected ${scene}, active = ${s.join(',')}`); };
const stats = () => ev(() => {
    const g = __game, n = (e) => e.eventNames().reduce((t, k) => t + e.listenerCount(k), 0);
    const out = { textures: Object.keys(g.textures.list).length, sounds: g.sound.sounds.length, gameEvents: n(g.events) };
    for (const s of g.scene.getScenes(true)) {
        const k = s.sys.settings.key;
        if (k === 'SysOverlay') continue;
        Object.assign(out, { scene: k, children: s.children.list.length, tweens: s.tweens.getTweens().length, sceneEvents: n(s.events), keyListeners: n(s.input.keyboard) });
    }
    out.heapMB = Math.round(performance.memory.usedJSHeapSize / 1e6);
    return out;
});

await page.evaluateOnNewDocument(() => localStorage.clear());
await page.goto(base + '/', { waitUntil: 'load' });
await sleep(3500);
await expect('MainMenu', 'boot'); await shot('01-menu.png');
await key('ArrowRight'); await sleep(400); await shot('02-ship-select.png'); await key('ArrowLeft');
for (const [i, name] of [[1, 'quests'], [2, 'settings'], [3, 'difficulty']]) {
    for (let j = 0; j < i; j++) await key('ArrowDown');
    await key('Enter'); await sleep(700); await shot(`03-${name}.png`);
    await key('Escape'); await sleep(600);
    for (let j = 0; j < i; j++) await key('ArrowUp');
}
await expect('MainMenu', 'after panels');

const rows = [];
for (let i = 0; i < loops; i++) {
    await key('Enter'); await sleep(3200);
    await expect('Game', `loop ${i} start`);
    if (i === 0) {
        await shot('10-game.png');
        await ev(() => { __dbg.godMode(true); __dbg.spray(300); }); await sleep(800); await shot('11-dense.png');
        await key('Escape'); await sleep(400); await shot('12-pause.png'); await key('Escape'); await sleep(300);
        await ev(() => { __dbg.killAll(); __dbg.scene.combat.cancelBullets(false); __dbg.scene.waves.timeLeft = 10; }); await sleep(3500);
        await shot('13-upgrade.png'); await key('Enter'); await sleep(1200);
        await ev(() => __dbg.godMode(false));
    }
    rows.push({ step: `game ${i}`, ...(await stats()) });
    await ev(() => { __dbg.scene.player.invuln = 0; __dbg.hurt(9999); });
    await sleep(4800);
    await expect('GameOver', `loop ${i} death`);
    if (i === 0) await shot('14-gameover.png');
    rows.push({ step: `over ${i}`, ...(await stats()) });
    if (i % 2 === 0) {   // RETRY, then quit to menu from the pause menu (QUIT needs a second press)
        await key('Enter'); await sleep(2500); await expect('Game', `loop ${i} retry`);
        await key('Escape'); await sleep(400); await key('ArrowDown'); await key('Enter'); await sleep(200); await key('Enter'); await sleep(2500);
    } else {             // MAIN MENU button
        await key('ArrowDown'); await sleep(150); await key('Enter'); await sleep(2500);
    }
    await expect('MainMenu', `loop ${i} back to menu`);
    rows.push({ step: `menu ${i}`, ...(await stats()) });
}
console.table(rows);
// same step type in later loops must not have more children / listeners than in loop 1 (loop 0 includes the upgrade)
for (const kind of ['game', 'over', 'menu']) {
    const r = rows.filter((x) => x.step.startsWith(kind)).slice(1);
    for (const f of ['children', 'sceneEvents', 'keyListeners', 'gameEvents', 'textures', 'tweens']) {
        const v = r.map((x) => x[f]);
        if (Math.max(...v) - Math.min(...v) > (f === 'children' ? 10 : 0)) problems.push(`${kind}: ${f} drifts across loops: ${v.join(' -> ')}`);
    }
}
await browser.close();
if (problems.length) { console.log('--- problems ---\n' + [...new Set(problems)].join('\n')); process.exit(1); }
console.log(`OK: no errors, no growth. Screenshots in ${outDir}/`);
