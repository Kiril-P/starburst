// Second wave of hostile ships (sniper, kamikaze, shield carrier, turret, mine layer + mine, splitter + its pods).
// Format: see ../bake.js. Same rules as enemies.js: face DOWN, k outline broken only by emissive parts, hulls in
// violet with magenta energy, amber only where the ship is a warning (sniper lens, mine lights, hazard stripes).
// A few sprites are composed in code (turret barrel rotation, shield arc, splitter cluster) so their geometry stays
// exact; every pixel is still a palette char.
import { expandRows } from '../bake.js';

// left-half authoring + right half one shade darker = light from the upper-left (same trick as enemies.js)
const SHADE = { 6: '5', 5: '4', 4: '3', 3: '2', 2: '1', x: 'V', V: 'v', v: 'u' };
function lit(rows, sym = 'odd') {
    const full = expandRows(rows, sym);
    const half = Math.ceil(full[0].length / 2);
    return full.map((r) => [...r].map((ch, i) => (i >= half && SHADE[ch] ? SHADE[ch] : ch)).join(''));
}
const swap = (rows, map) => rows.map((r) => [...r].map((ch) => map[ch] || ch).join(''));

// ---- tiny char-grid helpers for the composed sprites ------------------------------------------------------
const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const rowsOf = (g) => g.map((r) => r.join(''));
function stamp(g, rows, ox, oy) {
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && g[oy + y] && g[oy + y][ox + x] !== undefined) g[oy + y][ox + x] = ch; }));
}
/** 1px k outline around every filled pixel, except next to emissive chars (they break the silhouette) */
function outline(g, emissive = '') {
    const h = g.length, w = g[0].length, out = g.map((r) => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (g[y][x] !== '.') continue;
        let solid = false, glow = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = g[y + dy]?.[x + dx];
            if (!c || c === '.') continue;
            if (emissive.includes(c)) glow = true; else solid = true;
        }
        if (solid && !glow) out[y][x] = 'k';
    }
    return out;
}

// ---- sniper: swept wings, slim spine, long needle barrel with an amber scope lens ----------------------------
const SNIPER = [
    '.kk....k',
    '.kMk..kx',
    '.kMVk.kx',
    '.kMVVkVx',
    '..kMVVVx',
    '..kMxVVV',
    '...kMxVv',
    '...kMVvp',
    '....kMvm',
    '....kkVM',
    '.....kvq',
    '.....kaz',
    '.....kAw',
    '.....kaz',
    '......k5',
    '......k4',
    '......k5',
    '......k4',
    '......k3',
    '......kA',
    '......kz',
    '.......A'
];

// ---- kamikaze: small spiked drone with a red eye ------------------------------------------------------------
const KAMIKAZE = [
    '.q.....',
    'qMk.kkk',
    '.kMkVxx',
    '..kVxVV',
    '.kVxVpp',
    '.kxVprr',
    '.kxVrRw',
    '.kVVprr',
    '.kVvVpp',
    '..kvvVV',
    '.kMkvvv',
    'qMk.kkk',
    '.q.....'
];

// ---- shield carrier: twin armoured pods around a steel bay; magenta energy arc in front (below) -----------
const CARRIER = [
    '..........kkkkkk',
    '..kkkk...kVxxxxx',
    '.kxVVVk.kVxVVVVV',
    '.kxVVVk.kxVvvvvv',
    '.kxVvVkkkVvkkkkk',
    '.kxVvVxxxVvk5666',
    '.kxVvVVVVVvk4556',
    '.kMVvVvvvvvk3445',
    '.kMVvVkkkkvk2334',
    '.kMVvVk..kVvkkkk',
    '.kMmvVk..kVVvvvv',
    '..kmmk....kVVVmm',
    '...kk......kkkMM'
];
function carrier(hot) {
    const W = 31, g = grid(W, 20);
    stamp(g, lit(CARRIER), 0, 0);
    // shield arc bows downward: high at the pods, lowest under the bay. Two px thick, dithered inner edge.
    const outer = hot ? 'q' : 'M', inner = hot ? 'M' : 'm';
    for (let x = 1; x < W - 1; x++) {
        const d = Math.abs(x - 15) / 14;
        const y = 18 - Math.round(6 * d * d);
        g[y][x] = outer;
        g[y - 1][x] = inner;
        if (!hot && (x & 1) && g[y + 1]) g[y + 1][x] = 'p';   // flickery dithered fringe on the outside
    }
    return rowsOf(g);
}

