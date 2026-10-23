// Effects pixel art (owner: fx-bg).
// Small sprites are hand-authored text maps; round/animated ones (glows, rings, explosions) are generated
// procedurally INTO text maps with hard palette quantisation + ordered dithering, so they go through the
// same baker and obey the same rules as hand-placed art (palette chars only, no alpha, no AA).
import { bayer, ditherLevel, rng, clamp01 } from '../../fx/dither.js';

const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const toRows = (g) => g.map((r) => r.join(''));
const set = (g, x, y, ch) => { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; };

// ---- glow halos: white disc fading out by dithered density; tinted + ADD-blended at runtime ----------
function glow(size) {
    const g = grid(size, size), c = (size - 1) / 2, R = size / 2;
    const ramp = ['.', '3', '4', '5', '6', 'w'];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c) / R;
        const v = Math.pow(clamp01(1 - d), 1.7);
        g[y][x] = ramp[ditherLevel(v * 1.15, ramp.length - 1, x, y)];
    }
    return toRows(g);
}

// ---- shockwave: crisp 1px ring around the centre of an even-sized box, eased radius, dissolves at the end
function ring(g, r, ch, keep = 1) {
    const n = g.length, h = n / 2;
    const plot = (ox, oy) => {
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const px = sx > 0 ? h + ox : h - 1 - ox, py = sy > 0 ? h + oy : h - 1 - oy;
            if (keep >= 1 || bayer(px, py) < keep) set(g, px, py, ch);
        }
    };
    // first octant of a circle centred on a pixel corner, mirrored 8 ways -> no doubled diagonal pixels
    for (let x = 0; ; x++) {
        const y = Math.round(Math.sqrt(Math.max(0, r * r - (x + 0.5) * (x + 0.5))) - 0.5);
        if (x > y) break;
        plot(x, y); plot(y, x);
    }
}
function shockwave() {
    const N = 96, frames = [];
    for (let i = 0; i < 12; i++) {
        const t = i / 11, r = 3 + 44 * (1 - Math.pow(1 - t, 2.2));
        const g = grid(N, N);
        const keep = i < 8 ? 1 : 1 - (i - 7) * 0.22;
        if (i < 7) ring(g, r - 1.6, i < 3 ? '5' : '4', keep);        // trailing inner echo
        ring(g, r, i < 5 ? 'w' : i < 9 ? '6' : '5', keep);
        frames.push(toRows(g));
    }
    return frames;
}

// ---- explosions: overlapping fire puffs that expand, cool down the heat ramp and dissolve into smoke -----
// Each frame has its own short colour ramp (cold rim -> hot core); puffs are lit from the upper-left.
const HEAT = [
    ['z', 'w', 'w'],            // 0 flash
    ['a', 'A', 'z', 'w'],       // 1 fireball
    ['R', 'a', 'A', 'z'],       // 2
    ['V', 'r', 'a', 'A'],       // 3 cooling, smoke rim appears
    ['v', 'V', 'r', 'R'],       // 4
    ['u', 'v', 'V', 'r'],       // 5 last embers inside the smoke
    ['u', 'v', 'V', 'x'],       // 6 violet smoke
    ['u', 'v', 'V']             // 7 last wisps
];
function explosion(S, n, seed) {
    const rnd = rng(seed), c = (S - 1) / 2, frames = [];
    const K = Math.round(S / 6) + 4;
    const puffs = Array.from({ length: K }, (_, i) => {
        const a = (i / K) * Math.PI * 2 + rnd() * 0.8;
        return { a, dist: (i === 0 ? 0 : 0.12 + rnd() * 0.17) * S, r: (i === 0 ? 0.2 : 0.1 + rnd() * 0.07) * S, life: 0.35 + rnd() * 0.65 };
    });
    const embers = Array.from({ length: Math.round(S / 4) }, () => ({ a: rnd() * Math.PI * 2, v: 0.28 + rnd() * 0.2 }));
    for (let f = 0; f < n; f++) {
        const t = f / (n - 1), stage = Math.round(t * 7), ramp = HEAT[stage], g = grid(S, S);
        if (stage === 0) { flash(g, S, c); frames.push(toRows(g)); continue; }
        const grow = 1 - Math.pow(1 - t, 1.6);
        const live = puffs.map((p) => {
            const fade = stage < 5 ? 1 : clamp01((p.life - (stage - 4) * 0.22) * 3);  // puffs die off one by one
            return { x: c + Math.cos(p.a) * p.dist * (0.5 + grow), y: c + Math.sin(p.a) * p.dist * (0.5 + grow), r: p.r * (0.95 + grow * 0.75) * (stage >= 5 ? 0.6 + 0.4 * fade : 1) };
        }).filter((p) => p.r > 1.2);
        // keep the cloud inside the frame: shrink the whole frame uniformly if any puff would be clipped
        const ext = Math.max(...live.map((p) => Math.max(Math.abs(p.x - c), Math.abs(p.y - c)) + p.r));
        const k = Math.min(1, (S / 2 - 1.5) / ext);
        for (const p of live) { p.x = c + (p.x - c) * k; p.y = c + (p.y - c) * k; p.r *= k; }
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            // the puff this pixel is deepest inside wins -> bubbly silhouette with visible puff seams
            let best = null, bn = 1;
            for (const p of live) { const nd = Math.hypot(x - p.x, y - p.y) / p.r; if (nd < bn) { bn = nd; best = p; } }
            if (!best) continue;
            if (stage >= 6 && bn > 0.7 && bayer(x, y) < (stage - 5) * 0.45) continue;          // dithered smoke edge
            const lit = 1 - Math.hypot(x - best.x + best.r * 0.35, y - best.y + best.r * 0.35) / (best.r * 1.35); // light from upper-left
            const core = 1 - Math.hypot(x - c, y - c) / (S * 0.5);
            let v = 0.55 * lit + 0.55 * core + 0.1;
            if (bn > 0.82) v -= 0.3;                                                            // darker rim on each puff
            g[y][x] = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(clamp01(v) * ramp.length)))];
        }
        if (stage <= 5) {                                                   // embers flying ahead of the fireball
            for (const e of embers) {
                const r = S * e.v * (0.55 + grow * 0.75);
                const ex = Math.round(c + Math.cos(e.a) * r), ey = Math.round(c + Math.sin(e.a) * r);
                if (ex < 1 || ey < 1 || ex > S - 2 || ey > S - 2 || g[ey][ex] !== '.') continue;
                set(g, ex, ey, stage < 3 ? 'z' : stage < 5 ? 'A' : 'r');
            }
        }
        frames.push(toRows(g));
    }
    return frames;
}
// white-hot flash disc with a star flare (frame 0 of every explosion)
function flash(g, S, c) {
    const R = S * 0.24;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d < R) g[y][x] = d > R - 1.2 ? 'z' : 'w';
    }
    const L = Math.floor(S / 2) - 1, D = Math.round(S * 0.3);
    for (let k = Math.floor(R); k <= L; k++) {
        const ch = k < (R + L) / 2 ? 'w' : 'z';
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(g, Math.round(c + dx * k), Math.round(c + dy * k), ch);
    }
    for (let k = Math.floor(R * 0.72); k <= D; k++) {
        for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) set(g, Math.round(c + dx * k), Math.round(c + dy * k), 'z');
    }
}

