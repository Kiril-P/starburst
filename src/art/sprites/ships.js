// Player-side pixel art: the three hero ships (+ bank frames and 64px menu versions),
// engine flames, forcefield bubble and the player's shot / muzzle / impact sprites.
//
// Ships are authored as LEFT halves (centre column last) of PLATE maps: upper-case letters
// are hull plates (see PLATES for their base steel tone), any palette char is drawn verbatim
// (glass, emissive lights, hand-placed panel lines). `plate()` mirrors the half, bevels every
// plate (light from the upper-left: lit top/left edges, shaded bottom/right edges, so adjoining
// plates get a seam) and adds the 1px 'k' outline. Bank frames reuse the same map with the
// near wing squeezed and darkened, so all three frames stay consistent.

// ---- plate shader ---------------------------------------------------------------------------

const STEEL = '123456';
// base steel tone per plate letter (pairs share a tone so neighbouring plates still get a seam)
const PLATES = { O: 6, P: 6, S: 5, T: 5, W: 5, X: 5, H: 4, I: 4, E: 4, J: 4, G: 3, F: 3, K: 3, D: 2, B: 2, U: 2, Z: 1 };
const EMISSIVE = new Set([...'nbcCaAzyglLjw']);

const mirror = (half) => half.map((r) => r + [...r.slice(0, -1)].reverse().join(''));

// remove the given half-columns (wing span) and pad on the outside so width is kept
const squeeze = (half, cols) => half.map((r) => '.'.repeat(cols.length) + [...r].filter((_, i) => !cols.includes(i)).join(''));

function bevel(rows, bias = [0, 0]) {
    const h = rows.length, w = rows[0].length, mid = (w - 1) / 2;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
    return rows.map((r, y) => [...r].map((ch, x) => {
        const base = PLATES[ch];
        if (base === undefined) return ch;
        let t = base;
        if (at(x, y - 1) !== ch) t += 1;
        if (at(x - 1, y) !== ch) t += 1;
        if (at(x, y + 1) !== ch) t -= 1;
        if (at(x + 1, y) !== ch) t -= 1;
        if (x < mid) t += bias[0];
        if (x > mid) t += bias[1];
        return STEEL[Math.max(0, Math.min(5, t - 1))];
    }).join(''));
}

// 1px dark outline around the silhouette. Emissive pixels "break" the outline: a transparent
// pixel whose only solid neighbours are emissive stays transparent.
function outline(rows, ch = 'k') {
    const h = rows.length, w = rows[0].length;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
    return rows.map((r, y) => [...r].map((c, x) => {
        if (c !== '.') return c;
        const nb = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((n) => n !== '.' && n !== ch);
        return nb.length && nb.some((n) => !EMISSIVE.has(n)) ? ch : '.';
    }).join(''));
}

// full frame from a half map. sqL/sqR: half-columns removed on each side, bias: tone shift per side
// post(rows) may paint asymmetric details (glints) onto the shaded frame before the outline
function plate(half, { sqL = [], sqR = [], bias = [0, 0], post } = {}) {
    const L = mirror(squeeze(half, sqL)), R = mirror(squeeze(half, sqR));
    const c = (L[0].length - 1) / 2;
    let rows = bevel(L.map((r, y) => r.slice(0, c + 1) + R[y].slice(c + 1)), bias);
    if (post) rows = post(rows);
    return outline(rows);
}

// frame 0 straight, 1 bank left (left wing dips away from the light), 2 bank right
const shipFrames = (half, near, far) => [
    plate(half),
    plate(half, { sqL: near, sqR: far, bias: [-1, 1] }),
    plate(half, { sqL: far, sqR: near, bias: [1, -1] })
];

// ---- small raster helpers for the procedural sprites ------------------------------------------

function canvas(w, h) {
    const px = Array.from({ length: h }, () => Array(w).fill('.'));
    const g = {
        w, h, px,
        set(x, y, ch) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h && ch) px[y][x] = ch; return g; },
        get: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? px[y][x] : '.'),
        rows: () => px.map((r) => r.join(''))
    };
    return g;
}

