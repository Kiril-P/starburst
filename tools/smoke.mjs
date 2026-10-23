// Deterministic headless smoke test (npm run test:smoke). Starts its own Vite dev server, seeds Math.random, then walks
// the critical path with real key presses and the dev-only __dbg hooks, waiting on *conditions* (not fixed sleeps) so it
// passes the same way on a fast laptop and a slow CI runner:
//   boot -> menu nav (quests / settings / controls rebinding / difficulty) -> start -> fire -> wave clear + upgrade ->
//   wave 2 -> boss spawn -> 300-bullet stress -> pause/resume -> death -> GameOver -> retry -> quit to menu
// Any page error, console.error or HTTP >= 400 fails the run.
//   node tools/smoke.mjs [--url http://localhost:5173] [--prod] [--out tmp/smoke] [--size 1280x720] [--chrome PATH]
//   --url   use an already running dev server instead of starting one
//   --prod  also build (vite build) and check the production bundle boots cleanly and registers its service worker
// Chrome: --chrome, $CHROME_PATH, or the usual macOS / Linux install paths.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer, preview } from 'vite';
import { findChrome, chromeArgs, seedRandom } from './lib/browser.mjs';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const outDir = get('--out', 'tmp/smoke');
const [vw, vh] = get('--size', '1280x720').split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
let base = get('--url', '');
if (!base) {
    server = await createServer({ logLevel: 'error', server: { port: 5300, strictPort: false } });
    await server.listen();
    base = server.resolvedUrls.local[0];
}
base = base.replace(/\/$/, '');

const browser = await puppeteer.launch({ executablePath: findChrome(get('--chrome')), headless: 'new', args: chromeArgs(vw, vh) });

/** new page with error capture; returns { page, errors } */
async function open(url, { seed = 1337, clear = true } = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: vw, height: vh });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.evaluateOnNewDocument(seedRandom, seed, clear);
    await page.goto(url, { waitUntil: 'load' });
    return { page, errors };
}

const { page, errors } = await open(base + '/');
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const key = async (k, hold = 50) => { await page.keyboard.down(k); await sleep(hold); await page.keyboard.up(k); await sleep(60); };
const scenes = () => ev(() => window.__game ? __game.scene.getScenes(true).map((s) => s.sys.settings.key).filter((k) => k !== 'SysOverlay') : []);

/** poll fn (in page) until truthy or timeout; returns the value or throws */
async function until(fn, what, ms = 8000, arg) {
    const t0 = Date.now();
    for (;;) {
        let v;
        try { v = await page.evaluate(fn, arg); } catch (e) { v = null; }
        if (v) return v;
        if (Date.now() - t0 > ms) throw new Error(`timeout (${ms}ms) waiting for ${what}; scenes = ${(await scenes()).join(',')}`);
        await sleep(100);
    }
}
const inScene = (k, ms) => until((s) => window.__game && __game.scene.isActive(s), `scene ${k}`, ms, k);
const gone = (k, ms) => until((s) => window.__game && !__game.scene.isActive(s), `scene ${k} to close`, ms, k);

async function step(name, fn) {
    const t0 = Date.now();
    const before = errors.length;
    try {
        await fn();
        if (errors.length > before) throw new Error(errors.slice(before).join(' | '));
        results.push({ step: name, ok: 'PASS', ms: Date.now() - t0 });
    } catch (e) {
        results.push({ step: name, ok: 'FAIL', ms: Date.now() - t0, why: e.message.slice(0, 160) });
        problems.push(`${name}: ${e.message}`);
        await page.screenshot({ path: path.join(outDir, `fail-${name.replace(/\W+/g, '-')}.png`) }).catch(() => {});
    }
}

// menu rows: START 0, QUESTS 1, SETTINGS 2, DIFFICULTY 3
async function openMenuItem(i, sceneKey) {
    for (let j = 0; j < i; j++) await key('ArrowDown');
    await key('Enter');
    await inScene(sceneKey);
}
async function closePanel(sceneKey, upBy) {
    await key('Escape');
    await gone(sceneKey);
    await sleep(150);
    for (let j = 0; j < upBy; j++) await key('ArrowUp');
}

