import { expandRows } from '../bake.js';

// Icons (owner: art-ui). 16x16 HUD/menu icons + 32x32 upgrade-card emblems.
//
// Maps mix two kinds of characters:
// - palette chars (see palette.js) are final colours, placed by hand;
// - MASK letters (below) are auto-shaded with the light-from-upper-left rule so every icon
//   lights the same way: pixel exposed to the top/left -> highlight, to the bottom/right -> shade.
// Every icon then gets a 1px 'k' outline so it reads on any background (HUD glass, bright FX).

// mask letter -> [highlight, mid, shade]
export const RAMPS = {
    S: ['6', '5', '3'], // steel
    T: ['5', '4', '2'], // darker steel
    Y: ['b', 'C', 'c'], // cyan
    P: ['q', 'M', 'm'], // magenta
    G: ['j', 'L', 'l'], // lime
    O: ['z', 'A', 'a'], // amber
    H: ['R', 'r', 'p'], // red
    Q: ['M', 'm', 'p'], // dim magenta (back layer)
    Z: ['C', 'c', 'n'] // dim cyan (back layer)
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

// 4-connected 1px dark outline around every opaque pixel
export function outline(rows) {
    return rows.map((row, y) => [...row].map((ch, x) => {
        if (ch !== '.') return ch;
        return solid(rows, x, y - 1) || solid(rows, x, y + 1) || solid(rows, x - 1, y) || solid(rows, x + 1, y) ? 'k' : '.';
    }).join(''));
}

const icon = (key, rows) => ({ key, rows: outline(shade(rows)) });

// ---- 16x16 ---------------------------------------------------------------------------------------

const ICONS = [
    // double chevron, rear one dimmer = motion
    icon('icon_dash', [
        '................',
        '................',
        '.cCC..CCb.......',
        '..cCC..CCb......',
        '...cCC..CCb.....',
        '....cCC..CCb....',
        '.....cCC..CCb...',
        '......cCC..Cbw..',
        '.....ccc..CCc...',
        '....ccc..CCc....',
        '...ccc..CCc.....',
        '..ccc..CCc......',
        '.ccc..CCc.......',
        '................',
        '................',
        '................'
    ]),
    // hex shield with an energised core
    icon('icon_forcefield', [
        '................',
        '......bbbb......',
        '....bbCCCCCC....',
        '..bbCCnccnCCCc..',
        '..bCcnnnnnnnCc..',
        '..bCcnnnnnnnCc..',
        '..bCnnnnnnnnCc..',
        '..bCnnnnnnnnCc..',
        '..bCnnnnnnnnCc..',
        '..bCnnnnnnnnCc..',
        '..bCnnnnnnnnCc..',
        '..CCCCnnnnCCcc..',
        '....CCCCcccc....',
        '......cccc......',
        '................',
        '................'
    ]),
    // two interlocked diamonds (front one brighter)
    icon('icon_phase', [
        '................',
        '................',
        '................',
        '.....Q....P.....',
        '....QQQ..PPP....',
        '...QQ.QQPPpPP...',
        '..QQ...PPpppPP..',
        '.QQ...PPQQpppPP.',
        '..QQ...QQpppPP..',
        '...QQ.QQPPpPP...',
        '....QQQ..PPP....',
        '.....Q....P.....',
        '................',
        '................',
        '................',
        '................'
    ]),
    // lightning bolt
    icon('icon_speed', [
        '................',
        '........jjjjj...',
        '.......jLLLl....',
        '......jLLLl.....',
        '.....jLLLl......',
        '....jLLLl.......',
        '...jLLLLLjjjl...',
        '.......LLLLl....',
        '......LLLLl.....',
        '......LLLl......',
        '.....LLLl.......',
        '.....LLl........',
        '....LLl.........',
        '....Ll..........',
        '...L............',
        '................'
    ]),
    // medical cross
    icon('icon_heal', [
        '................',
        '................',
        '......jjjL......',
        '......jLLl......',
        '......jLLl......',
        '......jLLl......',
        '..jjjjLLLLjjjL..',
        '..jwLLLLLLLLLl..',
        '..jLLLLLLLLLLl..',
        '..LlllLLLlllll..',
        '......jLLl......',
        '......jLLl......',
        '......jLLl......',
        '......Llll......',
        '................',
        '................'
    ]),
    // padlock, steel with amber keyhole
    icon('icon_lock', [
        '................',
        '.....566554.....',
        '....56....54....',
        '....55....43....',
        '....55....43....',
        '....55....43....',
        '...5555555554...',
        '..544444444443..',
        '..54444AA44443..',
        '..5444zAAa4443..',
        '..54444Aa44443..',
        '..54444Aa44443..',
        '..54444yy44443..',
        '..433333333332..',
        '...2222222222...',
        '................'
    ]),
    // quest badge: amber shield with "!"
    icon('icon_quest', [
        '................',
        '...zzzzzAAAAA...',
        '..zAAAAAaaaaay..',
        '..zAAAAkkaaaay..',
        '..zAAAAkkaaaay..',
        '..zAAAAkkaaaay..',
        '..zAAAAkkaaaay..',
        '..zAAAAkkaaaay..',
        '..zAAAAAaaaaay..',
        '...zAAAkkaaay...',
        '...zAAAkkaaay...',
        '....zAAAaaay....',
        '.....zAAaay.....',
        '......zAay......',
        '.......yy.......',
        '................'
    ]),
    // completed quest: lime shield with a check
    icon('icon_quest_done', [
        '................',
        '...jjjjjLLLLL...',
        '..jLLLLLlllllg..',
        '..jLLLLLlllllg..',
        '..jLLLLLllkklg..',
        '..jLLLLLlkkllg..',
        '..jLkkLLkklllg..',
        '..jLLkkkkllllg..',
        '..jLLLkklllllg..',
        '...jLLLLllllg...',
        '...jLLLLllllg...',
        '....jLLLlllg....',
        '.....jLLllg.....',
        '......jLlg......',
        '.......gg.......',
        '................'
    ]),
    // settings cog
    icon('icon_gear', [
        '................',
        '......SSSS......',
        '..SS..SSSS..SS..',
        '..SSSSSSSSSSSS..',
        '...SSSSSSSSSS...',
        '...SSSSSSSSSS...',
        '.SSSSSS..SSSSSS.',
        '.SSSSS....SSSSS.',
        '.SSSSS....SSSSS.',
        '.SSSSSS..SSSSSS.',
        '...SSSSSSSSSS...',
        '...SSSSSSSSSS...',
        '..SSSSSSSSSSSS..',
        '..SS..SSSS..SS..',
        '......SSSS......',
        '................'
    ]),
    // difficulty: flaming skull
    icon('icon_skull', [
        '................',
        '.......r........',
        '...r..RaR..r....',
        '...aA.aAAa.Aa...',
        '..aAAzAzzAzAAa..',
        '..aAw6666665Aa..',
        '..Rw666666665R..',
        '..w66666666665..',
        '..66kkk66kkk65..',
        '..66kRk66kRk65..',
        '..56666kk66654..',
        '...5666666654...',
        '....56k66k64....',
        '.....455554.....',
        '................',
        '................'
    ]),
    icon('icon_star', [
        '................',
        '.......z........',
        '......zAa.......',
        '......zAa.......',
        '.....zwAAa......',
        '.zzzzzAAAAAAAa..',
        '..zAAAAAAAAAa...',
        '...zAAAAAAAa....',
        '....zAAAAAa.....',
        '....zAAAAAa.....',
        '...zAAa.AAAa....',
        '...zAa...AAa....',
        '..zAa.....Aaa...',
        '..aa.......aa...',
        '................',
        '................'
    ]),
    icon('icon_heart', [
        '................',
        '................',
        '..HHH......HHH..',
        '.HwwHH....HHHHH.',
        '.HwHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '.HHHHHHHHHHHHHH.',
        '..HHHHHHHHHHHH..',
        '...HHHHHHHHHH...',
        '....HHHHHHHH....',
        '.....HHHHHH.....',
        '......HHHH......',
        '.......HH.......',
        '................',
        '................',
        '................'
    ]),
    // the player's fighter in miniature
    icon('icon_ship', [
        '................',
        '.......S........',
        '......SSS.......',
        '......SbS.......',
        '......SYS.......',
        '.....SSYSS......',
        '.....SSSSS......',
        '....SSSSSSS.....',
        '...SSSSSSSSS....',
        '..SSSSSSSSSSS...',
        '.SSSSSSSSSSSSS..',
        '.SS..SSSSS..SS..',
        '.....Cb.bC......',
        '................',
        '................',
        '................'
    ])
];


// ---- 32x32 upgrade-card emblems -------------------------------------------------------------------
// Same language as the HUD icons, framed like the concept-art cards: a dark glass disc with a 2px neon
// ring (lit upper-left) and a larger, richer glyph inside.

const N = 32, MID = 15.5;
const blank = () => Array.from({ length: N }, () => Array(N).fill('.'));
const toRows = (g) => g.map((r) => r.join(''));
// draws `rows` onto grid g at (ox, oy); '.' is transparent
const stamp = (g, rows, ox, oy) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') g[oy + y][ox + x] = ch; }));
// shade + outline a mask layer on its own grid, then stamp it
const layer = (g, draw) => { const l = blank(); draw(l); stamp(g, outline(shade(toRows(l))), 0, 0); };

// ramp = [dark, mid, bright, highlight]
function emblem(ramp) {
    const [d, m, br, hl] = ramp, g = blank();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x - MID, dy = y - MID, r = Math.hypot(dx, dy);
        if (r > 15.4) continue;
        const lit = dx + dy < -7; // upper-left arc
        if (r > 14.4) g[y][x] = lit ? hl : br;
        else if (r > 13.4) g[y][x] = lit ? br : m;
        else if (r > 12.4) g[y][x] = d;
        else if (r > 10.4) g[y][x] = (x + y) & 1 ? 'k' : d; // dithered inner glow
        else g[y][x] = 'k';
    }
    return g;
}

