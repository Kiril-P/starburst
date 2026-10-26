// STARBURST API request handler. Runtime-neutral: it gets a D1-style `env.DB` (prepare/bind/run/all/first), so the Worker
// (src/index.js), the local dev server (dev.mjs) and the tests (test/) all run exactly this code.
//
//   POST /v1/run             one finished (or abandoned) run: telemetry always, the public boards if it is ranked
//   POST /v1/event           'session' / 'error' telemetry
//   GET  /v1/board           top runs: ?mode=normal|daily [&day=YYYY-MM-DD] [&limit=10]
//   GET  /v1/admin/summary   balance aggregates (Authorization: Bearer <ADMIN_TOKEN>)
//   GET  /v1/health
//
// Privacy: no IP, user agent or install id is stored. The IP is only passed to Cloudflare's rate limiter as a key.
import { parseRun, parseBoard, parseEvent } from './validate.js';
import { summary } from './summary.js';

const CORS = {
    'access-control-allow-origin': '*',   // no cookies / credentials: the game runs on itch.io, kpetrovski.me and localhost
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400'
};
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS, ...extra } });
const MAX_BODY = 16 * 1024;

async function readJson(req) {
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
}

const limited = async (req, env) => {
    if (!env.RL) return false;
    try { return !(await env.RL.limit({ key: req.headers.get('cf-connecting-ip') || 'local' })).success; } catch (e) { return false; }
};

/** rank of `score` in a board = 1 + runs ranked strictly better (ties: the older run keeps the better place) */
async function rankOf(db, run) {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM runs WHERE ranked = 1 AND mode = ?1 AND day = ?2 AND (score > ?3 OR (score = ?3 AND at < ?4))')
        .bind(run.mode, run.day, run.score, run.at).first();
    return (row?.n ?? 0) + 1;
}

async function postRun(req, env, now) {
    const parsed = parseRun(await readJson(req), now);
    if (!parsed.ok) return json({ ok: false, why: parsed.why }, 400);
    const r = parsed.run;
    const res = await env.DB.prepare(
        `INSERT OR IGNORE INTO runs (id, at, build, env, mode, day, ship, diff, outcome, won, score, wave, dur, kills, graze, combo, bosses, killer, name, ranked, device, quality, fps, waves, dmg)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)`
    ).bind(r.id, r.at, r.build, r.env, r.mode, r.day, r.ship, r.diff, r.outcome, r.won, r.score, r.wave, r.dur, r.kills, r.graze, r.combo, r.bosses, r.killer, r.name, r.ranked, r.device, r.quality, r.fps, JSON.stringify(r.waves), JSON.stringify(r.dmg)).run();
    const fresh = (res.meta?.changes ?? 1) > 0;
    // a retry of the same run id: report the stored rank instead of inserting twice
    const row = fresh ? r : await env.DB.prepare('SELECT at, mode, day, score, ranked FROM runs WHERE id = ?1').bind(r.id).first();
    const rank = row?.ranked ? await rankOf(env.DB, row) : 0;
    return json({ ok: true, ranked: !!row?.ranked, rank });
}

async function postEvent(req, env, now) {
    const parsed = parseEvent(await readJson(req));
    if (!parsed.ok) return json({ ok: false, why: parsed.why }, 400);
    const e = parsed.event;
    await env.DB.prepare('INSERT INTO events (at, kind, build, env, data) VALUES (?1,?2,?3,?4,?5)').bind(now, e.kind, e.build, e.env, JSON.stringify(e.data)).run();
    return json({ ok: true });
}

async function getBoard(url, env, now) {
    const q = parseBoard(url, now);
    const { results } = await env.DB.prepare(
        'SELECT id, name, score, wave, ship, diff, day, at, won FROM runs WHERE ranked = 1 AND mode = ?1 AND day = ?2 ORDER BY score DESC, at ASC LIMIT ?3'
    ).bind(q.mode, q.day, q.limit).all();
    const rows = results.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, score: r.score, wave: r.wave, ship: r.ship, diff: r.diff, date: new Date(r.at).toISOString().slice(0, 10), won: !!r.won }));
    // browsers always revalidate (a player may have just submitted); a shared cache may hold it for 15 s
    return json({ ok: true, mode: q.mode, day: q.day, rows }, 200, { 'cache-control': 'public, max-age=0, s-maxage=15' });
}

const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function handle(req, env, now = Date.now()) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
        if (url.pathname === '/v1/health') return json({ ok: true, now });
        if (req.method === 'GET' && url.pathname === '/v1/board') return await getBoard(url, env, now);
        if (req.method === 'GET' && url.pathname === '/v1/admin/summary') {
            const token = env.ADMIN_TOKEN, got = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
            if (!token || !safeEq(token, got)) return json({ ok: false, why: 'auth' }, 401);
            return json({ ok: true, ...(await summary(env.DB, url)) });
        }
        if (req.method === 'POST' && (url.pathname === '/v1/run' || url.pathname === '/v1/event')) {
            if (await limited(req, env)) return json({ ok: false, why: 'rate' }, 429);
            return url.pathname === '/v1/run' ? await postRun(req, env, now) : await postEvent(req, env, now);
        }
        return json({ ok: false, why: 'not-found' }, 404);
    } catch (e) {
        return json({ ok: false, why: 'server' }, 500);
    }
}
