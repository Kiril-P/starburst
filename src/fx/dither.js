// Shared helpers for procedural pixel art (no Phaser imports: also used by tools/render-sprites.mjs).

// 4x4 ordered Bayer matrix. threshold(x, y) is in (0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/**
 * Quantise v (0..1) into 0..levels with ordered dithering, so gradients become clean pixel patterns.
 * sharp > 0 squeezes the dithered transition into a narrower band -> more solid areas, crisper "posterised" look.
 */
export function ditherLevel(v, levels, x, y, sharp = 0) {
    const s = Math.max(0, Math.min(1, v)) * levels;
    const base = Math.floor(s);
    let f = s - base;
    if (sharp) f = Math.max(0, Math.min(1, (f - 0.5) * (1 + sharp) + 0.5));
    return Math.min(levels, base + (f > bayer(x, y) ? 1 : 0));
}

/** Small deterministic PRNG (mulberry32) so procedural art is identical on every load. */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