function chevron(l, x0, y0, half, thick, ch) {
    for (let d = -half; d <= half; d++) for (let t = 0; t < thick; t++) l[y0 + d][x0 + half - Math.abs(d) + t] = ch;
}
function diamondRing(l, cx, cy, r, thick, ch, keep = () => true) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        const dd = Math.abs(x - cx) + Math.abs(y - cy);
        if (dd <= r && dd > r - thick && keep(x, y)) l[y][x] = ch;
    }
}
const rect = (l, x, y, w, h, ch) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) l[j][i] = ch; };

const MINI_SHIP = [
    '....S....',
    '...SbS...',
    '...SYS...',
    '..SSSSS..',
    '.SSSSSSS.',
    'SSS.S.SSS',
    'S..CbC..S'
];
const HEART = [ // left half, mirrored
    '..HHHH..',
    '.HHHHHH.',
    'HHHHHHHH',
    'HHHHHHHH',
    'HHHHHHHH',
    'HHHHHHHH',
    '.HHHHHHH',
    '..HHHHHH',
    '...HHHHH',
    '....HHHH',
    '.....HHH',
    '......HH',
    '.......H'
];
const BOLT = (() => {
    const rows = [];
    const run = (a, b) => rows.push('.'.repeat(a) + 'G'.repeat(b - a + 1) + '.'.repeat(12 - b));
    for (let r = 0; r < 7; r++) run(6 - r, 12 - r);
    run(0, 12);
    [[5, 11], [5, 10], [4, 9], [4, 8], [3, 7], [3, 6], [2, 5], [2, 4], [1, 3], [1, 2], [0, 1]].forEach(([a, b]) => run(a, b));
    return rows;
})();