// deterministic per-sprite noise so the art is identical on every bake
const hash = (x, y, s = 0) => {
    let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

// ---- engine flames: jets point DOWN, white-hot at the nozzle, cooling to the dark ramp step ---
// ramp = [dark, mid, bright, highlight]; jets = [{ x: left column, w: width }]
const RAMPS = { cyan: 'ncCb', lime: 'glLj', amber: 'yaAz' };
const LENS = [1, 0.8, 0.92, 0.7];

// colour run for one jet column: [char, share of the column length] (white core only on hot columns)
const HOT = [['w', 0.28], [3, 0.22], [2, 0.25], [1, 0.15], [0, 0.1]];
const WARM = [['w', 0.12], [3, 0.3], [2, 0.28], [1, 0.18], [0, 0.12]];
const SIDE = [[3, 0.3], [2, 0.35], [1, 0.22], [0, 0.13]];

function jetColumn(g, x, len, run, ramp) {
    let y = 0;
    for (const [c, share] of run) {
        const n = Math.max(1, Math.round(len * share));
        for (let i = 0; i < n && y < len; i++) g.set(x, y++, typeof c === 'number' ? ramp[c] : c);
    }
}

// jets = [{ x: left column, w: 2 | 3 | 5, hot: 'l' | 'r' (2-wide only: the column nearer the hull centre) }]
function flameFrames(w, h, ramp, jets, len) {
    return LENS.map((k, f) => {
        const g = canvas(w, h);
        for (const [ji, j] of jets.entries()) {
            const L = Math.max(4, Math.round(len * k * (ji % 2 && f % 2 ? 0.9 : 1)));
            const cols = j.w === 2 ? (j.hot === 'l' ? [[HOT, 1], [SIDE, 0.75]] : [[SIDE, 0.75], [HOT, 1]])
                : j.w === 3 ? [[SIDE, 0.62], [HOT, 1], [SIDE, 0.62]]
                : [[SIDE, 0.45], [WARM, 0.78], [HOT, 1], [WARM, 0.78], [SIDE, 0.45]];
            cols.forEach(([run, s], i) => jetColumn(g, j.x + i, Math.round(L * s), run, ramp));
            // dark-ramp halo hugging the hot root
            const halo = Math.round(L * 0.3);
            for (let y = 0; y < halo; y++) for (const x of [j.x - 1, j.x + j.w]) if (g.get(x, y) === '.') g.set(x, y, ramp[0]);
            // a detached ember trailing the jet, different each frame
            const cx = j.x + (j.w === 2 ? (j.hot === 'l' ? 0 : 1) : (j.w - 1) / 2);
            const ey = L + 1 + ((f + ji) % 3);
            if (ey < h && f !== 3) g.set(cx, ey, ramp[f % 2 ? 1 : 2]);
        }
        return g.rows();
    });
}

// ---- NORMAL: balanced silver twin-engine fighter, cyan accents -----------------------------
const NORMAL = [
    '.............',
    '............S',
    '............S',
    '...........SS',
    '...........SS',
    '...........SS',
    '..........SSS',
    '..........SSb',
    '..........SbC',
    '.........SSCC',
    '.........SScC',
    '.........WSnc',
    '........WWSDn',
    '.......WWWSDD',
    '......WWWWSDc',
    '.....WWWWWSDC',
    '....WWWWWWSDC',
    '...WWWWWEESDc',
    '..WWWWWWEESDD',
    '.WWWWWWWEESDD',
    '.WWWWWWWEESDD',
    '.CWWW..EEESDD',
    '.cWW...EEESDD',
    '.WW....EEE.DD',
    '.W.....EEE.D.',
    '.......212...',
    '.......cCc...',
    '........b....'
];

// ---- SPEEDY: slim swept needle, lime accents ------------------------------------------------
const SPEEDY = [
    '...........',
    '..........S',
    '..........S',
    '..........S',
    '..........S',
    '.........SS',
    '.........SS',
    '.........SS',
    '.........Sb',
    '.........bC',
    '........SCC',
    '........ScC',
    '.......WSnc',
    '......WWSDn',
    '.......WSDD',
    '.......WSDl',
    '......WWSDL',
    '......lWSDl',
    '.....WlWSDD',
    '....WWlWSDD',
    '....WlWWSDD',
    '...WWlWWSDD',
    '..WWlWWEESD',
    '..WlWW.EESD',
    '.WWWW..EESD',
    '.WWW...EE.D',
    '.lW....21..',
    '.L.....Ll..'
];

// ---- TANK: wide armoured gunship, amber accents ---------------------------------------------
const TANK = [
    '................',
    '.........AA.....',
    '.........GG.....',
    '.........GG.....',
    '.........GG...SS',
    '........HHHH.SSS',
    '........HHHHSSSS',
    '........HHHHSSSb',
    '........HHHHSSbC',
    '.A.....HHHHHSSCC',
    '.aW....HHHHHSScC',
    '.aWW...HHHHHSSnc',
    '.aWWW..HHHHHDDDn',
    '.aWWWW.HHHHHDDDD',
    '.WWWWWWHHHHHDDDa',
    '.WWWWWWHHHHHDDDA',
    '.WWWWWWIIIIIDDDA',
    '.WWWWWWIIIIIDDDa',
    '.WWWWWWI22IIDDDD',
    '.WWWWWWIIIIIDDDD',
    '..WWWWWI22IIDDDD',
    '...WWWWIIIIIDDDD',
    '....WWWI22IIDDDD',
    '.......IIIIIDDEE',
    '.......IIIIIDDEE',
    '........IIII..EE',
    '........2112..21',
    '........2112..21',
    '.........aA...aA',
    '.........Az....z'
];

// ---- forcefield bubble: hard cyan rim, dithered fresnel inside, faint hex cells, pulse ring ----
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)] / 16;

