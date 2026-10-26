// Request validation for the STARBURST API. Pure functions, no I/O, so tests and the local dev server share them.
// The client is untrusted (the repo is public): everything is type-checked, clamped and size-limited here, and a score
// has to be plausible for the run it claims (see plausible()). That stops typos and casual tampering, not a determined
// cheater: there is no replay verification. A run that fails the check is still stored for telemetry, just not ranked.

export const MODES = ['normal', 'daily'];
export const SHIPS = ['normal', 'speedy', 'tank'];
export const DIFFS = ['easy', 'normal', 'hard'];
export const OUTCOMES = ['death', 'win', 'quit'];   // win = beat the final boss and left to the menu instead of continuing
export const DEVICES = ['keyboard', 'gamepad', 'touch'];
export const QUALITIES = ['auto', 'high', 'low'];

// Calibrated on the balance bot (docs/BALANCE.md, "Online boards"): 12 full runs of the zero-lag oracle and the skilled bot
// averaged 90-2860 points per second of play (full clears: 1.3-3.2 M points in 1100-1400 s) with bursts up to 17000/s in a
// boss kill. The limits sit at about twice the best average, and a wave-based cap stops a short run claiming a late-game score.
export const LIMITS = {
    scorePerSec: 6000,      // average over the whole run
    scorePerWave2: 12000,   // score <= scorePerWave2 * wave^2 + scoreBase (wave 20: 4.8 M; the best bot clear scored 3.2 M)
    scoreBase: 4000,        // flat allowance (flawless bonuses, boss kills)
    minMsPerWave: 5000,     // a wave cannot be cleared faster than this on average
    maxDurMs: 6 * 3600e3,
    maxScore: 2e8,
    maxWave: 400,
    waves: 80,              // per-wave telemetry rows kept
    dmgKeys: 40
};

const RE_ID = /^[A-Za-z0-9_-]{16,32}$/;
const RE_BUILD = /^[0-9A-Za-z.+-]{1,40}$/;
const RE_DAY = /^\d{4}-\d{2}-\d{2}$/;
const RE_SRC = /^[a-z0-9:_/.-]{1,48}$/;
const RE_NAME = /^[A-Z0-9]{3}$/;

// Small blocklist for 3-letter callsigns (matched on the exact 3 chars, and on the common leetspeak form).
const BLOCKED = new Set(['ASS', 'CUM', 'FAG', 'FUK', 'FUC', 'FUX', 'KKK', 'NIG', 'NGR', 'SEX', 'TIT', 'WTF', 'XXX', 'DIK', 'CNT', 'COK', 'JEW', 'KYS', 'GAY', 'HOE', 'JIZ', 'NZI', 'SS1', 'S3X', 'A55', 'D1K', 'FU6']);

export const cleanName = (n) => {
    const s = typeof n === 'string' ? n.toUpperCase() : '';
    return RE_NAME.test(s) && !BLOCKED.has(s) ? s : '';
};

const int = (v, min, max, d = 0) => {
    const n = typeof v === 'number' ? v : Number.NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : d;
};
const oneOf = (v, list, d = '') => (list.includes(v) ? v : d);

/** Days apart of two YYYY-MM-DD keys (UTC). */
const dayNum = (k) => Math.floor(Date.parse(k + 'T00:00:00Z') / 864e5);

/**
 * Normalise a POST /v1/run body. Returns { ok: true, run } or { ok: false, why }.
 * `ranked` is decided here: only plausible, assist-free, production runs with a clean callsign get on the boards.
 */
