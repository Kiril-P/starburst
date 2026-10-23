// UI kit (owner: art-ui): nine-slice frames, bar, cursor, arrows, checkbox, knob, logo.
//
// Nine-slice rule: corners are 8x8 and drawn once; the middle 8px band of every edge and the centre are
// STRETCHED by Phaser, so they must be uniform along the stretch direction (no dither, no detail there),
// otherwise stretching would produce uneven fat pixels. All detail (chamfers, ticks, glints) lives in corners.
// Centres are solid 'k' (or a dark ramp colour): the game applies the ~85% alpha on the object.
import { logoDefs, LOGO_FLARE } from './logo.js';

export { LOGO_FLARE };

const S = 24;

// Chamfered-rect classifier. cut = [tl, tr, br, bl] chamfer sizes; a pixel is inside when it is in the
// box and not in any corner triangle. Returns a function (x, y) -> boolean.
function shape(x0, y0, w, h, cut) {
    const [tl, tr, br, bl] = cut;
    return (x, y) => {
        const dx = x - x0, dy = y - y0, rx = x0 + w - 1 - x, ry = y0 + h - 1 - y;
        if (dx < 0 || dy < 0 || rx < 0 || ry < 0) return false;
        return dx + dy >= tl && rx + dy >= tr && rx + ry >= br && dx + ry >= bl;
    };
}

// ring distance: 0 = border pixel, 1 = first inner ring, 2+ = deeper (4-neighbour)
function depthOf(inside, x, y) {
    if (!inside(x, y)) return -1;
    for (let d = 0; d < 3; d++) {
        if (!inside(x - d - 1, y) || !inside(x + d + 1, y) || !inside(x, y - d - 1) || !inside(x, y + d + 1)) return d;
    }
    return 3;
}

/**
 * Builds a frame texture map.
 * p: { w, h, cut, top (y offset of the body), depth (3D ledge rows under the body),
 *      border, borderLo (bottom/right border), innerTop, inner, fill, ledge, tick, glint, halo }
 */
function frame(p) {
    const w = p.w ?? S, h = p.h ?? S, top = p.top ?? 0, depth = p.depth ?? 0, inset = p.halo ? 1 : 0;
    const bx = inset, bw = w - inset * 2, by = top + inset, bh = h - top - depth - inset * 2;
    const body = shape(bx, by, bw, bh, p.cut);
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    // ledge: the body silhouette repeated below itself
    for (let d = 1; d <= depth; d++) {
        const ledge = shape(bx, by + d, bw, bh, p.cut);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ledge(x, y)) g[y][x] = p.ledge;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = depthOf(body, x, y);
        if (d < 0) continue;
        const isTop = !body(x, y - 2); // inner pixel sitting right under the top (or top-left chamfer) border
        if (d === 0) g[y][x] = (!body(x, y + 1) || !body(x + 1, y)) && body(x, y - 1) && body(x - 1, y) ? p.borderLo ?? p.border : p.border;
        else if (d === 1) g[y][x] = isTop ? p.innerTop ?? p.inner : p.inner;
        else g[y][x] = p.fill;
    }
    // halo: 1px glow ring just outside the border
    if (p.halo) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (g[y][x] !== '.' || body(x, y)) continue;
            if (body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)) g[y][x] = p.halo;
        }
    }
    // corner ticks: little detached brackets in the big (tl/br) chamfer pockets
    if (p.tick) {
        const [tl, , br] = p.cut;
        if (tl >= 4) [[0, 0], [1, 0], [0, 1]].forEach(([x, y]) => { g[by + y][bx + x] = p.tick; });
        if (br >= 4) [[0, 0], [1, 0], [0, 1]].forEach(([x, y]) => { g[by + bh - 1 - y][bx + bw - 1 - x] = p.tick; });
    }
    // glints: brighter border segments hugging the big chamfers (inside the 8px corner, so they never stretch)
    if (p.glint) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (depthOf(body, x, y) !== 0) continue;
            const dTL = (x - bx) + (y - by), dBR = (bx + bw - 1 - x) + (by + bh - 1 - y);
            if ((dTL <= p.cut[0] + 3 && x < 8 && y < 8) || (dBR <= p.cut[2] + 3 && x >= w - 8 && y >= h - 8)) g[y][x] = p.glint;
        }
    }
    return g.map((r) => r.join(''));
}

const CHAMFER = [5, 2, 5, 2];
const CARD_CUT = [4, 4, 4, 4];

// colour variants for cards so the upgrade screen can colour-code abilities without tinting
const CARD_VARIANTS = {
    magenta: { n: 'p', c: 'm', C: 'M', b: 'q' },
    lime: { n: 'g', c: 'l', C: 'L', b: 'j' },
    amber: { n: 'y', c: 'a', C: 'A', b: 'z' }
};

