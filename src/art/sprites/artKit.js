// Small authoring kit for pickups.js / weapons.js. Same lighting + outline rules as icons.js (whose helpers are
// private to that module): MASK letters are auto-shaded from the upper-left, everything gets a 1px 'k' outline.
// Not a sprite module itself (not listed in art/index.js).

// mask letter -> [highlight, mid, shade]
export const RAMPS = {
    S: ['6', '5', '3'], T: ['5', '4', '2'],
    Y: ['b', 'C', 'c'], Z: ['C', 'c', 'n'],
    G: ['j', 'L', 'l'], O: ['z', 'A', 'a'],
    P: ['q', 'M', 'm'], H: ['R', 'r', 'p']
};

const solid = (rows, x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';

export function shade(rows) {
    return rows.map((row, y) => [...row].map((ch, x) => {
        const ramp = RAMPS[ch];
        if (!ramp) return ch;
        if (!solid(rows, x, y - 1) || !solid(rows, x - 1, y)) return ramp[0];
        if (!solid(rows, x, y + 1) || !solid(rows, x + 1, y)) return ramp[2];
        return ramp[1];
    }).join(''));
}

/** 4-connected 1px dark outline around every opaque pixel */
export function outline(rows) {
    return rows.map((row, y) => [...row].map((ch, x) => {
        if (ch !== '.') return ch;
        return solid(rows, x, y - 1) || solid(rows, x, y + 1) || solid(rows, x - 1, y) || solid(rows, x + 1, y) ? 'k' : '.';
    }).join(''));
}

export const grid = (w, h, ch = '.') => Array.from({ length: h }, () => Array(w).fill(ch));
export const toRows = (g) => g.map((r) => r.join(''));
/** draw rows onto grid g at (ox, oy); '.' is transparent; out-of-bounds pixels are dropped */
export const stamp = (g, rows, ox, oy) => rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== '.' && g[oy + y] && g[oy + y][ox + x] !== undefined) g[oy + y][ox + x] = ch;
}));
/** shade + outline a mask layer drawn on its own grid, then stamp it */
export const layer = (g, draw) => { const l = grid(g[0].length, g.length); draw(l); stamp(g, outline(shade(toRows(l))), 0, 0); };
export const rect = (l, x, y, w, h, ch) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (l[j]) l[j][i] = ch; };
export const disc = (l, cx, cy, r, ch) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.hypot(x - cx, y - cy) <= r && l[y] && l[y][x] !== undefined) l[y][x] = ch;
    }
};

// 32x32 upgrade-card emblem (identical construction to icons.js card_*): ring in `ramp` = [dark, mid, bright, highlight]
const N = 32, MID = 15.5;
export function emblem(ramp) {
    const [d, m, br, hl] = ramp, g = grid(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x - MID, dy = y - MID, r = Math.hypot(dx, dy);
        if (r > 15.4) continue;
        const lit = dx + dy < -7;
        if (r > 14.4) g[y][x] = lit ? hl : br;
        else if (r > 13.4) g[y][x] = lit ? br : m;
        else if (r > 12.4) g[y][x] = d;
        else if (r > 10.4) g[y][x] = (x + y) & 1 ? 'k' : d;   // dithered inner glow
        else g[y][x] = 'k';
    }
    return g;
}
export const CARD_RAMP = { cyan: 'ncCb', amber: 'yaAz', lime: 'glLj', magenta: 'pmMq' };
