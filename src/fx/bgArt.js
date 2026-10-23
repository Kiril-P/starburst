// Procedural pixel art for the Background, generated once per key and cached in the texture manager.
// Every pixel is a palette colour: smooth noise fields are quantised to 3-4 tone ramps with 4x4 Bayer dithering.
// Nebula / star tiles wrap seamlessly in both directions (noise is periodic on a torus) so they scroll forever.
import { PALETTE } from '../art/palette.js';
import { bakeAll } from '../art/bake.js';
import { ditherLevel, rng, smooth, clamp01 } from './dither.js';
import { W, H } from '../config.js';

export const TILE_H = 512;
const BG = '#070b1a';     // the game's clear colour, darkest tone of every gradient

// Biomes: deep = static gradient tones, far/near = nebula ramps (dark -> bright), planet = body ramp + rim light.
export const BIOMES = [
    { name: 'violet', deep: ['u', 'v'], far: ['u', 'v', 'V', 'x'], near: ['v', 'V', 'x', 'x'], planet: ['u', 'v', 'V', 'x', 'q'], seed: 11 },
    { name: 'teal', deep: ['1', 'n'], far: ['1', 'n', '2', 'c'], near: ['n', 'c', 'c', '4'], planet: ['1', 'n', 'c', 'C', 'b'], seed: 23 },
    { name: 'magenta', deep: ['u', 'p'], far: ['u', 'p', 'v', 'V'], near: ['p', 'p', 'm', 'm'], planet: ['u', 'p', 'm', 'M', 'q'], seed: 37 },
    { name: 'dusk', deep: ['u', 'y'], far: ['u', 'v', 'y', 'V'], near: ['y', 'a', 'a', 'A'], planet: ['u', 'y', 'a', 'A', 'z'], seed: 41 },
    { name: 'toxic', deep: ['1', 'g'], far: ['k', '1', '1', '2'], near: ['1', 'g', 'g', 'l'], planet: ['k', 'g', 'l', 'L', 'j'], seed: 53 }
];

// ---- colour + canvas helpers ----------------------------------------------------------------------------
const u32 = (hex) => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
const LUT = Object.fromEntries(Object.entries(PALETTE).filter(([, v]) => v).map(([k, v]) => [k, u32(v)]));
LUT.bg = u32(BG);

function canvasTexture(scene, key, w, h, paint) {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h);
    const img = tex.context.createImageData(w, h);
    paint(new Uint32Array(img.data.buffer), w, h);
    tex.context.putImageData(img, 0, 0);
    tex.refresh();
    return key;
}

// ---- periodic value noise -------------------------------------------------------------------------------
function noise2(seed) {
    const r = rng(seed), vals = new Float32Array(256), perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) { vals[i] = r(); perm[i] = i; }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const h = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
    return (x, y, px, py) => {
        const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
        const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = h(x0, y0) + (h(x1, y0) - h(x0, y0)) * sx, b = h(x0, y1) + (h(x1, y1) - h(x0, y1)) * sx;
        return a + (b - a) * sy;
    };
}
/** fBm on the unit torus (u, v in 0..1), base lattice px x py cells */
function fbm(n, u, v, px, py, oct, gain = 0.5) {
    let s = 0, a = 1, norm = 0;
    for (let o = 0; o < oct; o++) { const k = 1 << o; s += a * n(u * px * k, v * py * k, px * k, py * k); norm += a; a *= gain; }
    return s / norm;
}
/** computes a periodic field at half resolution, returns a bilinear (wrapping) sampler at full resolution */
function field(w, h, fn) {
    const fw = w >> 1, fh = h >> 1, f = new Float32Array(fw * fh);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) f[y * fw + x] = fn(x / fw, y / fh);
    return (x, y) => {
        const gx = x / 2, gy = y / 2, x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0;
        const xa = x0 % fw, xb = (x0 + 1) % fw, ya = y0 % fh, yb = (y0 + 1) % fh;
        const a = f[ya * fw + xa] + (f[ya * fw + xb] - f[ya * fw + xa]) * tx;
        const b = f[yb * fw + xa] + (f[yb * fw + xb] - f[yb * fw + xa]) * tx;
        return a + (b - a) * ty;
    };
}

// ---- biome layers -----------------------------------------------------------------------------------------
/** static, opaque deep-space gradient: a diagonal haze band dithered over the clear colour */
export function gradientTexture(scene, i) {
    const b = BIOMES[i], n = noise2(b.seed * 7 + 1);
    const tones = [LUT.bg, LUT.k, LUT[b.deep[0]], LUT[b.deep[1]]];
    return canvasTexture(scene, `bg_grad_${i}`, W, H, (px) => {
        const f = field(W, H, (u, v) => fbm(n, u, v, 4, 3, 4));
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const band = 1 - Math.abs((x / W) * 0.55 + (y / H) * 0.9 - 0.75) * 1.9;   // diagonal milky-way band
            const g = clamp01(band * 0.55 + (f(x, y) - 0.5) * 0.9 + 0.12);
            px[y * W + x] = tones[ditherLevel(g * g, 3, x, y, 1)];
        }
    });
}