await step('boot to main menu', async () => { await inScene('MainMenu', 15000); await sleep(800); await page.screenshot({ path: path.join(outDir, '01-menu.png') }); });
await step('quests panel', async () => { await openMenuItem(1, 'MenuQuests'); await closePanel('MenuQuests', 1); });
await step('difficulty panel', async () => { await openMenuItem(3, 'MenuDifficulty'); await closePanel('MenuDifficulty', 3); });
await step('settings + controls rebinding', async () => {
    await openMenuItem(2, 'MenuSettings');
    // walk down to the CONTROLS row by label (rows may be added above it)
    const row = await ev(() => __game.scene.getScene('MenuSettings').rows.findIndex((r) => r.def.label === 'CONTROLS'));
    if (row < 0) throw new Error('no CONTROLS row in Settings');
    for (let j = 0; j < row; j++) await key('ArrowDown');
    await key('Enter');
    await inScene('MenuControls');
    await key('Enter');                    // listen on MOVE UP / KEY
    await key('KeyK');
    const b = await ev(() => JSON.parse(localStorage.getItem('keyBindings') || '{}'));
    if (!b.up || b.up[0] !== 'KeyK') throw new Error(`rebinding not saved: ${JSON.stringify(b.up)}`);
    await page.screenshot({ path: path.join(outDir, '02-controls.png') });
    await key('Escape'); await gone('MenuControls');
    await sleep(200);
    // Settings has the keyboard back: CONTROLS -> AIM -> ENEMY BULLETS, cycle it right then left again
    await key('ArrowDown'); await key('ArrowDown'); await key('ArrowRight');
    const hc = await ev(() => localStorage.getItem('bulletContrast'));
    await key('ArrowLeft');
    if (hc !== 'hc') throw new Error(`ENEMY BULLETS row did not cycle (got ${hc})`);
    await key('Escape'); await gone('MenuSettings');
    await ev(() => localStorage.removeItem('keyBindings'));
    await sleep(150);
    for (let j = 0; j < 2; j++) await key('ArrowUp');
});
await step('start game', async () => { await key('Enter'); await inScene('Game', 10000); await until(() => !!(window.__dbg && __dbg.scene.player), 'player'); });
await step('player fires', async () => {
    await page.keyboard.down('Space');
    await until(() => __dbg.scene.shots.count > 0 || __dbg.scene.combat.stats.shots > 0, 'player shots');
    await page.keyboard.up('Space');
});
await step('wave clear -> upgrade -> wave 2', async () => {
    await ev(() => { __dbg.godMode(true); __dbg.killAll(); __dbg.scene.waves.timeLeft = 1; });
    await until(() => !!__dbg.scene.upgradeScreen, 'upgrade screen', 10000);
    await sleep(600);
    await page.screenshot({ path: path.join(outDir, '03-upgrade.png') });
    await key('Enter');
    await until(() => __dbg.scene.waves.wave === 2 && !__dbg.scene.upgradeScreen, 'wave 2', 8000);
});
await step('boss spawn', async () => {
    await ev(() => __dbg.boss(1));
    await until(() => !!(__dbg.scene.bosses.boss && __dbg.scene.bosses.boss.alive), 'boss', 10000);
    await sleep(2500);
    await page.screenshot({ path: path.join(outDir, '04-boss.png') });
});
await step('300 bullet stress', async () => {
    await ev(() => __dbg.spray(300));
    await sleep(1200);
    const n = await ev(() => __dbg.scene.enemyBullets.count);
    if (n < 100) throw new Error(`only ${n} bullets alive`);
    await page.screenshot({ path: path.join(outDir, '05-stress.png') });
});
await step('pause and resume', async () => {
    await key('Escape'); await until(() => __dbg.scene.paused, 'paused');
    await sleep(200);
    await key('Escape'); await until(() => !__dbg.scene.paused, 'resumed');
});
await step('death -> game over', async () => {
    await ev(() => { __dbg.godMode(false); __dbg.scene.player.invuln = 0; __dbg.hurt(99999); });
    await inScene('GameOver', 10000);
    await sleep(1500);
    await page.screenshot({ path: path.join(outDir, '06-gameover.png') });
});
await step('retry', async () => { await key('Enter'); await key('Enter'); await inScene('Game', 10000); });
await step('quit to menu', async () => {
    await sleep(500);
    await key('Escape'); await until(() => __dbg.scene.paused, 'paused');
    await key('ArrowDown'); await key('Enter'); await sleep(150); await key('Enter');   // QUIT asks for a second press
    await inScene('MainMenu', 10000);
});
await page.close();

if (a.includes('--prod')) {
    let srv = null;
    // separate process: the dev server above already set NODE_ENV=development in this one, which would leak into the build
    await step('production build', async () => {
        const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
        if (r.status !== 0) throw new Error(`vite build exited ${r.status}`);
    });
    const p = await (async () => { srv = await preview({ logLevel: 'error', preview: { port: 5310, strictPort: false } }); return open(srv.resolvedUrls.local[0]); })();
    await step('production boot + service worker', async () => {
        // the worker registers after 'load' and activates asynchronously: poll for it
        for (let i = 0; i < 60 && !(await p.page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active)); i++) await sleep(250);
        await sleep(1000);
        const r = await p.page.evaluate(async () => ({
            canvas: !!document.querySelector('canvas'), dev: !!window.__game,
            sw: !!(await navigator.serviceWorker.getRegistration()), caches: (await caches.keys()).join(',')
        }));
        await p.page.screenshot({ path: path.join(outDir, '07-prod.png') });
        if (!r.canvas || r.dev || !r.sw) throw new Error(JSON.stringify(r));
        if (p.errors.length) throw new Error(p.errors.join(' | '));
    });
    await (srv?.close ? srv.close() : srv?.httpServer.close());
}

await browser.close();
await server?.close();
console.table(results);
if (problems.length) { console.log('--- problems ---\n' + [...new Set(problems)].join('\n')); process.exit(1); }
console.log(`SMOKE OK (${results.length} steps). Screenshots in ${outDir}/`);
process.exit(0);