// hex-cell edges: a point is on an edge when its two nearest cell centres are about equally far
function hexEdge(x, y, size) {
    const cells = [];
    const r0 = Math.round(y / (1.5 * size));
    for (let r = r0 - 2; r <= r0 + 2; r++) {
        const q0 = Math.round(x / (Math.sqrt(3) * size) - r / 2);
        for (let q = q0 - 2; q <= q0 + 2; q++) cells.push(Math.hypot(x - Math.sqrt(3) * size * (q + r / 2), y - 1.5 * size * r));
    }
    cells.sort((m, n) => m - n);
    return cells[1] - cells[0];
}

function shieldFrames(S = 44, frames = 4) {
    const c = (S - 1) / 2, R = S / 2 - 1;
    return Array.from({ length: frames }, (_, f) => {
        const g = canvas(S, S);
        const pulse = 3 + f * (R - 6) / (frames - 1);       // energy ring sweeping out from the core
        const glint = -Math.PI * 0.75 + f * Math.PI / 2;    // sparkle running round the rim
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
            if (d > R + 0.5) continue;
            const a = Math.atan2(dy, dx);
            const lit = (-dx - dy) / (d || 1);              // +1 upper-left, -1 lower-right
            const ga = Math.abs(Math.atan2(Math.sin(a - glint), Math.cos(a - glint)));
            const edge = hexEdge(dx, dy, 4.6) < 1.0;
            const inPulse = Math.abs(d - pulse) < 1.6;
            let ch = '.';
            if (d > R - 0.7) ch = ga < 0.3 ? 'w' : ga < 0.55 ? 'b' : lit > 0.55 ? 'b' : lit < -0.45 ? 'c' : 'C';
            else if (d > R - 1.7) ch = (x + y) % 2 ? (lit > 0.3 ? 'C' : 'c') : (edge ? 'n' : '.');
            // cells fade out towards the middle so the ship inside stays readable
            else if (edge) ch = inPulse ? (d > R * 0.4 ? 'C' : 'c') : d > R - 7 ? ((x + y) % 2 ? 'c' : 'n') : d > R * 0.45 && (x + y) % 2 ? 'n' : '.';
            else if (d > R - 3.2 && bayer(x, y) < 0.125) ch = 'n';
            g.set(x, y, ch);
        }
        return g.rows();
    });
}

// ---- player shot, muzzle flash, impact spark (no outline: core -> bright -> rim) -------------
const PSHOT = [
    '.b.',
    'bwb',
    'CwC',
    'CwC',
    'CbC',
    'cCc',
    'cCc',
    'nCn',
    '.c.'
];

const MUZZLE = [[
    '....C....',
    '....b....',
    '..c.b.c..',
    '...bwb...',
    '.CbwwwbC.',
    '...bwb...',
    '..c.C.c..',
    '....c....',
    '.........'
], [
    '.........',
    '....c....',
    '....C....',
    '..cCbCc..',
    '.c.bwb.c.',
    '...CbC...',
    '....c....',
    '.........',
    '.........'
], [
    '.........',
    '....n....',
    '...c.c...',
    '.........',
    '..n.C.n..',
    '.........',
    '...c.c...',
    '.........',
    '.........'
]];

