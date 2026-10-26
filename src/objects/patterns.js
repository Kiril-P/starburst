// Bullet pattern library. Every function fires into a BulletPool; angles in radians (0 = right, PI/2 = down).
// Instant patterns: aimed, fan, ring, curtain, burst, lance. Timed patterns (streams, spirals) are built with
// Sequencer.run(), which calls a step function N times at an interval while following its owner.
import { COLORS } from '../art/palette.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// Bullet shapes: base texture, hit radius (smaller than the sprite = fair), whether it rotates to its heading,
// and the colour the base texture is drawn in (see contract.js variant comments + STYLE.md colour meaning).
const SHAPES = {
    orbS: { base: 'bullet_orb_s', r: 2, orient: false, native: 'magenta' },
    orbM: { base: 'bullet_orb_m', r: 2.5, orient: false, native: 'magenta' },
    orbL: { base: 'bullet_orb_l', r: 4, orient: false, native: 'magenta' },
    needle: { base: 'bullet_needle', r: 1.5, orient: true, native: 'amber' },
    ring: { base: 'bullet_ring', r: 3, orient: false, native: 'magenta' },
    shard: { base: 'bullet_shard', r: 2, orient: true, native: 'lime' }
};
const TINT = { magenta: COLORS.M, amber: COLORS.A, lime: COLORS.L, cyan: COLORS.C };

const styleCache = new Map();
/** style('orbM', 'amber') -> { key: 'bullet_orb_m_amber', base, r, orient, fallbackTint } (cached, no allocation per shot) */
export function style(shape, color) {
    const id = `${shape}:${color}`;
    let s = styleCache.get(id);
    if (!s) {
        const sh = SHAPES[shape];
        const c = color || sh.native;
        const key = c === sh.native ? sh.base : `${sh.base}_${c}`;
        s = { key, base: sh.base, r: sh.r, orient: sh.orient, fallbackTint: c === sh.native ? null : TINT[c] };
        styleCache.set(id, s);
    }
    return s;
}

/** Who is firing right now ('basic', 'boss:warden', ...). Enemy / boss updates set it, the Sequencer carries it into delayed
 *  steps, and BulletPool stamps it on each bullet so a hit can be blamed on its source (telemetry only). */
export const origin = { v: '' };

export const angleTo = (x, y, tx, ty) => Math.atan2(ty - y, tx - x);

/** One bullet toward a target. */
export function aimed(pool, x, y, tx, ty, o) {
    return pool.spawn(x, y, angleTo(x, y, tx, ty) + (o.offset || 0), o.speed, o.style, o);
}

/** count bullets spread over `spread` degrees (total) centred on angle. */
export function fan(pool, x, y, angle, o) {
    const n = o.count;
    const step = n > 1 ? (o.spread * DEG) / (n - 1) : 0;
    const a0 = angle - (step * (n - 1)) / 2;
    for (let i = 0; i < n; i++) pool.spawn(x, y, a0 + step * i, o.speed, o.style, o);
}

/** count bullets evenly around a circle, rotated by offset (rad). */
export function ring(pool, x, y, o) {
    const n = o.count;
    const off = o.offset || 0;
    for (let i = 0; i < n; i++) pool.spawn(x, y, off + (TAU * i) / n, o.speed, o.style, o);
}

/** A horizontal line of falling needles centred on x, with an optional safe gap at gapX. They start slow and accelerate. */
export function curtain(pool, x, y, o) {
    const n = o.count;
    const w = o.width;
    for (let i = 0; i < n; i++) {
        const bx = x - w / 2 + (w * i) / Math.max(1, n - 1);
        if (o.gapX !== undefined && Math.abs(bx - o.gapX) < (o.gap || 0) / 2) continue;
        pool.spawn(bx, y, Math.PI / 2 + (o.tilt || 0), o.speed, o.style, o);
    }
}

/** Random burst: count bullets in random directions with random speeds (debris-like). */
export function burst(pool, x, y, o, rnd = Math.random) {
    for (let i = 0; i < o.count; i++) {
        const sp = o.speedMin + rnd() * (o.speedMax - o.speedMin);
        pool.spawn(x, y, rnd() * TAU, sp, o.style, o);
    }
}

/** A lance: count bullets on one heading with speeds speed..speedMax, so they fly as a stretching line (boss beams). */
export function lance(pool, x, y, angle, o) {
    const n = o.count;
    for (let i = 0; i < n; i++) pool.spawn(x, y, angle, o.speed + ((o.speedMax - o.speed) * i) / Math.max(1, n - 1), o.style, o);
}

/**
 * Runs timed patterns. run(owner, everyMs, times, step) calls step(i, x, y) `times` times, every `everyMs`,
 * at the owner's current position; it stops early if the owner dies (owner.alive === false).
 * Pooled task objects, updated with simulation dt, so hit-stop / pause freeze patterns too.
 */
export class Sequencer {
    constructor() { this.tasks = []; this.spare = []; }

    run(owner, everyMs, times, step) {
        const t = this.spare.pop() || {};
        t.owner = owner; t.every = everyMs; t.left = times; t.step = step; t.i = 0; t.wait = 0; t.src = origin.v;
        this.tasks.push(t);
        return t;
    }

    update(dt) {
        const tasks = this.tasks;
        for (let k = tasks.length - 1; k >= 0; k--) {
            const t = tasks[k];
            if (t.owner && t.owner.alive === false) t.left = 0;
            t.wait -= dt;
            while (t.left > 0 && t.wait <= 0) {
                const prev = origin.v;
                origin.v = t.src;
                t.step(t.i++, t.owner ? t.owner.x : 0, t.owner ? t.owner.y : 0);
                origin.v = prev;
                t.left--;
                t.wait += t.every;
            }
            if (t.left <= 0) {
                t.owner = null; t.step = null;
                tasks[k] = tasks[tasks.length - 1];
                tasks.pop();
                this.spare.push(t);
            }
        }
    }

    clear() { for (const t of this.tasks) t.left = 0; }
}

export { DEG, TAU };
