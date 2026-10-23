// THE palette. Pixel-art sprites are authored as text maps using these characters.
// Never invent colours outside this table. Each hue is a 4-step ramp: dark, mid, bright, highlight.
export const PALETTE = {
    '.': null,          // transparent
    k: '#0a0d1f',       // outline / deepest shadow (use sparingly; neon objects are usually rim-lit, not outlined)

    // steel (hulls): 1 darkest -> 6 lightest
    1: '#1b2140',
    2: '#2b3459',
    3: '#424f7b',
    4: '#6475a3',
    5: '#9aaad0',
    6: '#dbe6ff',

    // cyan (player, engines, shields, UI)
    n: '#0a3050',
    c: '#0e7aa8',
    C: '#39e7ff',
    b: '#a6f7ff',

    // magenta (hostile energy)
    p: '#4a0f4a',
    m: '#b02294',
    M: '#ff43c8',
    q: '#ffa6ea',

    // amber (warnings, spread enemies, fire)
    y: '#6e3208',
    a: '#d97f1c',
    A: '#ffb547',
    z: '#ffe3a0',

    // lime (meteors, speed, healing)
    g: '#245c10',
    l: '#6cc22a',
    L: '#b7ff4a',
    j: '#e8ffb8',

    // red (damage, danger)
    r: '#c7303a',
    R: '#ff6a5c',

    // violet (space, nebula, rock)
    u: '#150c2e',
    v: '#2c1860',
    V: '#5a34a8',
    x: '#8b62e0',

    // white
    w: '#f4faff'
};

export const hex = (ch) => PALETTE[ch];
export const num = (ch) => parseInt(PALETTE[ch].slice(1), 16);

// Convenience for Phaser tints / graphics (0xRRGGBB numbers)
export const COLORS = Object.fromEntries(
    Object.entries(PALETTE).filter(([, v]) => v).map(([k, v]) => [k, parseInt(v.slice(1), 16)])
);