const HIT = [[
    '...........',
    '...........',
    '.....c.....',
    '..c..C..c..',
    '...cbwbc...',
    '..cCwwwCc..',
    '...cbwbc...',
    '..c..C..c..',
    '.....c.....',
    '...........',
    '...........'
], [
    '...........',
    '.....c.....',
    '.c...C...c.',
    '..C..b..C..',
    '...b.b.b...',
    '.cCbbwbbCc.',
    '...b.b.b...',
    '..C..b..C..',
    '.c...C...c.',
    '.....c.....',
    '...........'
], [
    '.....c.....',
    '.....C.....',
    '.C.......C.',
    '..c.....c..',
    '.....n.....',
    'cC..n.n..Cc',
    '.....n.....',
    '..c.....c..',
    '.C.......C.',
    '.....C.....',
    '.....c.....'
], [
    '...........',
    '.n...c...n.',
    '...........',
    '...........',
    '...........',
    '.c.......c.',
    '...........',
    '...........',
    '...........',
    '.n...c...n.',
    '...........'
]];

// ---- 64px hero ships: plates drawn as polygons on a half canvas (x = 31 is the centre line) ---

// ch may be a function (x, y) -> char, e.g. a cylinder's per-column tones
function poly(g, ch, pts) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) g.set(x, y, typeof ch === 'function' ? ch(x, y) : ch);
    }
}
// cylinder: tones by column, left to right, starting at column x0
const cyl = (x0, tones) => (x) => tones[Math.max(0, Math.min(tones.length - 1, x - x0))];
function line(g, ch, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) g.set(x0 + ((x1 - x0) * i) / (n || 1), y0 + ((y1 - y0) * i) / (n || 1), ch);
}
const rect = (g, ch, x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.set(x + i, y + j, ch); };
// paint a list of [x, y, rowString] stamps (rowString may span several rows separated by '|')
const stamp = (g, x, y, art) => art.split('|').forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && g.set(x + i, y + j, ch)));

// 63px wide art + one transparent column so the texture is the contract's 64x64
const pad64 = (rows) => rows.map((r) => r + '.');
// paint over the FULL frame (asymmetric details); fn gets a canvas wrapping the rows
function overlay(fn) {
    return (rows) => {
        const g = canvas(rows[0].length, rows.length);
        rows.forEach((r, y) => [...r].forEach((ch, x) => g.set(x, y, ch)));
        fn(g);
        return g.rows();
    };
}

function bigPlume(g, cx, y0, w, len, ramp) {
    // short static exhaust under a hero ship: white core, accent sheath, dark tip
    for (let i = 0; i < w; i++) {
        const d = Math.abs(i - (w - 1) / 2) / ((w + 1) / 2);
        const L = Math.round(len * (1 - d * 0.7));
        for (let y = 0; y < L; y++) {
            const t = y / L;
            const ch = d < 0.4 && t < 0.45 ? 'w' : t < 0.55 ? ramp[3] : t < 0.8 ? ramp[2] : t < 0.93 ? ramp[1] : ramp[0];
            g.set(cx - (w - 1) / 2 + i, y0 + y, ch);
        }
    }
}

function normalBig() {
    const g = canvas(32, 64);
    // wing: bright 45deg leading-edge plate, main plate, darker inner plate; tip points down
    poly(g, 'W', [[25, 22], [3, 44], [3, 56], [5, 56], [11, 50], [19, 50], [19, 26]]);
    poly(g, 'O', [[25, 22], [3, 44], [3, 47], [25, 25]]);
    poly(g, 'I', [[19, 32], [11, 40], [11, 48], [19, 48]]);
    line(g, 'c', 19, 31, 11, 39);
    stamp(g, 3, 49, 'C|b|C|n');
    rect(g, '3', 6, 50, 1, 3);
    // engine pod
    poly(g, cyl(17, '4565432'), [[17, 31], [19, 28], [22, 28], [24, 31], [24, 55], [17, 55]]);
    stamp(g, 18, 28, '.kkk.|k111k|.222.');
    rect(g, '2', 17, 40, 7, 1); rect(g, '2', 17, 46, 7, 1);
    poly(g, cyl(17, '3454321'), [[17, 51], [24, 51], [24, 55], [17, 55]]);
    rect(g, '1', 17, 50, 7, 1);
    stamp(g, 18, 55, 'nnnnn|ncCcn');
    // body side panels + dark spine with the cyan reactor
    poly(g, cyl(24, '5543'), [[26, 17], [24, 23], [24, 54], [28, 56], [28, 17]]);
    rect(g, 'D', 28, 25, 4, 31);
    rect(g, '2', 25, 30, 2, 1); rect(g, '2', 25, 33, 2, 1); rect(g, '2', 25, 36, 2, 1);
    stamp(g, 29, 29, '..n|.nc|ncC|cCb|ncw|cCb|ncC|.nc|..n');
    rect(g, 'B', 29, 41, 3, 1); rect(g, 'B', 29, 44, 3, 1); rect(g, 'B', 29, 47, 3, 1);
    // nose + canopy: lit ridge facet on top of the nose plate
    poly(g, 'S', [[32, 0], [31, 0], [28, 9], [26, 17], [26, 27], [32, 27]]);
    poly(g, 'O', [[31, 1], [29, 8], [29, 12], [32, 12], [32, 1]]);
    poly(g, 'T', [[29, 20], [27, 23], [27, 27], [32, 27], [32, 20]]);
    stamp(g, 28, 9, '...b|..bb|.bbC|.bCC|bCCC|bCCC|CCCC|cCCC|ccCC|ncCc|.ncc|..nc');
    return g.rows();
}

