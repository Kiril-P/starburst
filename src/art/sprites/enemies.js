// Hostile ships + meteors (owner: art-enemies). Format: see ../bake.js.
import { expandRows } from '../bake.js';

// Enemies are authored as the LEFT half and mirrored, then the right half of every hull ramp is
// stepped one shade darker so light reads from the upper-left (STYLE.md) instead of dead-on.
const SHADE = { 6: '5', 5: '4', 4: '3', 3: '2', 2: '1', x: 'V', V: 'v', v: 'u' };
function lit(rows, sym = 'even') {
    const full = expandRows(rows, sym);
    const half = Math.ceil(full[0].length / 2);
    return full.map((r) => [...r].map((ch, i) => (i >= half && SHADE[ch] ? SHADE[ch] : ch)).join(''));
}
// Idle pulse: swap emissive steps so cores/engines breathe between the 2 frames.
const pulse = (rows, swap) => rows.map((r) => [...r].map((ch) => swap[ch] || ch).join(''));

const BASIC = [
    '...........',
    '.kk......kq',
    '.kqk....kxM',
    '.kMMk..kxxk',
    '.kMmxkkxxVk',
    '.kMmxxxxVVk',
    '.kMmVxxVVkg',
    '.kMmpVxVkgL',
    '.kMmpVxVkLw',
    '.kMmpkVVkLj',
    '.kMmk.kVVkg',
    '.kMmk..kVxx',
    '.kMmk...kVx',
    '.kMmk....kM',
    '.kMmMk....q',
    '..kMmk.....',
    '..kMmMk....',
    '...kMmk....',
    '....kMmk...',
    '.....kqq...',
    '......q....',
    '...........'
];

const CIRCULAR = [
    '...........q',
    '..........kM',
    '........kkkM',
    '...qq.kkmmmM',
    '...qMmmkkkkk',
    '....kMMk444m',
    '...kmMk4444m',
    '...kmk4m4kkk',
    '..kmk444kmmM',
    '..kmk44kmMMq',
    '..kmk44kmMqw',
    'qMMMkmmkMqww'
];

const SPREAD = [
    '..............',
    '..........kAzk',
    '..........k55k',
    '.........k5443',
    '........k54433',
    '.......k544332',
    '......k5443322',
    '.....k5443a2kk',
    '....k5443aA2ky',
    '...k5443aA3kyA',
    '..k5443aA32kAz',
    '.k5443aA322kAw',
    'kA443aA3222kAz',
    'kz43aA32222kyA',
    'kAkk43k22221kk',
    '.k.k43kk2221k3',
    '...k43k.k221k3',
    '...k43k..k21k3',
    '...k43k..k21k3',
    '...kAzk...k1kk',
    '....zz.....kAz',
    '...........kAz',
    '............Az',
    '.............z'
];

