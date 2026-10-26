// node --test server/test  (needs Node 22.13+ for node:sqlite)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/handler.js';
import { openDb } from '../src/d1shim.js';
import { parseRun, cleanName, LIMITS } from '../src/validate.js';

const NOW = Date.parse('2026-10-25T12:00:00Z');
const mk = () => ({ DB: openDb(), ADMIN_TOKEN: 'sekret' });
const post = (env, path, body, now = NOW) => handle(new Request('http://x' + path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env, now);
const get = (env, path, headers = {}, now = NOW) => handle(new Request('http://x' + path, { headers }), env, now);
let n = 0;
const run = (o = {}) => ({
    id: 'run' + String(++n).padStart(14, '0'), build: '2.0.0-abc', env: 'prod', mode: 'normal', ship: 'normal', diff: 'normal', outcome: 'death',
    score: 52000, wave: 9, dur: 240000, kills: 120, graze: 300, combo: 8, bosses: 1, killer: 'beam:pylon', name: 'KIL', device: 'keyboard', quality: 'auto', fps: 60,
    waves: [[1, 20000, 0, 0], [2, 30000, 10, 1]], dmg: { 'beam:pylon': 20, basic: 10 }, ...o
});

test('a plausible run is ranked and shows up on the board', async () => {
    const env = mk();
    const r = await (await post(env, '/v1/run', run())).json();
    assert.deepEqual([r.ok, r.ranked, r.rank], [true, true, 1]);
    const b = await (await get(env, '/v1/board?mode=normal')).json();
    assert.equal(b.rows.length, 1);
    assert.equal(b.rows[0].name, 'KIL');
    assert.equal(b.rows[0].score, 52000);
});

test('a win (beat the final boss, left to the menu) is ranked like a death', async () => {
    const env = mk();
    const r = await (await post(env, '/v1/run', run({ outcome: 'win', won: true, wave: 20, score: 400000, dur: 1200000 }))).json();
    assert.deepEqual([r.ranked, r.rank], [true, 1]);
    assert.equal((await (await get(env, '/v1/board')).json()).rows[0].won, true);
});

test('rank counts better runs; ties keep the older run ahead', async () => {
    const env = mk();
    await post(env, '/v1/run', run({ score: 90000 }), NOW);
    await post(env, '/v1/run', run({ score: 50000 }), NOW + 1);
    const mid = await (await post(env, '/v1/run', run({ score: 70000 }), NOW + 2)).json();
    assert.equal(mid.rank, 2);
    const tie = await (await post(env, '/v1/run', run({ score: 70000 }), NOW + 3)).json();
    assert.equal(tie.rank, 3);
});

test('a retried run id is stored once and reports the same rank', async () => {
    const env = mk();
    const body = run();
    await post(env, '/v1/run', body);
    const again = await (await post(env, '/v1/run', body, NOW + 5000)).json();
    assert.deepEqual([again.ok, again.ranked, again.rank], [true, true, 1]);
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM runs').first()).n, 1);
});

test('implausible, assist, dev, quit and unnamed runs are stored for telemetry but not ranked', async () => {
    const env = mk();
    const cases = [run({ score: 9e7 }), run({ assist: true }), run({ env: 'dev' }), run({ outcome: 'quit' }), run({ name: '' }), run({ name: 'XXX' }), run({ wave: 90 }), run({ dur: 500 })];
    for (const c of cases) { const r = await (await post(env, '/v1/run', c)).json(); assert.equal(r.ok, true); assert.equal(r.ranked, false); }
    assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM runs').first()).n, cases.length);
    assert.equal((await (await get(env, '/v1/board')).json()).rows.length, 0);
});

test('malformed bodies are rejected', async () => {
    const env = mk();
    for (const bad of ['not json', '[]', '{}', JSON.stringify(run({ id: 'x' })), JSON.stringify(run({ ship: 'ufo' })), JSON.stringify(run({ build: '<script>' })), JSON.stringify({ ...run(), mode: 'daily' })]) {
        const r = await post(env, '/v1/run', bad);
        assert.equal(r.status, 400, bad.slice(0, 40));
    }
    assert.equal((await post(env, '/v1/run', 'x'.repeat(20000))).status, 400);
});

test('values are clamped and strings sanitised', () => {
    const p = parseRun({ ...run(), score: -5, kills: 'lots', dmg: { ok: 1, '<b>': 5, __proto__: 9 }, waves: [[1, 2, 3, 4], 'x', [1]] }, NOW);
    assert.equal(p.ok, true);
    assert.equal(p.run.score, 0);
    assert.equal(p.run.kills, 0);
    assert.deepEqual(p.run.dmg, { ok: 1 });
    assert.equal(p.run.waves.length, 1);
    assert.equal(p.run.ranked, 0);
});

test('daily boards are separate per day and only accept a sane date', async () => {
    const env = mk();
    const d = (day, o = {}) => run({ mode: 'daily', day, ...o });
    assert.equal((await (await post(env, '/v1/run', d('2026-10-25', { score: 40000 }))).json()).rank, 1);
    assert.equal((await (await post(env, '/v1/run', d('2026-10-24', { score: 99000 }))).json()).rank, 1);   // yesterday's board is separate
    assert.equal((await post(env, '/v1/run', d('2025-01-01'))).status, 400);
    assert.equal((await post(env, '/v1/run', run({ mode: 'daily' }))).status, 400);
    const today = await (await get(env, '/v1/board?mode=daily&day=2026-10-25')).json();
    assert.deepEqual(today.rows.map((r) => r.score), [40000]);
    const dflt = await (await get(env, '/v1/board?mode=daily')).json();   // no day: server's UTC today
    assert.equal(dflt.day, '2026-10-25');
});

test('callsigns', () => {
    assert.equal(cleanName('abc'), 'ABC');
    for (const bad of ['ab', 'abcd', 'a b', 'XXX', '', null, 5, 'A<>']) assert.equal(cleanName(bad), '');
});

test('events: session and error telemetry are whitelisted and bounded', async () => {
    const env = mk();
    assert.equal((await post(env, '/v1/event', { kind: 'session', build: '2.0.0-abc', env: 'prod', data: { device: 'touch', w: 800, h: 400, dpr: 2, lang: 'EN-us', evil: 'x' } })).status, 200);
    assert.equal((await post(env, '/v1/event', { kind: 'error', build: '2.0.0-abc', data: { msg: 'm'.repeat(999) } })).status, 200);
    assert.equal((await post(env, '/v1/event', { kind: 'steal', build: '2.0.0-abc' })).status, 400);
    const rows = (await env.DB.prepare('SELECT * FROM events ORDER BY id').all()).results;
    assert.equal(rows.length, 2);
    assert.equal(JSON.parse(rows[0].data).evil, undefined);
    assert.equal(JSON.parse(rows[0].data).lang, 'en');
    assert.equal(JSON.parse(rows[1].data).msg.length, 200);
});

test('admin summary needs the token and aggregates per wave / killer / damage', async () => {
    const env = mk();
    await post(env, '/v1/run', run({ wave: 2, killer: 'basic' }));
    await post(env, '/v1/run', run({ wave: 2, killer: 'basic', dmg: { basic: 30 } }));
    await post(env, '/v1/run', run({ outcome: 'quit', killer: '' }));
    assert.equal((await get(env, '/v1/admin/summary')).status, 401);
    assert.equal((await get(env, '/v1/admin/summary', { authorization: 'Bearer nope' })).status, 401);
    const s = await (await get(env, '/v1/admin/summary', { authorization: 'Bearer sekret' })).json();
    assert.equal(s.totals.runs, 3);
    assert.equal(s.totals.quits, 1);
    assert.equal(s.killers[0].killer, 'basic');
    assert.equal(s.killers[0].n, 2);
    assert.deepEqual(s.perWave.find((w) => w.wave === 2), { wave: 2, reached: 3, avgMs: 30000, avgHpLost: 10, avgHits: 1 });
    assert.equal(s.damage.find((d) => d.src === 'basic').hp, 10 + 30 + 10);
});

test('rate limiting and CORS', async () => {
    const env = { ...mk(), RL: { limit: async () => ({ success: false }) } };
    assert.equal((await post(env, '/v1/run', run())).status, 429);
    assert.equal((await get(env, '/v1/board')).status, 200);   // reads are never limited
    const pre = await handle(new Request('http://x/v1/run', { method: 'OPTIONS' }), env);
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
});

test('limits sanity: a bot-speed run passes, an absurd one does not', () => {
    assert.equal(parseRun(run({ score: 300000, dur: 600000, wave: 20 }), NOW).run.ranked, 1);
    assert.equal(parseRun(run({ score: 300000, dur: 20000, wave: 3 }), NOW).run.ranked, 0);   // too fast for its length
    assert.equal(parseRun(run({ score: 3200000, dur: 1118000, wave: 20 }), NOW).run.ranked, 1);   // the best bot clear
    assert.equal(parseRun(run({ score: 2000000, dur: 900000, wave: 5 }), NOW).run.ranked, 0);   // late-game score at wave 5
    assert.ok(LIMITS.scorePerSec > 0);
});