const CARDS = [
    {
        key: 'card_dash',
        draw(g) {
            layer(g, (l) => { chevron(l, 6, 15, 7, 4, 'Z'); chevron(l, 13, 15, 7, 4, 'Y'); });
            g[15][23] = 'w';
            // speed streaks trailing behind
            [[11, 3, 3], [19, 3, 3]].forEach(([y, x, n]) => { for (let i = 0; i < n; i++) g[y][x + i] = i === n - 1 ? 'C' : 'c'; });
        }
    },
    {
        key: 'card_forcefield',
        draw(g) {
            layer(g, (l) => {
                const hex = (x, y, hw, R) => Math.abs(x) <= hw && Math.abs(y) <= R - Math.abs(x) * 0.5;
                for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                    const dx = x - MID, dy = y - MID;
                    if (hex(dx, dy, 9.5, 11) && !hex(dx, dy, 7, 8.5)) l[y][x] = 'Y';
                }
            });
            // energised interior: dithered field + the ship it protects
            for (let y = 9; y < 23; y++) for (let x = 9; x < 23; x++) if (g[y][x] === 'k' && (x + y) % 2 === 0 && Math.hypot(x - MID, y - MID) < 7.5) g[y][x] = 'n';
            layer(g, (l) => stamp(l, MINI_SHIP, 12, 12));
        }
    },
    {
        key: 'card_phase',
        draw(g) {
            // ghost fill inside the front diamond = intangibility
            layer(g, (l) => {
                diamondRing(l, 12, 15, 7, 2, 'Q');
                diamondRing(l, 19, 15, 7, 2, 'P');
                diamondRing(l, 12, 15, 7, 2, 'Q', (x, y) => y > 15 && x >= 15); // weave: back passes over at the bottom
            });
            g[8][19] = 'w';
        }
    },
    {
        key: 'card_speed',
        draw(g) {
            layer(g, (l) => stamp(l, BOLT, 10, 6));
            [[11, 5, 4], [15, 4, 4], [19, 5, 3]].forEach(([y, x, n]) => { for (let i = 0; i < n; i++) g[y][x + i] = i === n - 1 ? 'L' : 'l'; });
            g[6][16] = 'w';
        }
    },
    {
        key: 'card_heal',
        draw(g) {
            layer(g, (l) => stamp(l, expandRows(HEART, 'even'), 7, 8));
            g[10][9] = 'w'; g[10][10] = 'w'; g[11][9] = 'w';
            layer(g, (l) => { rect(l, 21, 16, 3, 9, 'G'); rect(l, 18, 19, 9, 3, 'G'); });
        }
    }
];

const CARD_RAMPS = { card_dash: 'ncCb', card_forcefield: 'ncCb', card_phase: 'pmMq', card_speed: 'glLj', card_heal: 'glLj' };

const CARD_DEFS = CARDS.map(({ key, draw }) => {
    const g = emblem([...CARD_RAMPS[key]]);
    draw(g);
    return { key, rows: toRows(g) };
});

export default [...ICONS, ...CARD_DEFS];
