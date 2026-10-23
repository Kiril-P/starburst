// Player weapons (owner: pickups/weapons). Format: see ../bake.js.
// Shots follow the bullet rules (no outline, white-hot core -> cyan ramp rim, drawn pointing UP and rotated by the
// pool). Cyan = friendly for every weapon, so the player's fire never reads as hostile. Drones are objects
// (outlined). Card emblems use the upgrade-card construction of icons.js: cyan ring = weapon, amber ring = synergy.
import { grid, toRows, layer, stamp, rect, disc, emblem, CARD_RAMP } from './artKit.js';

// round shot with a white core: radius thresholds -> w, b, C, c, n
function orb(size, rs) {
    const g = grid(size, size), m = (size - 1) / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - m, y - m);
        const i = rs.findIndex((r) => d <= r);
        if (i >= 0) g[y][x] = 'wbCcn'[i];
    }
    return toRows(g);
}

const SHOTS = [
    { key: 'wshot_pellet', rows: ['.b.', 'bwb', 'CbC', '.C.', '.c.'] },
    {
        key: 'wshot_heavy',   // tank: fat slug
        rows: ['..b..', '.bwb.', '.bwb.', 'CbwbC', 'CbwbC', 'CCbCC', 'cCbCc', 'cCCCc', '.cCc.', '.ncn.', '..n..']
    },
    {
        key: 'wshot_lance',   // piercing bolt: long, thin, brightest at the tip
        rows: ['.w.', '.w.', 'bwb', 'bwb', 'bwb', 'CbC', 'CbC', 'CbC', '.C.', '.C.', '.C.', '.c.', '.c.', '.c.', '.n.', '.n.', '.n.']
    },
    {
        key: 'wshot_missile', // steel body, cyan seeker nose, hot exhaust at the tail
        rows: ['..b..', '.bCb.', '.6C5.', '.565.', '.554.', '.454.', 'c434c', 'C.3.C', '..b..', '..w..', '..C..']
    },
    { key: 'wshot_charge_s', rows: orb(7, [0.8, 1.6, 2.4, 3.2, 3.6]) },
    { key: 'wshot_charge_m', rows: orb(11, [1.2, 2.4, 3.6, 4.6, 5.4]) },
    { key: 'wshot_charge_l', rows: orb(15, [2.0, 3.6, 5.2, 6.4, 7.4]) }
];

// orbiting drone: steel pod, cyan lens; frame 1 = lens flare
function drone(hot) {
    const g = grid(11, 11);
    layer(g, (l) => { disc(l, 5, 5, 3.6, 'S'); rect(l, 0, 5, 11, 1, 'T'); });
    disc(g, 5, 5, 1.6, 'C');
    g[4][4] = hot ? 'w' : 'b';
    if (hot) { g[5][5] = 'b'; g[5][0] = 'C'; g[5][10] = 'C'; }
    return toRows(g);
}

// ---- 32x32 card emblems ---------------------------------------------------------------------------------------
/** thick line of mask char ch from (x0,y0) to (x1,y1) */
function line(l, x0, y0, x1, y1, w, ch) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        rect(l, Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, ch);
    }
}
const bolt = (l, x, y, h) => { rect(l, x, y, 3, h, 'Y'); rect(l, x + 1, y - 1, 1, 1, 'Y'); };
const MISSILE = ['..Y..', '.YYY.', '.SSS.', '.SSS.', '.SSS.', '.SSS.', 'TSSST', 'T.S.T'];
const miniDrone = (g, x, y) => { layer(g, (l) => disc(l, x, y, 2.6, 'S')); g[y][x] = 'C'; g[y - 1][x - 1] = 'b'; };
const SHIP = ['...S...', '..SYS..', '.SSSSS.', 'SSSSSSS', 'S.S.S.S'];