/** scrolling nebula tile. layer 'far' = big dense clouds with dust lanes, 'near' = thin bright filaments */
export function nebulaTexture(scene, i, layer) {
    const b = BIOMES[i], far = layer === 'far';
    const n1 = noise2(b.seed * 13 + (far ? 2 : 3)), n2 = noise2(b.seed * 17 + (far ? 4 : 5)), n3 = noise2(b.seed * 19 + 6);
    const ramp = (far ? b.far : b.near).map((c) => LUT[c]);
    return canvasTexture(scene, `bg_neb_${layer}_${i}`, W, TILE_H, (px) => {
        const f = field(W, TILE_H, (u, v) => {
            // domain warp gives the clouds their swirling, stretched look
            const wu = u + (fbm(n2, u, v, 3, 2, 3) - 0.5) * 0.14, wv = v + (fbm(n2, u + 0.37, v + 0.71, 3, 2, 3) - 0.5) * 0.22;
            const mask = smooth(0.38, 0.72, fbm(n3, u, v, 2, 2, 3));                // where the nebula lives at all
            if (far) {
                const c = fbm(n1, wu, wv, 4, 3, 6, 0.62);
                const dust = smooth(0.5, 0.7, fbm(n2, wu * 1, wv, 6, 5, 3));       // dark lanes cut through
                return smooth(0.3, 0.85, c) * (0.35 + 0.65 * mask) * (1 - 0.75 * dust);
            }
            // bright cloud tops + thin ridged filaments threading between them
            const cloud = smooth(0.56, 0.92, fbm(n1, wu, wv, 5, 4, 6, 0.65));
            const r = 1 - Math.abs(fbm(n1, wu + 0.5, wv, 4, 3, 5) * 2 - 1);
            return Math.max(cloud * 0.95, Math.pow(r, 14) * 0.8) * mask;
        });
        for (let y = 0; y < TILE_H; y++) for (let x = 0; x < W; x++) {
            // near layer stays mostly in the dithered 0..1 band: a see-through veil of gas, solid only at the peaks
            const lv = far ? ditherLevel(f(x, y) * 1.05, 4, x, y, 1.2) : ditherLevel(f(x, y) * 0.75, 4, x, y);
            px[y * W + x] = lv ? ramp[lv - 1] : 0;
        }
    });
}

