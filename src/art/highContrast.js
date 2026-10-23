// High-contrast enemy bullets (Settings > ENEMY BULLETS). Generated from the authored projectile sprites at bake time,
// so the art-enemies text maps stay the single source and every new bullet/variant gets a high-contrast twin for free.
//   `${key}_hc` : same hue, highlight ramp -> white-hot core, dim rim lifted one step, plus a 1px `k` outline that
//                 separates the bullet from explosions / bright nebula (8-neighbour, so +2px each axis).
//   `${base}_cb`: colour-blind safe: every hostile hue recoloured to the amber/orange ramp (orange vs the player's cyan
//                 is the pair that survives deuteranopia / protanopia / tritanopia), then the same _hc treatment.
// Shapes are untouched (orb / needle / ring / shard), and hit radii live in patterns.js, so this is purely visual.
import { PALETTE } from './palette.js';
import { rasterize } from './bake.js';
import projectiles from './sprites/projectiles.js';

// ramp position of every hostile-hue char: 0 dark, 1 mid, 2 bright, 3 highlight
const RAMPS = ['pmMq', 'yaAz', 'glLj', 'ncCb'];
const STEP = {};
for (const r of RAMPS) [...r].forEach((ch, i) => { STEP[ch] = { ramp: r, i }; });
const AMBER = RAMPS[1];

const toRgb = (ch) => { const h = PALETTE[ch]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
const BY_RGB = new Map(Object.keys(PALETTE).filter((c) => PALETTE[c]).map((c) => [toRgb(c).join(','), c]));

/** RGBA frame -> grid of palette chars ('.' = empty) */
function toChars(px, w, h) {
    const g = [];
    for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            row.push(px[i + 3] ? BY_RGB.get(`${px[i]},${px[i + 1]},${px[i + 2]}`) || 'w' : '.');
        }
        g.push(row);
    }
    return g;
}

/** chars -> recoloured, cored, outlined chars (grid grows by 1px on every side) */
function contrastChars(g, orange) {
    const h = g.length, w = g[0].length;
    const out = Array.from({ length: h + 2 }, () => Array(w + 2).fill('.'));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let ch = g[y][x];
        const s = STEP[ch];
        if (s) {
            const ramp = orange ? AMBER : s.ramp;
            // highlight -> white core; dark rim lifted to mid so the silhouette edge is bright against the outline
            ch = s.i === 3 ? 'w' : ramp[Math.max(1, s.i)];
        }
        out[y + 1][x + 1] = ch;
    }
    const filled = (x, y) => x >= 0 && y >= 0 && x < w + 2 && y < h + 2 && out[y][x] !== '.' && out[y][x] !== 'k';
    for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
        if (out[y][x] !== '.') continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && filled(x + dx, y + dy)) { near = true; break; }
        if (near) out[y][x] = 'k';
    }
    return out.map((r) => r.join(''));
}

/** Every generated sprite as { key, rows } (single frame). Shared by the game and tools/render-sprites.mjs. */
export function contrastDefs() {
    const defs = [];
    for (const def of projectiles) {
        if (!def.key.startsWith('bullet_')) continue;
        for (const spr of rasterize(def)) {
            const g = toChars(spr.frames[0], spr.w, spr.h);
            defs.push({ key: `${spr.key}_hc`, rows: contrastChars(g, false) });
            if (spr.key === def.key) defs.push({ key: `${def.key}_cb`, rows: contrastChars(g, true) });
        }
    }
    return defs;
}

/**
 * Texture key + tint for an enemy-bullet style in the given mode ('off' | 'hc' | 'cb'), or null to use the normal one.
 * Missing colour variants fall back to the base's _hc texture with the style's tint (like BulletPool.resolve does).
 */
export function contrastTexture(textures, style, mode) {
    if (mode === 'off' || !style.base || !style.base.startsWith('bullet_')) return null;
    if (mode === 'cb') return textures.exists(`${style.base}_cb`) ? { key: `${style.base}_cb`, tint: null } : null;
    if (textures.exists(`${style.key}_hc`)) return { key: `${style.key}_hc`, tint: null };
    return textures.exists(`${style.base}_hc`) ? { key: `${style.base}_hc`, tint: style.fallbackTint ?? null } : null;
}