// ---- smoke puff (violet), 4 frames: bloom, grow, break up, dissolve
function smoke() {
    const S = 8, c = 3.5, frames = [];
    const ramp = ['v', 'V', 'x'];
    for (let f = 0; f < 4; f++) {
        const g = grid(S, S), r = 2.2 + f * 0.6;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const dist = Math.hypot(x - c, y - c);
            if (dist > r) continue;
            if (f >= 2 && bayer(x + f, y) < (f - 1) * 0.3) continue;
            const v = 1 - Math.hypot(x - c + 1, y - c + 1) / (r + 1.5);
            g[y][x] = ramp[Math.min(2, Math.max(0, Math.floor(v * 3) - (f > 1 ? 1 : 0)))];
        }
        frames.push(toRows(g));
    }
    return frames;
}

export default [
    { key: 'px1', rows: ['w'] },
    { key: 'px2', rows: ['ww', 'ww'] },
    { key: 'px3', rows: ['www', 'www', 'www'] },
    { key: 'glow_s', rows: glow(16) },
    { key: 'glow_m', rows: glow(32) },
    { key: 'glow_l', rows: glow(64) },
    { key: 'shockwave', frames: shockwave(), fps: 24, repeat: 0 },
    // variants recolour the fire ramp for cyan / magenta / lime explosions (smoke stays violet)
    ...[['explosion_s', 24, 6, 7], ['explosion_m', 40, 7, 21], ['explosion_l', 64, 8, 42]].map(([key, S, n, seed]) => ({
        key, frames: explosion(S, n, seed), fps: 16, repeat: 0,
        variants: {
            cyan: { z: 'b', A: 'C', a: 'c', R: 'C', r: 'n' },
            magenta: { z: 'q', A: 'M', a: 'm', R: 'M', r: 'p' },
            lime: { z: 'j', A: 'L', a: 'l', R: 'L', r: 'g' }
        }
    })),
    // debris chunks are authored bright (white/steel) because Fx tints them per material
    { key: 'debris_0', rows: ['w6.', '654', '.43'] },
    { key: 'debris_1', rows: ['.w6.', 'w654', '6543', '.43.'] },
    { key: 'debris_2', rows: ['.w6..', 'w6554', '.5443', '..33.'] },
    { key: 'debris_3', rows: ['.w..', 'w65.', '6544', '.543', '..3.'] },
    { key: 'smoke', frames: smoke(), fps: 10, repeat: 0 },
    {
        key: 'spark', fps: 20, repeat: 0, frames: [
            ['..6..', '..w..', '6www6', '..w..', '..6..'],
            ['5...5', '.6.6.', '..w..', '.6.6.', '5...5'],
            ['.....', '..5..', '.5.5.', '..5..', '.....']
        ]
    }
];
