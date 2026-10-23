// STARBURST wordmark (owner: art-ui; helper of ui.js, not a sprite module of its own).
// Letters are built on a coarse 5x5 grid of 4px cells (squared sci-fi lettering, Orbitron-like),
// then chamfered at single-pixel resolution, banded cyan->white, bevelled, extruded and outlined.
// An amber lens-flare runs through the A; LOGO_FLARE is where to drop the animated ui_logo_flare.

const W = 224, H = 40;
const GW = 20, GH = 22, CELL_W = [4, 4, 4, 4, 4], CELL_H = [4, 5, 4, 5, 4];
const GAP = 5, TOP = 8, LEFT = 1;

// coarse cells + chamfers [cellCol, cellRow, corner, size] (corner: tl tr br bl) + optional diagonal leg
const GLYPHS = {
    S: { cells: ['XXXXX', 'X....', 'XXXXX', '....X', 'XXXXX'], cut: [[0, 0, 'tl', 5], [4, 4, 'br', 5], [0, 2, 'bl', 3], [4, 2, 'tr', 3]] },
    T: { cells: ['XXXXX', '..X..', '..X..', '..X..', '..X..'], cut: [] },
    A: { cells: ['XXXXX', 'X...X', 'XXXXX', 'X...X', 'X...X'], cut: [[0, 0, 'tl', 6], [4, 0, 'tr', 6]] },
    R: { cells: ['XXXXX', 'X...X', 'XXXX.', 'X....', 'X....'], cut: [[4, 0, 'tr', 5], [3, 2, 'br', 3]], leg: true },
    B: { cells: ['XXXXX', 'X...X', 'XXXX.', 'X...X', 'XXXXX'], cut: [[4, 0, 'tr', 5], [4, 4, 'br', 5], [3, 2, 'tr', 2], [3, 2, 'br', 2]] },
    U: { cells: ['X...X', 'X...X', 'X...X', 'X...X', 'XXXXX'], cut: [[0, 4, 'bl', 5], [4, 4, 'br', 5]] }
};
const WORD = 'STARBURST';

const offs = (arr) => arr.reduce((a, v) => (a.push(a[a.length - 1] + v), a), [0]);
const CX = offs(CELL_W), CY = offs(CELL_H);

function glyphMask(ch) {
    const gdef = GLYPHS[ch];
    const m = Array.from({ length: GH }, () => Array(GW).fill(false));
    gdef.cells.forEach((row, cy) => [...row].forEach((c, cx) => {
        if (c !== 'X') return;
        for (let y = CY[cy]; y < CY[cy + 1]; y++) for (let x = CX[cx]; x < CX[cx + 1]; x++) m[y][x] = true;
    }));
    if (gdef.leg) {
        // R leg: a 5px-wide run sliding right as it descends from the bowl to the baseline
        for (let y = CY[3]; y < GH; y++) {
            const x0 = 10 + Math.round(((y - CY[3]) / (GH - 1 - CY[3])) * 5);
            for (let x = x0; x < Math.min(GW, x0 + 5); x++) m[y][x] = true;
        }
    }
    for (const [cx, cy, corner, size] of gdef.cut) {
        const x0 = CX[cx], x1 = CX[cx + 1] - 1, y0 = CY[cy], y1 = CY[cy + 1] - 1;
        for (let y = y0 - 6; y <= y1 + 6; y++) for (let x = x0 - 6; x <= x1 + 6; x++) {
            if (y < 0 || x < 0 || y >= GH || x >= GW) continue;
            const d = corner === 'tl' ? (x - x0) + (y - y0) : corner === 'tr' ? (x1 - x) + (y - y0)
                : corner === 'br' ? (x1 - x) + (y1 - y) : (x - x0) + (y1 - y);
            const inQuad = corner === 'tl' ? x >= x0 && y >= y0 : corner === 'tr' ? x <= x1 && y >= y0 : corner === 'br' ? x <= x1 && y <= y1 : x >= x0 && y <= y1;
            if (inQuad && d < size) m[y][x] = false;
        }
    }
    return m;
}

// vertical colour bands, top -> bottom (stepped, no smooth gradient)
// white cap, pale-cyan body, a 1px dark 'horizon' line, then saturated cyan (80s chrome, but stepped)
const BAND = (y) => (y < 4 ? 'w' : y < 11 ? 'b' : y === 11 ? 'c' : 'C');
const LIGHTER = { C: 'b', b: 'w', w: 'w', c: 'C' };
const DARKER = { w: 'b', b: 'C', C: 'c', c: 'c' };