function speedyBig() {
    const g = canvas(32, 64);
    // cranked delta: 45deg inboard, steep 1:2 outboard, 2:1 trailing edge back to the engines
    poly(g, 'W', [[25, 27], [15, 37], [5, 57], [5, 61], [7, 61], [23, 53], [23, 30]]);
    poly(g, 'O', [[25, 27], [15, 37], [5, 57], [5, 60], [15, 40], [25, 30]]);
    poly(g, 'I', [[22, 40], [17, 45], [11, 57], [22, 51.5]]);
    line(g, 'l', 22, 38, 17, 43); line(g, 'l', 17, 43, 11, 55);
    stamp(g, 5, 59, 'L|j');
    rect(g, '3', 9, 57, 3, 1);
    // forward strakes
    poly(g, 'T', [[26, 24], [21, 33], [21, 35], [26, 31]]);
    // twin engines tucked against the body
    poly(g, cyl(21, '45643'), [[21, 38], [22, 35], [24, 35], [26, 38], [26, 57], [21, 57]]);
    stamp(g, 22, 36, '212');
    rect(g, '2', 21, 44, 5, 1); rect(g, '2', 21, 49, 5, 1);
    poly(g, cyl(21, '34532'), [[21, 53], [26, 53], [26, 57], [21, 57]]);
    rect(g, '1', 21, 52, 5, 1);
    stamp(g, 22, 57, 'ggg');
    // slim body + spine with lime cells
    poly(g, cyl(26, '5543'), [[28, 20], [26, 28], [26, 56], [29, 58], [29, 20]]);
    rect(g, 'D', 29, 27, 3, 31);
    stamp(g, 30, 31, '.g|gl|lL|lj|lL|gl|.g');
    stamp(g, 30, 41, 'gl|.g|gl|.g|gl|.g');
    rect(g, '2', 27, 33, 2, 1); rect(g, '2', 27, 36, 2, 1);
    // needle nose + canopy
    poly(g, 'S', [[32, 0], [31, 0], [29.5, 10], [28, 20], [27, 30], [32, 30]]);
    poly(g, 'O', [[31, 1], [30.2, 8], [30, 15], [32, 15], [32, 1]]);
    poly(g, 'T', [[30, 24], [28, 27], [28, 31], [32, 31], [32, 24]]);
    stamp(g, 29, 14, '..b|.bb|.bC|bCC|bCC|CCC|CCC|cCC|cCC|ncC|.nc|..n');
    return g.rows();
}