const CARDS = {
    card_blaster: ['cyan', (g) => {
        layer(g, (l) => { bolt(l, 11, 8, 13); bolt(l, 18, 8, 13); });
        g[8][12] = 'w'; g[8][19] = 'w';
        rect(g, 10, 23, 12, 1, 'c'); rect(g, 12, 24, 8, 1, 'n');   // muzzle glow
    }],
    card_spread: ['cyan', (g) => {
        layer(g, (l) => { line(l, 16, 23, 16, 8, 3, 'Y'); line(l, 14, 23, 7, 11, 3, 'Y'); line(l, 18, 23, 25, 11, 3, 'Y'); });
        g[7][16] = 'w'; g[10][7] = 'w'; g[10][25] = 'w';
    }],
    card_lance: ['cyan', (g) => {
        // the bolt passes clean through a hostile (magenta) diamond
        layer(g, (l) => { for (let y = -6; y <= 6; y++) rect(l, 16 - (6 - Math.abs(y)), 16 + y, (6 - Math.abs(y)) * 2, 1, 'P'); });
        layer(g, (l) => rect(l, 15, 4, 2, 24, 'Y'));
        g[4][15] = 'w'; g[5][15] = 'w';
    }],
    card_charge: ['cyan', (g) => {
        for (let y = 5; y < 27; y++) for (let x = 5; x < 27; x++) {
            const d = Math.hypot(x - 15.5, y - 15.5);
            if (d > 8 && d < 10.5 && (x + y) & 1) g[y][x] = 'n';
        }
        stamp(g, orb(13, [1.6, 3.2, 4.6, 5.6, 6.4]), 10, 10);
        g[13][13] = 'w';
    }],
    card_missiles: ['cyan', (g) => {
        layer(g, (l) => { stamp(l, MISSILE, 8, 8); stamp(l, MISSILE, 19, 11); });
        for (const [x, y] of [[10, 16], [21, 19]]) { g[y][x] = 'b'; g[y + 1][x] = 'C'; g[y + 2][x] = 'c'; }
    }],
    card_drones: ['cyan', (g) => {
        for (let a = 0; a < 40; a++) {
            const x = Math.round(15.5 + Math.cos(a / 40 * Math.PI * 2) * 9), y = Math.round(15.5 + Math.sin(a / 40 * Math.PI * 2) * 9);
            if (a & 1) g[y][x] = 'n';
        }
        layer(g, (l) => stamp(l, SHIP, 13, 14));
        miniDrone(g, 9, 10); miniDrone(g, 22, 21);
    }],
    // synergies: two weapon motifs fused, amber ring
    card_splinter: ['amber', (g) => {
        layer(g, (l) => { line(l, 16, 25, 16, 6, 1, 'Y'); line(l, 15, 25, 7, 9, 1, 'Y'); line(l, 17, 25, 25, 9, 1, 'Y'); });
        layer(g, (l) => rect(l, 12, 15, 8, 3, 'P'));
        g[6][16] = 'w'; g[9][7] = 'w'; g[9][25] = 'w';
    }],
    card_swarm: ['amber', (g) => {
        layer(g, (l) => stamp(l, MISSILE, 14, 11));
        miniDrone(g, 8, 9); miniDrone(g, 23, 9); miniDrone(g, 16, 23);
    }],
    card_overload: ['amber', (g) => {
        stamp(g, orb(11, [1.2, 2.4, 3.6, 4.6, 5.4]), 6, 11);
        layer(g, (l) => rect(l, 9, 15, 18, 3, 'Y'));
        g[15][26] = 'w'; g[16][26] = 'w';
    }],
    card_hunter: ['amber', (g) => {
        layer(g, (l) => { for (let i = 0; i <= 14; i++) rect(l, 8 + i, Math.round(24 - Math.sin(i / 14 * Math.PI / 2) * 14), 2, 2, 'Y'); });
        layer(g, (l) => { rect(l, 21, 6, 5, 5, 'P'); });
        g[10][22] = 'w';
    }]
};

const CARD_DEFS = Object.entries(CARDS).map(([key, [hue, draw]]) => {
    const g = emblem([...CARD_RAMP[hue]]);
    draw(g);
    return { key, rows: toRows(g) };
});

export default [
    ...SHOTS,
    { key: 'drone', fps: 6, frames: [drone(false), drone(true)] },
    ...CARD_DEFS
];
