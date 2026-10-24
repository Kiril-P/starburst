// Headless balance bot (npm run bot). Plays real runs of the dev build with an autopilot (tools/bot/brain.js) on a
// fixed-step virtual clock (tools/bot/probe.js), many runs in parallel, and writes one JSON line per run.
// Summaries: node tools/bot/report.mjs <results.jsonl>   (docs/BALANCE.md explains the method and the targets)
//
//   node tools/bot.mjs [--ships normal,speedy,tank] [--diffs easy,normal,hard] [--profiles casual,skilled]
//                      [--seeds 1,2,3] [--par 8] [--max-wave 20] [--out tmp/bot/run.jsonl] [--url http://...]
//                      [--start-wave N]   (skip ahead with __dbg; the bot gets that many waves' worth of upgrades)
//                      [--boss id]        (fight one boss by id from wave 1 gear + start-wave upgrades)
//                      [--render-every 30] [--chrome PATH] [--quiet]
//                      [--trace] (log the pilot's state twice a second)  [--shots DIR] (screenshot every 20s of game time)
// Every page error / console.error / HTTP >= 400 is recorded with the run (and counted in the report).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { findChrome, chromeArgs, seedRandom } from './lib/browser.mjs';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const list = (n, d) => get(n, d).split(',').filter(Boolean);
const ships = list('--ships', 'normal,speedy,tank'), diffs = list('--diffs', 'normal'), profiles = list('--profiles', 'casual,skilled');
const seeds = list('--seeds', '1,2,3').map(Number);
const par = Number(get('--par', '8')), maxWave = Number(get('--max-wave', '20')), startWave = Number(get('--start-wave', '0'));
const bossId = get('--boss', ''), trace = a.includes('--trace'), shots = get('--shots', ''), renderEvery = Number(get('--render-every', '30')), quiet = a.includes('--quiet');
const out = get('--out', `tmp/bot/run-${Date.now()}.jsonl`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const probeSrc = fs.readFileSync(new URL('./bot/probe.js', import.meta.url), 'utf8');
const brainSrc = fs.readFileSync(new URL('./bot/brain.js', import.meta.url), 'utf8');

let server = null, base = get('--url', '');
if (!base) {
    server = await createServer({ logLevel: 'error', server: { port: 5400, strictPort: false } });
    await server.listen();
    base = server.resolvedUrls.local[0];
}
base = base.replace(/\/$/, '');
const browser = await puppeteer.launch({ executablePath: findChrome(get('--chrome')), headless: 'new', args: chromeArgs(960, 540), protocolTimeout: 600000 });

/** runs before any page script: storage for this job, virtual-clock hook, never lose focus */
function prelude(o) {
    localStorage.setItem('selectedShip', o.ship);
    localStorage.setItem('selectedDifficulty', o.diff);
    for (const k of ['masterVolume', 'musicVolume', 'soundVolume']) localStorage.setItem(k, '0');
    localStorage.setItem('quality', 'low');
    localStorage.setItem('glow', '0');
    localStorage.setItem('unlockedShips', JSON.stringify(['normal', 'speedy', 'tank']));
    const real = performance.now.bind(performance);
    window.__realNow = real;
    performance.now = () => (window.__vclock ? window.__vclock.vt : real());
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
}

/** in-page driver: one chunk of frames; handles every scene the run can show */
function drive(frames, o) {
    const P = window.__probe, Bn = window.__brain, sm = window.__game.scene;
    const tick = () => {
        if (sm.isActive('GameOver')) { P.end ??= { result: 'died', wave: P.lastWave }; return true; }
        if (sm.isActive('Victory')) { P.end = { result: 'victory', wave: P.lastWave }; return true; }
        const g = sm.getScene('Game');
        if (sm.isActive('SectorComplete')) {
            const s = sm.getScene('SectorComplete');
            P.secAt ??= P.vt;
            if (!s.closing && P.vt - P.secAt > 500) { s.close(); P.secAt = null; }
            return false;
        }
        if (!g || !g.sys.isActive() || !g.player) return false;
        P.wire(g);
        P.lastWave = g.waves.wave;
        if (g.waves.wave > o.maxWave) { P.end = { result: 'maxwave', wave: o.maxWave }; return true; }
        P.observe(g);
        const us = g.upgradeScreen;
        if (us) {
            Bn.releaseAll();
            if (us.nav.enabled && !us.picked) {
                const opts = us.cards.map((c) => c.option), i = Bn.pickUpgrade(g, opts);
                P.picks.push({ wave: g.waves.wave, offered: opts.map((x) => x.id), took: opts[i].id, hp: Math.round(g.player.hp / g.player.maxHp * 100) });
                us.pick(us.cards[i]);
            }
            return false;
        }
        Bn.tick(g, P.vt);
        if (o.trace && P.frame % 6 === 0) {
            const p = g.player, t = g.waves.live.filter((e) => e.alive).map((e) => `${e.typeName}@${Math.round(e.x)},${Math.round(e.y)}`).slice(0, 4).join(' ');
            P.trace.push(`${Math.round((P.vt - P.t0) / 100) / 10}s w${g.waves.wave} ${g.waves.state} p=${Math.round(p.x)},${Math.round(p.y)} aim=${Math.round(p.aim * 57.3)} hp=${p.hp} keys=${[...Bn.held].join('+')} plan=${Bn.last ? Bn.last.dir + ' c' + Bn.last.cost.toFixed(1) + ' h' + Bn.last.firstHit : ''} near=${g.enemyBullets.live.filter((b) => b.alive).map((b) => Math.round(Math.hypot(b.x - p.x, b.y - p.y))).sort((x, y) => x - y).slice(0, 3)} | ${t}`);
        }
        return false;
    };
    P.run(frames, tick);
    const g = sm.getScene('Game');
    return { end: P.end, wave: P.lastWave, simMs: Math.round(P.vt - P.t0), hp: g?.player ? Math.round(g.player.hp) : null };
}

/** fast-forward: pick upgrades for the skipped waves with the bot's own policy, then jump */
function skipAhead(o) {
    const g = window.__dbg.scene, Bn = window.__brain;
    for (let w = 1; w < o.startWave; w++) {
        const boss = [3, 5, 8, 10, 13, 15, 18, 20].includes(w);
        // same offer shape the game makes (systems/upgrades.js rollOptions), generated through the live scene
        const opts = window.__botRoll(g, boss);
        const i = Bn.pickUpgrade(g, opts);
        if (!g.arsenal.apply(opts[i].id)) g.player.applyUpgrade(opts[i].id);
    }
    if (o.boss) return window.__dbg.fight(o.boss);
    window.__dbg.skipToWave(o.startWave);
}

async function job(o) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 960, height: 540 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.evaluateOnNewDocument(seedRandom, o.seed, true);
    await page.evaluateOnNewDocument(prelude, o);
    const t0 = Date.now();
    let res;
    try {
        await page.goto(base + '/?scene=Game', { waitUntil: 'load' });
        await page.waitForFunction(() => window.__dbg && window.__dbg.scene.player && window.__game.loop.frame > 5, { timeout: 60000 });
        await page.evaluate(probeSrc);
        await page.evaluate(brainSrc);
        await page.evaluate((o) => { window.__probe.renderEvery = o.renderEvery; window.__probe.takeover(); window.__brain.init(o.profile, o.seed * 7919 + 1); }, o);
        if (o.startWave > 1 || o.boss) {
            await page.evaluate(async () => {
                const { rollOptions } = await import('/src/systems/upgrades.js');
                window.__botRoll = (g, boss) => rollOptions(g.player.levels, Math.random, g.arsenal, { boss });
            });
            await page.evaluate(skipAhead, o);
        }
        let st;
        const limitMs = 60 * 60 * 1000;   // an hour of game time is far past any run that isn't stuck
        if (o.trace) await page.evaluate(() => { window.__probe.trace = []; });
        let n = 0;
        do {
            st = await page.evaluate(drive, 1200, o);
            if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${o.ship}-${o.profile}-${o.seed}-${String(n++).padStart(3, '0')}.png`) }); }
            if (o.trace) for (const l of await page.evaluate(() => window.__probe.trace.splice(0))) console.log(l);
        } while (!st.end && st.simMs < limitMs);
        if (!st.end) st.end = { result: 'timeout', wave: st.wave };
        const summary = await page.evaluate(() => ({ ...window.__probe.summary(), brain: window.__brain.stats }));
        res = { ...o, ...st.end, simMs: st.simMs, realMs: Date.now() - t0, errors, ...summary };
    } catch (e) {
        res = { ...o, result: 'crash', why: e.message.slice(0, 300), errors, realMs: Date.now() - t0 };
    }
    await ctx.close();
    return res;
}

const jobs = [];
for (const diff of diffs) for (const profile of profiles) for (const ship of ships) for (const seed of seeds) jobs.push({ ship, diff, profile, seed, maxWave, startWave, boss: bossId, renderEvery, trace });
let next = 0, done = 0;
const t0 = Date.now();
async function worker() {
    while (next < jobs.length) {
        const o = jobs[next++];
        const r = await job(o);
        fs.appendFileSync(out, JSON.stringify(r) + '\n');
        done++;
        if (!quiet) {
            const boss = (r.bosses || []).map((b) => `${b.id}:${b.result[0]}${Math.round(b.ms / 1000)}s`).join(' ');
            console.log(`[${done}/${jobs.length}] ${o.diff} ${o.profile} ${o.ship} s${o.seed}: ${r.result} wave ${r.wave} ` +
                `(${Math.round((r.simMs || 0) / 1000)}s sim / ${Math.round(r.realMs / 1000)}s real) ${r.death ? 'killed by ' + r.death.src : ''} ${boss}${r.errors.length ? ' ERRORS ' + r.errors.length : ''}${r.why ? ' ' + r.why : ''}`);
        }
    }
}
await Promise.all(Array.from({ length: Math.min(par, jobs.length) }, worker));
await browser.close();
await server?.close();
console.log(`${jobs.length} runs in ${Math.round((Date.now() - t0) / 1000)}s -> ${out}`);