// ---- turret: steel octagon base, magenta core, four barrels; frames rotate the barrels by 22.5deg ---------
function turret(frame) {
    const S = 25, c = 12, g = grid(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x - c, dy = y - c;
        if (Math.abs(dx) + Math.abs(dy) > 11 || Math.abs(dx) > 8 || Math.abs(dy) > 8) continue;   // octagon
        const l = (-dx - dy) / 16;                          // upper-left light
        const r = Math.hypot(dx, dy);
        g[y][x] = r < 2.2 ? 'q' : r < 3.4 ? 'M' : r < 4.5 ? 'm' : r < 5.4 ? 'k' : l > 0.45 ? '5' : l > 0.1 ? '4' : l > -0.4 ? '3' : '2';
    }
    g[c][c] = 'w';
    const a0 = (frame * Math.PI) / 8;
    for (let k = 0; k < 4; k++) {
        const a = a0 + (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
        for (let d = 5; d <= 12; d++) {
            const x = Math.round(c + ca * d), y = Math.round(c + sa * d);
            if (!g[y] || g[y][x] === undefined) continue;
            g[y][x] = d >= 11 ? 'M' : d >= 9 ? '6' : '4';
        }
    }
    return rowsOf(outline(g, 'M'));
}

// ---- mine layer: flat wide hull, hazard-striped belly, a mine sitting in the open bay ----------------------
const LAYER = [
    '.kkk...........',
    'kxVVk.......kkk',
    'kxVVVk....kkVxx',
    'kxVvVVkkkkVxVVV',
    'kMVvVVxxxxxVvvv',
    'kMVvVVVVVVVVkkk',
    'kMVvvvvvvvvkyAy',
    '.kMmvkkkkvvkAyA',
    '..kk....kvvkkkk',
    '.........kvk.k1',
    '.........kk.k12',
    '...........k12a',
    '...........k12A',
    '............k12',
    '.............kk'
];

// ---- mine: steel ball with four spikes and an amber light (0 = unarmed, 1 = armed, 2 = about to burst) -----
const MINE = [
    '....a....',
    '.a..5..a.',
    '..k654k..',
    '.k65432k.',
    'a543y211a',
    '.k54321k.',
    '..k321k..',
    '.a..2..a.',
    '....a....'
];

// ---- splitter: three fused pods (it is literally three ships); pod = what is left after it breaks ---------
const POD = [
    '...kkkkk...',
    '.kkVxxxVkk.',
    '.kVxVVVVvk.',
    'kVxVmmmVvvk',
    'kVVmMqMmvvk',
    'kVVmqwqmvvk',
    'kvVmMqMmvuk',
    'kvvVmmmvvuk',
    '.kvvvvvvuk.',
    '.kkvvvvukk.',
    '...kkkkk...'
];
function splitter() {
    const g = grid(21, 21);
    stamp(g, POD, 0, 0); stamp(g, POD, 10, 0); stamp(g, POD, 5, 10);
    // glowing seams where the pods are fused: this is where it will crack
    for (const [x, y] of [[10, 4], [10, 5], [10, 6], [9, 10], [11, 10], [8, 11], [12, 11]]) g[y][x] = 'q';
    return rowsOf(g);
}

const PULSE = { q: 'M', M: 'q', w: 'q' };

export default [
    { key: 'enemy_sniper', frames: [lit(SNIPER), lit(swap(SNIPER, { a: 'A', A: 'z', z: 'w', M: 'q' }))] },   // 1 = charging (set by code)
    { key: 'enemy_kamikaze', fps: 10, frames: [lit(KAMIKAZE), lit(swap(KAMIKAZE, { w: 'z', R: 'w', r: 'R', q: 'M', M: 'q' }))] },
    { key: 'enemy_shield', frames: [carrier(false), carrier(true)] },                                        // 1 = shield flash
    { key: 'enemy_turret', frames: [0, 1, 2, 3].map(turret) },                                               // barrel angle 0/22/45/67deg
    { key: 'enemy_minelayer', fps: 4, frames: [lit(LAYER), lit(swap(LAYER, { A: 'z', y: 'a', M: 'q' }))] },
    { key: 'enemy_mine', frames: [swap(MINE, { a: '3' }), swap(MINE, { y: 'A', a: 'A' }), swap(MINE, { y: 'w', a: 'R', 5: 'z' })] },
    { key: 'enemy_splitter', fps: 6, frames: [splitter(), swap(splitter(), PULSE)] },
    { key: 'enemy_splitter_s', fps: 8, frames: [POD, swap(POD, PULSE)] }
];
