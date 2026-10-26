// End-to-end check of the online layer (npm run test:online): the real game in headless Chrome against the real API handler
// (server/src/handler.js on node:sqlite). Walks: session telemetry -> RECORDS world tabs -> die -> callsign picker -> world rank on
// GameOver -> the run in the database -> world board row -> offline queue + flush -> ONLINE switched off sends nothing.
// Also asserts the page only ever talks to its own origin and the API. Needs Node 22.13+ (node:sqlite) and Chrome.
//   node tools/online-smoke.mjs [--out tmp/online] [--size 1280x720] [--chrome PATH]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createServer } from 'vite';
import { findChrome, chromeArgs, seedRandom } from './lib/browser.mjs';
import { handle } from '../server/src/handler.js';
import { openDb } from '../server/src/d1shim.js';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const outDir = get('--out', 'tmp/online');
const [vw, vh] = get('--size', '1280x720').split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the API, in process, so the test can stop and restart it -----------------------------------------------------------
const PORT = 8791;
const env = { DB: openDb(), ADMIN_TOKEN: 't' };
const q = (sql) => env.DB.raw.prepare(sql).all();
let api = null;
const startApi = () => new Promise((res) => {
    api = http.createServer(async (req, rsp) => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const r = await handle(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : Buffer.concat(chunks) }), env);
        rsp.writeHead(r.status, Object.fromEntries(r.headers));
        rsp.end(Buffer.from(await r.arrayBuffer()));
    }).listen(PORT, res);
});
const stopApi = () => new Promise((res) => { api.closeAllConnections?.(); api.close(res); });
await startApi();

process.env.VITE_API_URL = `http://localhost:${PORT}`;
process.env.VITE_TELEMETRY_ENV = 'prod';   // dev builds are never ranked; this run stands in for production
const vite = await createServer({ logLevel: 'error', server: { port: 5310, strictPort: false } });
await vite.listen();
const base = vite.resolvedUrls.local[0].replace(/\/$/, '');
const allowed = new Set([new URL(base).origin, `http://localhost:${PORT}`]);

const browser = await puppeteer.launch({ executablePath: findChrome(get('--chrome')), headless: 'new', args: chromeArgs(vw, vh) });
const stray = [];
browser.on('targetcreated', (t) => { if (t.type() === 'page' && t.url() && t.url() !== 'about:blank') stray.push(t.url()); });
const page = await browser.newPage();
await page.setViewport({ width: vw, height: vh });
const errors = [], foreign = new Set();
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errors.push('console.error ' + m.text()); });
page.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('blob:') && !allowed.has(new URL(u).origin)) foreign.add(u); });
await page.evaluateOnNewDocument(seedRandom, 4242, true);
await page.goto(base + '/', { waitUntil: 'load' });

const results = [];
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const key = async (k, hold = 50) => { await page.keyboard.down(k); await sleep(hold); await page.keyboard.up(k); await sleep(70); };
async function until(fn, what, ms = 10000, arg) {
    const t0 = Date.now();
    for (;;) {
        let v; try { v = await page.evaluate(fn, arg); } catch (e) { v = null; }
        if (v) return v;
        if (Date.now() - t0 > ms) throw new Error(`timeout (${ms}ms) waiting for ${what}`);
        await sleep(100);
    }
}
const inScene = (k, ms) => until((s) => __game.scene.isActive(s), `scene ${k}`, ms, k);
async function step(name, fn) {
    const t0 = Date.now(), before = errors.length;
    try { await fn(); if (errors.length > before) throw new Error(errors.slice(before).join(' | ')); results.push({ step: name, ok: 'PASS', ms: Date.now() - t0 }); } catch (e) {
        results.push({ step: name, ok: 'FAIL', ms: Date.now() - t0, why: e.message.slice(0, 200) });
        await page.screenshot({ path: path.join(outDir, `fail-${name.replace(/\W+/g, '-')}.png`) }).catch(() => {});
    }
}
const must = (c, msg) => { if (!c) throw new Error(msg); };
const shot = (n) => page.screenshot({ path: path.join(outDir, n) });
const listText = () => ev(() => __game.scene.getScene('MenuRecords').list.list.filter((o) => o.text !== undefined).map((o) => o.text).join('|'));

/** play one run from the menu: start, bank a score, die. Resolves once GameOver is up. */
async function playAndDie(score) {
    await key('Enter');
    await inScene('Game', 12000);
    await until(() => !!(window.__dbg && __dbg.scene.player && __dbg.scene.runlog), 'player');
    await ev((s) => { __dbg.scene.combat.score = s; }, score);
    await until(() => __dbg.scene.runlog.ms > 3500, 'a few seconds of play', 15000);
    await ev(() => __dbg.scene.combat.hurt(999, 'basic'));
    await inScene('GameOver', 12000);
}
const toMenu = async () => { await ev(() => __game.scene.getScene('GameOver').leave('MainMenu')); await inScene('MainMenu', 10000); await sleep(1200); };