// ---- stars --------------------------------------------------------------------------------------------------
/** far: many 1px stars; near: fewer 2px stars and 1px-armed crosses. Both tile vertically */
export function starTexture(scene, layer) {
    const far = layer === 'far', r = rng(far ? 101 : 202);
    return canvasTexture(scene, `bg_stars_${layer}`, W, TILE_H, (px) => {
        const put = (x, y, c) => { px[(((y % TILE_H) + TILE_H) % TILE_H) * W + (((x % W) + W) % W)] = LUT[c]; };
        if (far) {
            const cols = ['3', '3', '4', '4', '4', '5', '5', '5', '6', '6', 'x', 'x', 'c', 'b'];
            for (let i = 0; i < 900; i++) put((r() * W) | 0, (r() * TILE_H) | 0, cols[(r() * cols.length) | 0]);
            return;
        }
        for (let i = 0; i < 120; i++) {
            const x = (r() * W) | 0, y = (r() * TILE_H) | 0, k = r();
            if (k < 0.55) { const c = r() < 0.5 ? '5' : '6'; put(x, y, c); put(x + 1, y, c); put(x, y + 1, c); put(x + 1, y + 1, c); }
            else if (k < 0.9) { put(x, y, 'w'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + dy, r() < 0.5 ? '4' : 'x'); }
            else { put(x, y, 'w'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { put(x + dx, y + dy, 'b'); put(x + 2 * dx, y + 2 * dy, '4'); } }
        }
    });
}

// ---- small props: twinkle star, streaks, asteroid chunks, planet (text maps through the normal baker) ------
const STREAK_LENS = [6, 10, 16, 24, 36, 52];
export const streakKey = (i) => `bg_streak_${STREAK_LENS[Math.max(0, Math.min(STREAK_LENS.length - 1, i))]}`;
export const STREAK_COUNT = STREAK_LENS.length;
export const ROCK_KEYS = ['bg_rock_0', 'bg_rock_1', 'bg_rock_2', 'bg_rock_3'];

function streak(len) {
    // bright head at the bottom (they fall), tail fades by stepping down the ramp and dithering out
    const rows = [];
    for (let y = 0; y < len; y++) {
        const t = y / (len - 1);
        rows.push(t > 0.85 ? 'w' : t > 0.6 ? '6' : t > 0.35 ? '5' : (y % 2 === 0 || t > 0.2 ? '4' : '.'));
    }
    return { key: `bg_streak_${len}`, rows };
}

function rock(size, seed) {
    // lumpy sphere: low harmonics bend the outline, a few craters dent the surface, lit from the upper-left
    const r = rng(seed * 97 + 5), c = (size - 1) / 2, R = size / 2 - 1.2;
    const h = [2, 3, 5].map((k) => ({ k, a: (0.06 + r() * 0.08) * (k === 5 ? 0.5 : 1), p: r() * 6.28 }));
    const craters = Array.from({ length: 1 + (size >> 3) }, () => ({ x: c + (r() - 0.5) * R, y: c + (r() - 0.5) * R, r: 1.2 + r() * size * 0.09 }));
    const edge = (a) => R * (0.86 + h.reduce((s, o) => s + o.a * Math.cos(a * o.k + o.p), 0));
    const inside = (x, y) => Math.hypot(x - c, y - c) <= edge(Math.atan2(y - c, x - c));
    const rows = [];
    for (let y = 0; y < size; y++) {
        let row = '';
        for (let x = 0; x < size; x++) {
            if (!inside(x, y)) { row += [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy)) ? 'k' : '.'; continue; }
            const nx = (x - c) / R, ny = (y - c) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            let l = clamp01(-nx * 0.55 - ny * 0.55 + nz * 0.6);
            for (const k of craters) {
                const d = Math.hypot(x - k.x, y - k.y) / k.r;
                if (d < 1) l = d < 0.75 ? l * 0.45 + ((x - k.x) + (y - k.y) > 0 ? 0.25 : 0) : l * 0.8;   // pit, lit far wall
            }
            const rim = l > 0.55 && (!inside(x - 1, y) || !inside(x, y - 1));
            row += rim ? 'x' : ['k', 'u', 'v', 'V'][ditherLevel(l * 1.1, 3, x, y, 0.8)];
        }
        rows.push(row);
    }
    return { key: `bg_rock_${seed}`, rows };
}

function planet(i, D) {
    const b = BIOMES[i], R = D / 2 - 1.5, c = (D - 1) / 2, n = noise2(b.seed * 31), P = b.planet;
    const tones = ['k', P[0], P[1], P[2], P[3]];
    const rows = [];
    for (let y = 0; y < D; y++) {
        let row = '';
        for (let x = 0; x < D; x++) {
            const dx = (x - c) / R, dy = (y - c) / R, d2 = dx * dx + dy * dy;
            if (d2 > 1) { row += '.'; continue; }
            const z = Math.sqrt(1 - d2);
            const light = clamp01(-dx * 0.62 - dy * 0.5 + z * 0.55);                     // upper-left sun
            // latitude bands, slightly wobbly, follow the sphere's curvature
            const lat = Math.asin(Math.max(-1, Math.min(1, dy))) / Math.PI + 0.5;
            const band = fbm(n, lat * 1.0 + dx * 0.03, 0.5, 1, 9, 3);
            const v = clamp01(light * 1.05 + (band - 0.5) * 0.55 * (0.4 + light));
            if (d2 > 0.9 && dx + dy > 0.45) { row += P[2]; continue; }                   // back-lit atmosphere rim
            if (d2 > 0.88 && light > 0.5) { row += P[4]; continue; }                     // bright lit limb
            row += tones[ditherLevel(v, 4, x, y, 1.2)];
        }
        rows.push(row);
    }
    return { key: `bg_planet_${i}`, rows };
}

export function planetKey(scene, i) {
    bakeAll(scene, [planet(i, 84)]);
    return `bg_planet_${i}`;
}

export function bakeProps(scene) { bakeAll(scene, propDefs()); }

export function propDefs() {
    return [
        ...STREAK_LENS.map(streak),
        rock(9, 0), rock(13, 1), rock(17, 2), rock(23, 3),
        {   // twinkling star: dot -> cross -> big cross with diagonals -> cross
            key: 'bg_twinkle', frames: [
                ['.......', '.......', '.......', '...6...', '.......', '.......', '.......'],
                ['.......', '.......', '...5...', '..5w5..', '...5...', '.......', '.......'],
                ['...4...', '.4.b.4.', '...b...', '4bbwbb4', '...b...', '.4.b.4.', '...4...'],
                ['.......', '...4...', '...6...', '.46w64.', '...6...', '...4...', '.......']
            ]
        }
    ];
}