const FRAMES = [
    { key: 'ui_panel', rows: frame({ cut: CHAMFER, border: 'C', borderLo: 'c', innerTop: 'c', inner: 'n', fill: 'k', tick: 'C', glint: 'b' }) },
    { key: 'ui_panel_active', rows: frame({ cut: CHAMFER, border: 'b', innerTop: 'C', inner: 'c', fill: 'k', tick: 'w', glint: 'w' }) },
    // buttons: body sits 1px above a 1px ledge; hover lifts it 1px more, press drops it onto the ledge
    { key: 'ui_button', rows: frame({ cut: CHAMFER, top: 1, depth: 1, border: 'C', borderLo: 'c', innerTop: 'c', inner: 'n', fill: 'n', ledge: 'n', tick: 'C', glint: 'b' }) },
    { key: 'ui_button_hover', rows: frame({ cut: CHAMFER, top: 0, depth: 2, border: 'b', innerTop: 'C', inner: 'c', fill: 'n', ledge: 'c', tick: 'w', glint: 'w' }) },
    { key: 'ui_button_press', rows: frame({ cut: CHAMFER, top: 2, depth: 0, border: 'C', innerTop: 'k', inner: 'c', fill: 'n', tick: 'b', glint: 'b' }) },
    { key: 'ui_button_disabled', rows: frame({ cut: CHAMFER, top: 1, depth: 1, border: '3', borderLo: '2', innerTop: '2', inner: '1', fill: '1', ledge: '1' }) },
    { key: 'ui_card', rows: frame({ cut: CARD_CUT, halo: null, border: 'c', innerTop: 'n', inner: 'n', fill: 'k', glint: 'C' }), variants: CARD_VARIANTS },
    { key: 'ui_card_hover', rows: frame({ cut: CARD_CUT, halo: 'n', border: 'C', innerTop: 'b', inner: 'c', fill: 'k', glint: 'w' }), variants: CARD_VARIANTS }
];

// ---- small widgets --------------------------------------------------------------------------------

const BAR = [
    '.CbbCCCCCCCCCCCCCCCCbbC.',
    'Cnnnnnnnnnnnnnnnnnnnnnnc',
    'Ckkkkkkkkkkkkkkkkkkkkkkc',
    'Ckkkkkkkkkkkkkkkkkkkkkkc',
    'Ckkkkkkkkkkkkkkkkkkkkkkc',
    'Ckkkkkkkkkkkkkkkkkkkkkkc',
    'Ckkkkkkkkkkkkkkkkkkkkkkc',
    '.cCCcccccccccccccccCCcc.'
];

// greyscale so it tints cleanly; colour variants are true-palette versions (prefer them over tint)
const BAR_FILL = ['ww', '66', '66', '55', '55', '44'];
const FILL_VARIANTS = {
    cyan: { w: 'b', 6: 'C', 5: 'c', 4: 'n' },
    lime: { w: 'j', 6: 'L', 5: 'l', 4: 'g' },
    amber: { w: 'z', 6: 'A', 5: 'a', 4: 'y' },
    magenta: { w: 'q', 6: 'M', 5: 'm', 4: 'p' },
    red: { w: 'R', 6: 'R', 5: 'r', 4: 'p' }
};

// mouse pointer, hotspot (0, 0)
const CURSOR = [
    'k...........',
    'kk..........',
    'kwk.........',
    'kbbk........',
    'kbCbk.......',
    'kbCCbk......',
    'kbCCCbk.....',
    'kbCCCCbk....',
    'kbCCkkkkk...',
    'kbkkCk......',
    'kk..kCk.....',
    '.....kk.....'
];

const ARROW_R = [
    '..kk....',
    '..kbk...',
    '..kCbk..',
    '..kCCbk.',
    '..kCCck.',
    '..kCck..',
    '..kck...',
    '..kk....'
];
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

const CHECK_OFF = [
    '.CCCCCCCC.',
    'CccccccccC',
    'Cnkkkkkknc',
    'Cnkkkkkknc',
    'Cnkkkkkknc',
    'Cnkkkkkknc',
    'Cnkkkkkknc',
    'Cnkkkkkknc',
    'Cnnnnnnnnc',
    '.cccccccc.'
];
const CHECK_ON = [
    '.CCCCCCCC.',
    'CccccccccC',
    'Cnkkkkkknc',
    'CnkwbbCknc',
    'CnkbCCCknc',
    'CnkbCCcknc',
    'CnkCCccknc',
    'Cnkkkkkknc',
    'Cnnnnnnnnc',
    '.cccccccc.'
];

const KNOB = [
    '.kkkkkk.',
    'kw66665k',
    'k66bb54k',
    'k66CC54k',
    'k66CC54k',
    'k66CC54k',
    'k66CC54k',
    'k66CC54k',
    'k66CC54k',
    'k66cc54k',
    'k555543k',
    '.kkkkkk.'
];

const WIDGETS = [
    { key: 'ui_bar_frame', rows: BAR },
    { key: 'ui_bar_fill', rows: BAR_FILL, variants: FILL_VARIANTS },
    { key: 'ui_cursor', rows: CURSOR },
    { key: 'ui_arrow_r', rows: ARROW_R },
    { key: 'ui_arrow_l', rows: mirror(ARROW_R) },
    { key: 'ui_check_off', rows: CHECK_OFF },
    { key: 'ui_check_on', rows: CHECK_ON },
    { key: 'ui_knob', rows: KNOB }
];

export default [...FRAMES, ...WIDGETS, ...logoDefs()];