function wordmark() {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const solid = Array.from({ length: H }, () => Array(W).fill(false));
    let aX = 0;
    [...WORD].forEach((ch, i) => {
        const ox = LEFT + i * (GW + GAP);
        if (ch === 'A') aX = ox;
        glyphMask(ch).forEach((row, y) => row.forEach((on, x) => { if (on) solid[TOP + y][ox + x] = true; }));
    });
    const S = (x, y) => y >= 0 && y < H && x >= 0 && x < W && solid[y][x];
    // extrusion: 2px of depth under every stroke
    for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) {
        if (S(x, y)) continue;
        if (S(x, y - 1)) g[y][x] = 'c';
        else if (S(x, y - 2)) g[y][x] = 'n';
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!S(x, y)) continue;
        let c = BAND(y - TOP);
        if (!S(x, y - 1)) c = 'w'; // bevel: top faces catch the light
        else if (!S(x - 1, y)) c = LIGHTER[c];
        else if (!S(x + 1, y)) c = DARKER[c];
        else if (!S(x, y + 1)) c = DARKER[c];
        g[y][x] = c;
    }
    // dark outline (8-neighbour, chunky)
    const filled = (x, y) => y >= 0 && y < H && x >= 0 && x < W && g[y][x] !== '.' && g[y][x] !== 'k';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (g[y][x] !== '.') continue;
        for (let dy = -1; dy <= 1 && g[y][x] === '.'; dy++) for (let dx = -1; dx <= 1; dx++) if (filled(x + dx, y + dy)) { g[y][x] = 'k'; break; }
    }
    return { g, flare: { x: aX + 10, y: TOP + 6 } };
}

function lensFlare(g, fx, fy) {
    const put = (x, y, c, front) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        if (!front && g[y][x] !== '.' && g[y][x] !== 'k' && g[y][x] !== 'n') return; // streak passes behind letters
        g[y][x] = c;
    };
    // long thin horizontal streak (behind), dithered tails
    for (let d = 1; d < 58; d++) {
        const c = d < 8 ? 'z' : d < 20 ? 'A' : d < 36 ? 'a' : 'y';
        if (d >= 36 && d % 2) continue;
        if (d >= 48 && d % 4) continue;
        put(fx - d, fy, c, false); put(fx + d, fy, c, false);
    }
    // vertical spike through the A (front, short and bright near the core)
    for (let d = 1; d <= 20; d++) {
        const c = d < 3 ? 'w' : d < 6 ? 'z' : d < 10 ? 'A' : d < 15 ? 'a' : 'y';
        if (d >= 15 && d % 2) continue;
        put(fx, fy - d, c, d < 10); put(fx, fy + d, c, d < 10);
    }
    // core + short diagonals
    put(fx, fy, 'w', true);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(fx + dx, fy + dy, 'w', true);
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put(fx + dx, fy + dy, 'z', true);
    for (const [dx, dy] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) put(fx + dx, fy + dy, 'a', true);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) put(fx + dx, fy + dy, 'z', true);
}

const { g: LOGO_GRID, flare } = wordmark();
lensFlare(LOGO_GRID, flare.x, flare.y);

/** Flare centre in ui_logo pixel coordinates (top-left origin): put ui_logo_flare's centre here. */
export const LOGO_FLARE = flare;

// 24x24 twinkle: 4-point star breathing in and out, diagonals flick on the peak frame
function twinkle(len, diag, core) {
    const N = 24, c = 11, g = Array.from({ length: N }, () => Array(N).fill('.'));
    const ramp = (d, L) => (d <= core ? 'w' : d < L * 0.35 ? 'z' : d < L * 0.6 ? 'A' : d < L * 0.85 ? 'a' : 'y');
    for (let d = 0; d <= len; d++) {
        if (d > len * 0.7 && d % 2) continue;
        const ch = ramp(d, len);
        g[c - d][c] = ch; g[c + d][c] = ch; g[c][c - d] = ch; g[c][c + d] = ch;
    }
    for (let d = 1; d <= diag; d++) {
        const ch = d === 1 ? 'z' : d === 2 ? 'A' : 'a';
        g[c - d][c - d] = ch; g[c + d][c + d] = ch; g[c - d][c + d] = ch; g[c + d][c - d] = ch;
    }
    if (core >= 1) for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) if (g[c + dy][c + dx] === '.') g[c + dy][c + dx] = 'A';
    return g.map((r) => r.join(''));
}

export function logoDefs() {
    return [
        { key: 'ui_logo', rows: LOGO_GRID.map((r) => r.join('')) },
        { key: 'ui_logo_flare', frames: [twinkle(5, 0, 0), twinkle(8, 1, 1), twinkle(11, 3, 1), twinkle(8, 2, 1)], fps: 8 }
    ];
}