await step('boot + session event', async () => {
    await inScene('MainMenu', 15000);
    await until(() => true);
    for (let i = 0; i < 50 && !q("SELECT 1 FROM events WHERE kind='session'").length; i++) await sleep(100);
    const ev0 = q("SELECT * FROM events WHERE kind='session'");
    must(ev0.length === 1, `expected 1 session event, got ${ev0.length}`);
    const d = JSON.parse(ev0[0].data);
    must(d.w > 0 && d.device, `session data ${ev0[0].data}`);
    must(ev0[0].env === 'prod', 'env');
});
await step('SETTINGS has the ONLINE switch', async () => {
    await ev(() => __game.scene.getScene('MainMenu').openOverlay('MenuSettings'));
    await inScene('MenuSettings');
    must(await ev(() => __game.scene.getScene('MenuSettings').rows.some((r) => r.def.label === 'ONLINE')), 'no ONLINE row');
    await sleep(400);
    await shot('00-settings.png');
    await key('Escape');
    await until(() => !__game.scene.isActive('MenuSettings'), 'settings closed');
    await sleep(300);
});
await step('RECORDS shows WORLD tabs (empty board)', async () => {
    await ev(() => __game.scene.getScene('MainMenu').openOverlay('MenuRecords'));
    await inScene('MenuRecords');
    must(await ev(() => __game.scene.getScene('MenuRecords').tabs.length) === 4, 'expected 4 tabs');
    await ev(() => __game.scene.getScene('MenuRecords').show('world'));
    await until(() => __game.scene.getScene('MenuRecords').list.list.some((o) => o.text === 'NO RUNS YET'), 'empty world board');
    await shot('01-records-empty.png');
    await key('Escape');
    await until(() => !__game.scene.isActive('MenuRecords'), 'records closed');
    await sleep(300);
});
await step('run: die -> callsign picker -> world rank #1', async () => {
    await playAndDie(7000);
    await shot('02-gameover-callsign-prompt.png');
    await inScene('MenuCallsign', 8000);
    await sleep(500);
    await shot('03-callsign.png');
    for (const k of ['KeyK', 'KeyI', 'KeyR']) await key(k);
    await key('Enter');
    await until(() => !__game.scene.isActive('MenuCallsign'), 'picker closed');
    await until(() => /WORLD RANK/.test(__game.scene.getScene('GameOver').world.text?.text || ''), 'rank text', 8000);
    const t = await ev(() => __game.scene.getScene('GameOver').world.text.text);
    must(/#1$/.test(t), `rank text "${t}"`);
    must(await ev(() => localStorage.getItem('callsign')) === 'KIR', 'callsign not saved');
    await sleep(400);
    await shot('04-gameover-ranked.png');
});
await step('server stored the run with telemetry', async () => {
    const r = q('SELECT * FROM runs');
    must(r.length === 1, `runs=${r.length}`);
    const x = r[0];
    must(x.name === 'KIR' && x.ranked === 1 && x.score === 7000 && x.outcome === 'death' && x.killer === 'basic' && x.env === 'prod', JSON.stringify(x).slice(0, 200));
    must(x.dur > 3000 && x.wave === 1 && x.mode === 'normal' && x.ship && x.diff, 'run fields');
    const waves = JSON.parse(x.waves), dmg = JSON.parse(x.dmg);
    must(waves.length >= 1 && waves[0][0] === 1 && waves[0][2] > 0 && waves[0][3] === 1, `waves ${x.waves}`);
    must(dmg.basic > 0, `dmg ${x.dmg}`);
});
await step('world board lists the run, highlighted as mine', async () => {
    await toMenu();
    await ev(() => __game.scene.getScene('MainMenu').openOverlay('MenuRecords'));
    await inScene('MenuRecords');
    await ev(() => __game.scene.getScene('MenuRecords').show('world'));
    await until(() => __game.scene.getScene('MenuRecords').list.list.some((o) => o.text === 'KIR'), 'KIR on the world board');
    const t = await listText();
    must(t.includes('7,000'), `board text: ${t}`);
    await shot('05-records-world.png');
    await key('Escape');
    await until(() => !__game.scene.isActive('MenuRecords'), 'records closed');
    await sleep(300);
});
await step('offline: run is queued, then flushed on the next launch', async () => {
    await stopApi();
    await playAndDie(3000);
    await until(() => /OFFLINE/.test(__game.scene.getScene('GameOver').world.text?.text || ''), 'offline message', 15000);
    must((await ev(() => JSON.parse(localStorage.getItem('outbox') || '[]').length)) === 1, 'outbox not filled');
    await shot('06-gameover-offline.png');
    await startApi();
    await page.goto(base + '/', { waitUntil: 'load' });
    await inScene('MainMenu', 15000);
    for (let i = 0; i < 80 && q('SELECT 1 FROM runs').length < 2; i++) await sleep(100);
    must(q('SELECT 1 FROM runs').length === 2, 'queued run never arrived');
    must((await ev(() => JSON.parse(localStorage.getItem('outbox') || '[]').length)) === 0, 'outbox not emptied');
});
await step('quit from the pause menu sends an abandoned run (unranked)', async () => {
    await sleep(1500);
    await key('Enter');
    await inScene('Game', 12000);
    await until(() => !!(window.__dbg && __dbg.scene.runlog), 'run log');
    await until(() => __dbg.scene.runlog.ms > 5500, 'a few seconds of play', 15000);
    await ev(() => __dbg.scene.quit());
    await inScene('MainMenu', 10000);
    for (let i = 0; i < 50 && !q("SELECT 1 FROM runs WHERE outcome='quit'").length; i++) await sleep(100);
    const r = q("SELECT * FROM runs WHERE outcome='quit'");
    must(r.length === 1 && r[0].ranked === 0 && r[0].killer === '' && r[0].dur > 5000, `quit rows: ${JSON.stringify(r).slice(0, 200)}`);
});
await step('beating the final boss and leaving to the menu sends a ranked win', async () => {
    await sleep(1500);
    await key('Enter');
    await inScene('Game', 12000);
    await until(() => !!(window.__dbg && __dbg.scene.runlog), 'run log');
    await ev(() => { __dbg.scene.combat.score = 9000; });
    await until(() => __dbg.scene.runlog.ms > 3500, 'a few seconds of play', 15000);
    await ev(() => __dbg.scene.bosses.victory());
    await inScene('Victory', 8000);
    await ev(() => __game.scene.getScene('Victory').toMenu());
    await inScene('MainMenu', 10000);
    for (let i = 0; i < 50 && !q("SELECT 1 FROM runs WHERE outcome='win'").length; i++) await sleep(100);
    const r = q("SELECT * FROM runs WHERE outcome='win'");
    must(r.length === 1 && r[0].won === 1 && r[0].name === 'KIR' && r[0].ranked === 1, `win rows: ${JSON.stringify(r).slice(0, 220)}`);
});
await step('ONLINE off: nothing is sent', async () => {
    await ev(() => localStorage.setItem('online', '0'));
    const before = q('SELECT 1 FROM runs').length, evBefore = q('SELECT 1 FROM events').length;
    await page.goto(base + '/', { waitUntil: 'load' });
    await inScene('MainMenu', 15000);
    await sleep(1500);   // the menu ignores input while its intro runs
    await playAndDie(2500);
    await sleep(1500);
    must(await ev(() => !__game.scene.getScene('GameOver').world.text), 'world line shown while offline-by-choice');
    must(q('SELECT 1 FROM runs').length === before && q('SELECT 1 FROM events').length === evBefore, 'data was sent with ONLINE off');
});
/** start a run from the menu and stand still until the hull has taken damage; resolves with the damage-by-source keys */
async function standStill(setup, ms) {
    await key('Enter');
    await inScene('Game', 12000);
    await until(() => !!(window.__dbg && __dbg.scene.player && __dbg.scene.runlog), 'player');
    await ev(setup);
    await until(() => Object.keys(__dbg.scene.runlog.dmg).length > 0 || !__dbg.scene.player.alive, 'the first hit', ms);
    return ev(() => Object.keys(__dbg.scene.runlog.dmg));
}
await step('damage is blamed on what fired it: enemy types', async () => {
    await toMenu();
    await sleep(1200);
    const keys = await standStill(() => { __dbg.spawn('basic'); __dbg.spawn('spread'); __dbg.spawn('circular'); }, 60000);
    must(keys.length > 0 && keys.every((k) => /^(basic|spread|circular|ram:\w+|shards:\w+|meteor\w*)$/.test(k)), `sources: ${keys.join(',')}`);
    await ev(() => __dbg.scene.quit());
    await inScene('MainMenu', 10000);
});
await step('damage is blamed on what fired it: boss and phase', async () => {
    await sleep(1500);
    const keys = await standStill(() => { __dbg.skipToWave(5); }, 90000);
    must(keys.length > 0 && keys.some((k) => /^boss:[a-z]+\/p\d$/.test(k)), `sources: ${keys.join(',')}`);
    await ev(() => __dbg.scene.quit());
    await inScene('MainMenu', 10000);
});
await step('only the game origin and the API were contacted', async () => { must(foreign.size === 0, [...foreign].join(', ')); must(stray.length === 0, 'the game opened a tab: ' + stray.join(', ')); });

await browser.close(); await vite.close(); await stopApi();
const bad = results.filter((r) => r.ok !== 'PASS');
for (const r of results) console.log(`${r.ok}  ${r.step}  (${r.ms}ms)${r.why ? '  ' + r.why : ''}`);
console.log(bad.length ? `online-smoke: ${bad.length} failed` : `online-smoke: ${results.length} steps OK`);
process.exit(bad.length ? 1 : 0);
