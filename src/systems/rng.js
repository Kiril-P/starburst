// Seedable random numbers. Gameplay code that should be reproducible in a Daily Run draws from a named
// *stream* instead of Math.random:
//     import { rngStream } from '../systems/rng.js';
//     const rnd = rngStream('spawns');      // at module level, once
//     rnd()                                 // 0..1, like Math.random()
// While no run seed is set every stream simply calls Math.random(), so normal runs behave exactly as before.
// seedRun(seed) re-seeds every stream (each from seed ^ hash(name)); separate streams keep one system's draws
// (e.g. how often enemies happen to fire) from shifting another's (where the next enemy spawns).
// Purely cosmetic randomness (particles, sfx jitter) should keep using Math.random.

/** mulberry32: tiny, fast, good enough for games. Returns a function -> [0, 1). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** FNV-1a string hash -> uint32 (stable across browsers, used for date seeds and stream names). */
export function hashString(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
}

/** Standalone seeded generator with helpers: { random(), range(a,b), int(a,b) inclusive, pick(arr), chance(p) }. */
export function createRng(seed) {
    const next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
    return {
        random: next,
        range: (a, b) => a + next() * (b - a),
        int: (a, b) => a + Math.floor(next() * (b - a + 1)),
        pick: (arr) => arr[Math.floor(next() * arr.length)],
        chance: (p) => next() < p
    };
}

/** Local calendar date as 'YYYY-MM-DD' (the Daily Run changes at the player's midnight). */
export function dateKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The seed for a given day's Daily Run. */
export const dailySeed = (key = dateKey()) => hashString(`starburst-daily-${key}`);

// ---- run streams ----------------------------------------------------------------------------------------------
let runSeed = null;
const streams = new Map();   // name -> { gen }

/** A named stream function. Safe to create at module load: it follows later seedRun() calls. */
export function rngStream(name) {
    let s = streams.get(name);
    if (!s) {
        s = { gen: null, fn: null };
        s.fn = () => (s.gen ? s.gen() : Math.random());
        streams.set(name, s);
        if (runSeed !== null) s.gen = mulberry32(runSeed ^ hashString(name));
    }
    return s.fn;
}

/** Seed every stream for a reproducible run, or pass null to go back to Math.random. */
export function seedRun(seed) {
    runSeed = seed === null || seed === undefined ? null : seed >>> 0;
    for (const [name, s] of streams) s.gen = runSeed === null ? null : mulberry32(runSeed ^ hashString(name));
}

export const currentSeed = () => runSeed;
