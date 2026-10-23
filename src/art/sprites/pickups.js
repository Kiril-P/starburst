// Pickups (owner: pickups/weapons). Format: see ../bake.js.
// Lime = pickups (STYLE.md). What separates a pickup from a hostile lime meteor shard at a glance: pickups have
// the 1px dark outline (bullets never do), twinkle, and power-ups sit in a square capsule with a glyph inside.
// Every pickup has 2 frames (fps in the def): frame 1 is the "glint" state.
import { grid, toRows, outline } from './artKit.js';

// faceted diamond: upper facets bright, lower facets dark, centre ridge = highlight. hw/hh = half extents.
function gem(hw, hh, glint) {
    const w = hw * 2 + 1, h = hh * 2 + 1, g = grid(w + 2, h + 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = x - hw, dy = y - hh;
        if (Math.abs(dx) / (hw + 0.5) + Math.abs(dy) / (hh + 0.5) > 1) continue;
        let ch = dy < 0 ? (dx < 0 ? 'j' : 'L') : (dx < 0 ? 'L' : 'l');
        if (dx === 0) ch = dy < 0 ? 'j' : 'L';
        if (dy > 0 && Math.abs(dx) / (hw + 0.5) + dy / (hh + 0.5) > 0.7) ch = dx <= 0 ? 'l' : 'g';
        g[y + 1][x + 1] = ch;
    }
    const rows = outline(toRows(g));
    if (!glint) return rows;
    // glint: white-hot upper-left facet pixel (+ a tiny cross on the big gem)
    const out = rows.map((r) => [...r]);
    const gx = 1 + hw - Math.max(1, hw >> 1), gy = 1 + hh - Math.max(1, hh >> 1);
    out[gy][gx] = 'w';
    if (hw >= 3) { out[gy - 1][gx] = 'w'; out[gy][gx - 1] = 'j'; out[gy][gx + 1] = 'j'; out[gy + 1][gx] = 'j'; }
    return out.map((r) => r.join(''));
}

// 13x13 capsule: k outline, 1px lime frame lit from the upper-left, near-black glass, 9x9 glyph inside.
function capsule(glyph, hot) {
    const S = 13, g = grid(S, S);
    const inShape = (x, y) => x >= 0 && y >= 0 && x < S && y < S && Math.min(x, S - 1 - x) + Math.min(y, S - 1 - y) >= 2;
    const edge = (x, y, f) => [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([a, b]) => !f(x + a, y + b));
    const inFrame = (x, y) => inShape(x, y) && !edge(x, y, inShape);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (!inShape(x, y)) continue;
        if (edge(x, y, inShape)) g[y][x] = 'k';
        else if (edge(x, y, inFrame)) g[y][x] = x + y < S - 1 ? (hot ? 'j' : 'L') : (hot ? 'L' : 'l');
        else g[y][x] = (x + y) & 1 ? '1' : 'k';
    }
    glyph.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') g[y + 2][x + 2] = ch; }));
    return toRows(g);
}

const GLYPHS = {
    repair: [
        '.........',
        '...gLg...',
        '...LjL...',
        '.gLLjLLg.',
        '.LjjwjjL.',
        '.gLLjLLg.',
        '...LjL...',
        '...gLg...',
        '.........'
    ],
    magnet: [
        '.........',
        '.ww...ww.',
        '.66...66.',
        '.65...54.',
        '.65...54.',
        '.655.544.',
        '..65544..',
        '...444...',
        '.........'
    ],
    bomb: [
        '.......w.',
        '......zA.',
        '.....a...',
        '..aAAa...',
        '.aAzAAa..',
        '.AzAAAay.',
        '.AAAAAay.',
        '.aAAAay..',
        '..aayy...'
    ],
    shield: [
        '.bbbbbbC.',
        '.bCCCCCc.',
        '.bCCwCCc.',
        '.bCCCCCc.',
        '.CCCCCCc.',
        '..CCCCc..',
        '..cCCCc..',
        '...cCc...',
        '....c....'
    ],
    rapid: [
        '....w....',
        '...bCb...',
        '..bC.Cb..',
        '.bC...Cb.',
        '....b....',
        '...bCb...',
        '..bC.Cb..',
        '.bC...Cb.',
        '.........'
    ],
    x2: [
        '.........',
        '.....zAA.',
        '....z...A',
        '........A',
        'A.A...zA.',
        '.z...zA..',
        'A.A.zA...',
        '....zAAAa',
        '.........'
    ]
};

const gemDef = (key, hw, hh) => ({ key, fps: 3, frames: [gem(hw, hh, false), gem(hw, hh, true)] });
const capDef = (id) => ({ key: `pickup_${id}`, fps: 4, frames: [capsule(GLYPHS[id], false), capsule(GLYPHS[id], true)] });

export default [
    gemDef('gem_s', 2, 3),     // 7x9
    gemDef('gem_m', 3, 4),     // 9x11
    gemDef('gem_l', 4, 6),     // 11x15
    ...['repair', 'magnet', 'bomb', 'shield', 'rapid', 'x2'].map(capDef)
];
