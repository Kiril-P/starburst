// Achievement badges + the meta-progression icons (owner: meta). Same lighting rules as icons.js
// (mask letters auto-shaded from the upper-left, 1px k outline), so they sit next to the HUD icons.
//
// A badge is a 16x16 medal: shaded rim in the tier colour, dark tier-tinted face, and an 8x8 glyph stamped on
// the face. Glyph chars: '#' bright tier colour, '+' white glint, '-' mid tone. The rim colour tells the kind of
// goal at a glance: amber = milestone, cyan = skill, lime = survival/ships, magenta = combat.
import { shade, outline } from './icons.js';

const TIERS = {
    amber: { rim: 'O', face: 'y', '#': 'A', '-': 'a' },
    cyan: { rim: 'Y', face: 'n', '#': 'C', '-': 'c' },
    lime: { rim: 'G', face: 'g', '#': 'L', '-': 'l' },
    magenta: { rim: 'P', face: 'p', '#': 'M', '-': 'm' },
    locked: { rim: 'T', face: '1', '#': '3', '-': '2' }
};

const G = {
    first_blood: ['...##...', '..#..#..', '.#....#.', '##.++.##', '##.++.##', '.#....#.', '..#..#..', '...##...'],
    exterminator: ['..####..', '.######.', '#..##..#', '#..##..#', '########', '.##..##.', '..####..', '..#..#..'],
    grazer: ['...#....', '...#....', '..###...', '###+###.', '..###...', '...#....', '...#....', '........'],
    needle: ['...+....', '...#....', '#..#..#.', '.#.#.#..', '...#....', '.#.#.#..', '#..#..#.', '...-....'],
    combo8: ['....##..', '...##...', '..##....', '.######.', '....##..', '...##...', '..##....', '.##.....'],
    combo16: ['...##...', '...##...', '########', '.##++##.', '..####..', '.##..##.', '.#....#.', '........'],
    wave5: ['........', '...##...', '..####..', '.##++##.', '##....##', '#......#', '........', '........'],
    wave10: ['...##...', '..####..', '.##..##.', '##....##', '...##...', '..####..', '.##..##.', '##....##'],
    wave20: ['..####..', '.##..##.', '........', '..####..', '.##..##.', '........', '..####..', '.##..##.'],
    boss1: ['........', '#..##..#', '##.##.##', '########', '##+##+##', '########', '-------.', '........'],
    boss3: ['+..+..+.', '#..#..#.', '##.#.##.', '#######.', '#######.', '-------.', '........', '........'],
    score50k: ['........', '..####..', '.#+##-#.', '########', '.######.', '..####..', '...##...', '........'],
    score250k: ['########', '#.#++#.#', '#.####.#', '.######.', '..####..', '...##...', '..####..', '.######.'],
    untouchable: ['########', '#+######', '#+######', '########', '.######.', '.######.', '..####..', '...##...'],
    clutch: ['.##..##.', '#+##.###', '####.###', '###.####', '.###.##.', '..##.#..', '...##...', '........'],
    speedy5: ['...##...', '...##...', '..#++#..', '..####..', '.######.', '##.##.##', '#..##..#', '........'],
    tank5: ['...##...', '#.#++#.#', '########', '########', '########', '#.#..#.#', '-......-', '........'],
    hard5: ['....#...', '...##...', '..###.#.', '.######.', '.##+###.', '##++####', '.##++##.', '..####..'],
    daily: ['.#....#.', '########', '########', '#......#', '#.++.#.#', '#......#', '#.#.#..#', '########'],
    veteran: ['.#....#.', '..#..#..', '...##...', '..####..', '.##++##.', '.######.', '..####..', '........'],
    investor: ['.##..##.', '.##..##.', '.######.', '..####..', '...##...', '...##...', '...##...', '...--...'],
    fleet: ['...#....', '..###...', '#.###.#.', '#######.', '###.###.', '#.#.#.#.', '........', '........'],
    locked: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '...##...', '........', '...##...']
};