export function parseRun(body, now = Date.now()) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, why: 'body' };
    if (typeof body.id !== 'string' || !RE_ID.test(body.id)) return { ok: false, why: 'id' };
    if (typeof body.build !== 'string' || !RE_BUILD.test(body.build)) return { ok: false, why: 'build' };
    const mode = oneOf(body.mode, MODES), ship = oneOf(body.ship, SHIPS), diff = oneOf(body.diff, DIFFS), outcome = oneOf(body.outcome, OUTCOMES);
    if (!mode || !ship || !diff || !outcome) return { ok: false, why: 'enum' };

    let day = '';
    if (mode === 'daily') {
        // the daily seed is the player's LOCAL date, so accept anything from UTC-14 to UTC+14
        if (typeof body.day !== 'string' || !RE_DAY.test(body.day) || Number.isNaN(Date.parse(body.day))) return { ok: false, why: 'day' };
        if (Math.abs(dayNum(body.day) - Math.floor(now / 864e5)) > 1) return { ok: false, why: 'day-range' };
        day = body.day;
    }

    const run = {
        id: body.id, at: now, build: body.build, env: body.env === 'dev' ? 'dev' : 'prod',
        mode, day, ship, diff, outcome, won: body.won ? 1 : 0,
        score: int(body.score, 0, LIMITS.maxScore), wave: int(body.wave, 1, LIMITS.maxWave, 1), dur: int(body.dur, 0, LIMITS.maxDurMs),
        kills: int(body.kills, 0, 1e6), graze: int(body.graze, 0, 1e7), combo: int(body.combo, 1, 1e4, 1), bosses: int(body.bosses, 0, 1e3),
        killer: typeof body.killer === 'string' && RE_SRC.test(body.killer) ? body.killer : '',
        name: cleanName(body.name),
        device: oneOf(body.device, DEVICES), quality: oneOf(body.quality, QUALITIES), fps: int(body.fps, 0, 1000),
        waves: [], dmg: {}
    };
    if (Array.isArray(body.waves)) {
        for (const r of body.waves.slice(0, LIMITS.waves)) {
            if (Array.isArray(r) && r.length >= 4) run.waves.push([int(r[0], 1, LIMITS.maxWave, 1), int(r[1], 0, LIMITS.maxDurMs), int(r[2], 0, 1e4), int(r[3], 0, 1e4)]);
        }
    }
    if (body.dmg && typeof body.dmg === 'object' && !Array.isArray(body.dmg)) {
        for (const [k, v] of Object.entries(body.dmg).slice(0, LIMITS.dmgKeys)) if (RE_SRC.test(k) && k !== '__proto__') run.dmg[k] = int(v, 0, 1e5);
    }
    run.ranked = body.assist || run.env !== 'prod' || outcome === 'quit' || !run.name || run.score <= 0 || !plausible(run) ? 0 : 1;
    return { ok: true, run };
}

/** Can this score have been earned in this many seconds / waves? Deliberately generous: false negatives are worse. */
export function plausible(r) {
    const sec = r.dur / 1000;
    if (r.dur < 3000) return false;
    if (r.score > LIMITS.scoreBase + LIMITS.scorePerSec * sec) return false;
    if (r.score > LIMITS.scoreBase + LIMITS.scorePerWave2 * r.wave * r.wave) return false;
    if (r.wave > 1 + r.dur / LIMITS.minMsPerWave) return false;
    if (r.kills > 6 * sec + 50) return false;   // the bots kill 0.1-1.0 per second
    if (r.mode === 'normal' && r.day) return false;
    return true;
}

/** Query parameters for GET /v1/board. */
export function parseBoard(url, now = Date.now()) {
    const mode = oneOf(url.searchParams.get('mode'), MODES, 'normal');
    let day = '';
    if (mode === 'daily') {
        const d = url.searchParams.get('day') || '';
        day = RE_DAY.test(d) && Math.abs(dayNum(d) - Math.floor(now / 864e5)) <= 2 ? d : new Date(now).toISOString().slice(0, 10);
    }
    return { mode, day, limit: int(Number(url.searchParams.get('limit') || 10), 1, 25, 10) };
}

/** POST /v1/event body: { kind: 'session' | 'error', build, env, data } with a small whitelisted payload. */
export function parseEvent(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, why: 'body' };
    const kind = oneOf(body.kind, ['session', 'error']);
    if (!kind || typeof body.build !== 'string' || !RE_BUILD.test(body.build)) return { ok: false, why: 'event' };
    const d = body.data && typeof body.data === 'object' ? body.data : {};
    const data = kind === 'session'
        ? { device: oneOf(d.device, DEVICES), quality: oneOf(d.quality, QUALITIES), w: int(d.w, 0, 10000), h: int(d.h, 0, 10000), dpr: int(d.dpr, 0, 10), lang: typeof d.lang === 'string' ? d.lang.slice(0, 2).toLowerCase().replace(/[^a-z]/g, '') : '', pwa: d.pwa ? 1 : 0, embed: d.embed ? 1 : 0, lowFps: d.lowFps ? 1 : 0 }
        : { msg: String(d.msg ?? '').slice(0, 200), at: String(d.at ?? '').slice(0, 120), scene: String(d.scene ?? '').slice(0, 24) };
    return { ok: true, event: { kind, build: body.build, env: body.env === 'dev' ? 'dev' : 'prod', data } };
}