// Meteors: violet faceted rock, lime crystal shards (emissive: no outline where they break the silhouette).
// Kept roughly round because the engine spins them. Crystals glow, so they skip the light-direction rule.
const METEOR_S_0 = [
    '......j.......',
    '....kjLl......',
    '...kxjLlkkkk..',
    '..kxxLLgvvvvk.',
    '.kxxVVVvvvvvk.',
    'kxxVVVvvvvvvk.',
    'kVVVVuuVvvvvk.',
    'kVVvvuvVvvvvk.',
    '.kvvvxVvvvvvk.',
    '..kvvvvvvvvvk.',
    '...kvvvvvvLj..',
    '....kvuvvkg...',
    '.....kkkk.....',
    '..............'
];
const METEOR_S_1 = [
    '......kkk.....',
    '.....kxVVk..j.',
    '....kxVvVvkjL.',
    '...kkxVvVvjLg.',
    '..kxxxVvvLlg..',
    '.kVVVVvvvvvvk.',
    '.kVVVVvuuVvuk.',
    '.kVVvvvuuVuuk.',
    '.kVvvvvVVvuk..',
    '.kvvvvvvuuuk..',
    '..gLvvvuuuuk..',
    '...jvuuukkk...',
    '....kkkk......',
    '..............'
];
const METEOR_M_0 = [
    '........kk............',
    '.......kxVkk..........',
    '......kxxxVVk......j..',
    '.....kxxVxVVvkk...jL..',
    '.....kxxVVVVvvvj.jLl..',
    '....kxxxVVVvvvjLjLlg..',
    '....kxxxVVvvvvLLLlg...',
    '....kxVVVvvvvvLlggvk..',
    '...kVVVVVVvvvulvvvvk..',
    '..kVVVVVVvvuuLuuxvvk..',
    '..kVVVVVvvvuuluuvVvk..',
    '..kxVVvvvvvuluuuuxvk..',
    '..kVVvvvvvVuluuuxVvk..',
    '..kVVVvvvVVvluuvxvuk..',
    '...kVVVvvvvvLxxxvLj...',
    '....glLvvvvvvvuuuguk..',
    '...gLjvvvvvvvvuuuuk...',
    '...Ljvvvvvvvvuukkk....',
    '...j.kvvvvvvkkk.......',
    '......kvvvvk..........',
    '.......kkkk...........',
    '......................'
];
const METEOR_M_1 = [
    '........jLl...........',
    '........jLl.jk........',
    '........jLlLlVk.......',
    '........LLlLgVvkk.....',
    '.......kLLgLgVvvvk....',
    '......kxxxxVVvvvvvk...',
    '....kkxxxxlVVvvvvvvk..',
    '...kxxxxxxLVVvvvvvuuk.',
    '..kxxVVVVVluVVvvvvuuk.',
    '..kxVVVVVluuuvVvvvuuk.',
    '..gVVVVVVLuuvuVvvvvk..',
    '.jLVVVVvvullvuVvvvuk..',
    '..kVVVvvvvuuLuVvvvk...',
    '..kVvvvvvvuuuVVvvuk...',
    '..kvvvvvvvVVVvvuuuk...',
    '..kvvvvvvvvuuuuLuk....',
    '..kvvVVvvvuuuuulj.....',
    '...kvvvvuuuuuuugLj....',
    '...kvvvvuuukkkk.gLj...',
    '....kkvvkkk...........',
    '......kk..............',
    '......................'
];
const METEOR_L_0 = [
    '..........kkkkkk................',
    '.........kxxVVVVkk..............',
    '........kxxxVxVVVVk.............',
    '.......kxxxVxxVVVVVkk...........',
    '.......kxxxVVxVVVVvvvkk.........',
    '.....jLgxxxVVVVVVvvvvVVkk.j.....',
    '......jLgxxVVVVVVvvvvVvvvjL.....',
    '.......jlxxxVVVVvvvvVVvvjLl.....',
    '......kxLVVVVVVvvvvVVjvjLlgk....',
    '.....kVVVVVVVVvvvvVVjLjLlgvvk...',
    '.....kVVVVVVVVvvvvVjLLLlgvvvk...',
    '....kVVVVVVVVvvvvVVLLLlgvvvvk...',
    '....kVVVVVVVVvvvvVVLlggvvvvvk...',
    '...kVVVVVVVVVVvvvvlvvvvvvvvvvk..',
    '...kVVVVVVuuuvVVvvlvvvvvvvvvvk..',
    '..kxVVVVVuuuuuvVvlvvvvvvvvvvvk..',
    '..kxxvVVVuuuuuxvvLvvvvvvvvvvvk..',
    '..kxVVvvvvuuuvVvlvvvvvvvvvvLj...',
    '..kVVVVVvVVxxxVVlvvvvvvvvvvgvk..',
    '..kVVVVVVvvvvVLlvvvvvvvvvvvvuk..',
    '...kVVVVVVvvllVvvvvvvvvvvvvvuk..',
    '...kVVVVVVVvVvvvvvvvvuvvvvuuuk..',
    '....kVVVVVvvvvvvvvvvvvvuuuuuuk..',
    '.....gglLvvvvvvvvvvvvvuuuuuuk...',
    '....glLLLvvvvvvvvvvvvuuuuuuuk...',
    '...glLjLjvvvvvvvvvvvuuuuuukk....',
    '...lLj.jvvvvvvvvvvvvuukkkk......',
    '...Lj.kvvvvvvvvvvvvkkk..........',
    '...j...kvvvvvvvvvkk.............',
    '........kvvvvvvvk...............',
    '.........kkkkkkk................',
    '................................'
];
const METEOR_L_1 = [
    '...............j.kkkk...........',
    '...........kkkjLlxVvvkk.........',
    '..........kxxxjLlxvvvvvkk.......',
    '.........kxxxxjLlxjvVVVvvk......',
    '........kxxxxjjLlLlVVVVvvvk.....',
    '........kxxxxjLLlLlgVVVvvvk.....',
    '.......kxxxxxLLLlLlgVVvvvvvk....',
    '.......kxVVVxLLlgLgVVvvvvvvk....',
    '.......kVVVVVVVlxVVVVvvvvvvk....',
    '......kVVVVVVVVLVVVVVvvvvjvk....',
    '......kxVVVxxVVlVVVVVvvvvLg.....',
    '.....kxxxVxxxxlVuuuVVvvvvvvk....',
    '....kVVVVVxxxxLuuuvvxVvvvvvk....',
    '...kVVVVVxxxxxVluvvvxvvvvvvk....',
    '..kVVVVVVxxxxVVulvvvVvvvvvvk....',
    '.llgxxVVVxxxVVVvLvvVVvuvvvuk....',
    'jLLLxlLxVxVVVVVxxlVVvvuuvuuk....',
    '.jjLxxVllLVVVVVVvvlvvuuuuuuk....',
    '.kVVVVVVVVVVVVuuvvvLuuuuuuuuk...',
    '.kVVVVVVVVVVVuuuuVvluuuuuuvvk...',
    '..kvvvvvVVVVvuuuuVuuluuuuvvvk...',
    '..kvvvvvvVVvvuuuuvuuuuuuvvuuk...',
    '...kvvvvvvvvvVVVVvuuuuuvvvuuk...',
    '....kVvvvvvvvvvvvvvuuuvLLjuk....',
    '.....kvvvvvvvvvvvvvvuvvlLLj.....',
    '......kvvvvvvvvvvvvuuuugLj......',
    '.......kvvvvvvvvvvuuuuvglLj.....',
    '........kvvvvvvvvuuuuuvkglLj....',
    '.........kvuvvuuuuuuuvk..glLj...',
    '..........kuuuuvvuukkk..........',
    '...........kkkkkkkk.............',
    '................................'
];

const circFull = (rows) => [...rows, ...rows.slice().reverse()];

export default [
    {
        key: 'enemy_basic',
        fps: 6,
        frames: [lit(BASIC), lit(pulse(BASIC, { q: 'M', j: 'L', w: 'j' }))]
    },
    {
        key: 'enemy_circular',
        fps: 6,
        frames: [lit(circFull(CIRCULAR)), lit(pulse(circFull(CIRCULAR), { M: 'q', m: 'M' }))]
    },
    {
        key: 'enemy_spread',
        fps: 6,
        frames: [lit(SPREAD), lit(pulse(SPREAD, { z: 'A', A: 'z' }))]
    },
    { key: 'meteor_s_0', rows: METEOR_S_0 },
    { key: 'meteor_s_1', rows: METEOR_S_1 },
    { key: 'meteor_m_0', rows: METEOR_M_0 },
    { key: 'meteor_m_1', rows: METEOR_M_1 },
    { key: 'meteor_l_0', rows: METEOR_L_0 },
    { key: 'meteor_l_1', rows: METEOR_L_1 }
];