export const BADGE_TIER = {
    first_blood: 'magenta', exterminator: 'magenta', boss1: 'magenta', boss3: 'magenta', hard5: 'magenta',
    grazer: 'cyan', needle: 'cyan', combo8: 'cyan', combo16: 'cyan', untouchable: 'cyan',
    clutch: 'lime', speedy5: 'lime', fleet: 'lime',
    wave5: 'amber', wave10: 'amber', wave20: 'amber', score50k: 'amber', score250k: 'amber', tank5: 'amber',
    daily: 'amber', veteran: 'amber', investor: 'amber', locked: 'locked'
};

function badge(glyph, tierName) {
    const t = TIERS[tierName];
    const rows = [];
    for (let y = 0; y < 16; y++) {
        let r = '';
        for (let x = 0; x < 16; x++) {
            const d = Math.hypot(x - 7.5, y - 7.5);
            r += d > 6.9 ? '.' : d >= 5.3 ? t.rim : t.face;
        }
        rows.push(r);
    }
    const lit = outline(shade(rows)).map((r) => [...r]);
    glyph.forEach((gr, gy) => [...gr].forEach((ch, gx) => {
        if (ch === '.') return;
        lit[4 + gy][4 + gx] = ch === '+' ? 'w' : t[ch];
    }));
    return lit.map((r) => r.join(''));
}

const BADGES = Object.keys(G).map((id) => ({ key: `ach_${id}`, rows: badge(G[id], BADGE_TIER[id]) }));

// ---- meta-progression icons (16x16, mask letters, see RAMPS in icons.js) ----------------------------------------
const icon = (key, rows) => ({ key, rows: outline(shade(rows)) });

const ICONS = [
    // credit chip: amber coin with an engraved diamond
    icon('icon_credit', [
        '................',
        '................',
        '.....OOOOOO.....',
        '....OOOOOOOO....',
        '...OOOOkkOOOO...',
        '..OOOOkzzkOOOO..',
        '..OOOkzAAakOOO..',
        '..OOkzAAAaakOO..',
        '..OOkAAAaaakOO..',
        '..OOOkAaaakOOO..',
        '..OOOOkaakOOOO..',
        '...OOOOkkOOOO...',
        '....OOOOOOOO....',
        '.....OOOOOO.....',
        '................',
        '................'
    ]),
    // fire rate: three cyan shots stacked upward, front one brightest
    icon('icon_firerate', [
        '................',
        '.......w........',
        '......bCb.......',
        '......CCC.......',
        '...w..cCc..w....',
        '..bCb.cCc.bCb...',
        '..CCC..c..CCC...',
        '..cCc.....cCc...',
        '..cCc..c..cCc...',
        '...c...c...c....',
        '.......n........',
        '...c.......c....',
        '...n.......n....',
        '................',
        '................',
        '................'
    ]),
    // damage: red plasma core with hot white centre and spikes
    icon('icon_damage', [
        '................',
        '.......H........',
        '.......H........',
        '..H...HHH...H...',
        '...H.HHHHH.H....',
        '....HHHzHHH.....',
        '...HHHzwzHHH....',
        '.HHHHzwwwzHHHH..',
        '...HHHzwzHHH....',
        '....HHHzHHH.....',
        '...H.HHHHH.H....',
        '..H...HHH...H...',
        '.......H........',
        '.......H........',
        '................',
        '................'
    ]),
    // graze field: a dotted cyan ring around the hitbox, a magenta bullet skimming past
    icon('icon_graze', [
        '................',
        '..........PPP...',
        '.....YY..PPqPP..',
        '...YY..YYPPPPP..',
        '..Y.......PPP...',
        '..Y.............',
        '.Y......w....Y..',
        '.Y.....kwk...Y..',
        '.Y......w....Y..',
        '..Y.........Y...',
        '..Y.........Y...',
        '...YY.....YY....',
        '.....YYYYY......',
        '................',
        '................',
        '................'
    ])
];

export default [...BADGES, ...ICONS];