function tankBig() {
    const g = canvas(32, 64);
    // forward-pointing armour blades with amber leading edges
    poly(g, 'W', [[5, 11], [3, 14], [3, 44], [13, 52], [14, 52], [14, 27]]);
    poly(g, 'I', [[3, 34], [3, 44], [13, 52], [14, 52], [14, 42]]);
    line(g, 'a', 3, 14, 3, 31); stamp(g, 4, 11, 'A|a'); g.set(3, 13, 'A'); g.set(4, 13, 'a');
    line(g, 'y', 4, 15, 4, 30);
    stamp(g, 6, 36, 'kk|..|kk|..|kk');
    // armoured shoulder pods, three plates
    poly(g, 'X', [[14, 14], [16, 12], [23, 12], [25, 14], [25, 28], [14, 28]]);
    poly(g, 'J', [[14, 29], [25, 29], [25, 43], [14, 43]]);
    poly(g, 'K', [[14, 44], [25, 44], [25, 53], [23, 55], [16, 55], [14, 53]]);
    stamp(g, 15, 16, 'ya.ya.ya|a.ya.ya.y');
    for (const y of [32, 35, 38]) rect(g, '1', 16, y, 7, 1), rect(g, '2', 16, y + 1, 7, 1);
    stamp(g, 15, 46, 'kk.......kk');
    // twin cannons with glowing amber muzzles
    poly(g, cyl(17, '35643'), [[17, 3], [22, 3], [22, 13], [17, 13]]);
    rect(g, '2', 17, 7, 5, 1); rect(g, 'k', 17, 11, 5, 1);
    stamp(g, 17, 0, '.zAz.|aAzAa|yaAay');
    // pod nozzles
    poly(g, cyl(16, '2345432'), [[16, 55], [23, 55], [23, 58], [16, 58]]);
    stamp(g, 17, 58, 'yaaay');
    // centre hull: domed nose, canopy, dark spine with amber reactor, centre engine
    poly(g, 'S', [[32, 6], [29, 7], [26, 10], [25, 14], [25, 32], [32, 32]]);
    poly(g, 'O', [[32, 7], [29, 8], [27, 11], [27, 13], [32, 13]]);
    stamp(g, 27, 13, '..bbb|.bbCC|.bCCC|bCCCC|bCCCC|CCCCC|cCCCC|ccCCC|ncccC|.nncc|...nn');
    rect(g, 'D', 26, 32, 6, 21);
    stamp(g, 29, 34, '..y|.ya|yaA|yAz|yaA|.ya|..y');
    for (const y of [43, 45, 47]) rect(g, 'U', 27, y, 5, 1);
    poly(g, cyl(27, '23454'), [[27, 52], [32, 52], [32, 58], [27, 58]]);
    stamp(g, 28, 58, 'yaaa');
    return g.rows();
}

export default [
    { key: 'ship_normal', frames: shipFrames(NORMAL, [2, 4], [3]) },
    { key: 'ship_speedy', frames: shipFrames(SPEEDY, [2, 4], [3]) },
    { key: 'ship_tank', frames: shipFrames(TANK, [2, 4], [3]) },
    // jet columns line up with each hull's nozzles when the flame is centred under the ship
    { key: 'flame_normal', fps: 14, frames: flameFrames(13, 14, RAMPS.cyan, [{ x: 1, w: 3 }, { x: 9, w: 3 }], 12) },
    { key: 'flame_speedy', fps: 14, frames: flameFrames(11, 16, RAMPS.lime, [{ x: 2, w: 2, hot: 'r' }, { x: 7, w: 2, hot: 'l' }], 15) },
    { key: 'flame_tank', fps: 14, frames: flameFrames(17, 14, RAMPS.amber, [{ x: 2, w: 2, hot: 'r' }, { x: 6, w: 3 }, { x: 13, w: 2, hot: 'l' }], 12) },
    { key: 'ship_normal_big', rows: pad64(plate(normalBig(), {
        bias: [0, -1],
        post: overlay((g) => { bigPlume(g, 20, 57, 5, 7, RAMPS.cyan); bigPlume(g, 42, 57, 5, 7, RAMPS.cyan); g.set(29, 11, 'w'); g.set(29, 12, 'w'); })
    })) },
    { key: 'ship_speedy_big', rows: pad64(plate(speedyBig(), {
        bias: [0, -1],
        post: overlay((g) => { bigPlume(g, 23, 58, 4, 6, RAMPS.lime); bigPlume(g, 39, 58, 4, 6, RAMPS.lime); g.set(30, 16, 'w'); g.set(30, 17, 'w'); })
    })) },
    { key: 'ship_tank_big', rows: pad64(plate(tankBig(), {
        bias: [0, -1],
        post: overlay((g) => { bigPlume(g, 19, 59, 5, 5, RAMPS.amber); bigPlume(g, 43, 59, 5, 5, RAMPS.amber); bigPlume(g, 31, 59, 7, 5, RAMPS.amber); g.set(28, 15, 'w'); g.set(29, 14, 'w'); })
    })) },
    { key: 'shield_ring', fps: 10, frames: shieldFrames(44, 4) },
    { key: 'pshot_basic', rows: PSHOT },
    { key: 'pshot_muzzle', fps: 24, repeat: 0, frames: MUZZLE },
    { key: 'pshot_hit', fps: 20, repeat: 0, frames: HIT }
];
