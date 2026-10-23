// Enemy projectiles + the player's hitbox marker (owner: art-enemies). Format: see ../bake.js.
// Bullets have NO outline: white-hot core -> highlight -> bright body -> dark-ramp rim, so they read
// as light sources against dark space. Shapes carry meaning: orbs round, needles long, rings hollow, shards diamond.

// Ramp swaps: every bullet is authored in one hue and recoloured ramp-for-ramp.
const FROM_MAGENTA = {
    amber: { p: 'y', m: 'a', M: 'A', q: 'z' },
    lime: { p: 'g', m: 'l', M: 'L', q: 'j' },
    cyan: { p: 'n', m: 'c', M: 'C', q: 'b' }
};
const FROM_AMBER = {
    magenta: { y: 'p', a: 'm', A: 'M', z: 'q' },
    lime: { y: 'g', a: 'l', A: 'L', z: 'j' }
};
const FROM_LIME = {
    magenta: { g: 'p', l: 'm', L: 'M', j: 'q' },
    amber: { g: 'y', l: 'a', L: 'A', j: 'z' }
};

export default [
    {
        key: 'bullet_orb_s',
        variants: FROM_MAGENTA,
        rows: [
            '.mMm.',
            'mMqMm',
            'MqwqM',
            'mMqMm',
            '.mMm.'
        ]
    },
    {
        key: 'bullet_orb_m',
        variants: FROM_MAGENTA,
        rows: [
            '..mMm..',
            '.MMqMM.',
            'mMqwqMm',
            'MqwwwqM',
            'mMqwqMm',
            '.MMqMM.',
            '..mMm..'
        ]
    },
    {
        key: 'bullet_orb_l',
        variants: FROM_MAGENTA,
        rows: [
            '...pmmmp...',
            '..mMMMMMm..',
            '.mMMqqqMMm.',
            'pMMqqwqqMMp',
            'mMqqwwwqqMm',
            'mMqwwwwwqMm',
            'mMqqwwwqqMm',
            'pMMqqwqqMMp',
            '.mMMqqqMMm.',
            '..mMMMMMm..',
            '...pmmmp...'
        ]
    },
    {
        // points UP (rotate to velocity); brightest at the tip so the direction of travel reads
        key: 'bullet_needle',
        variants: FROM_AMBER,
        rows: [
            '.w.',
            '.z.',
            'aza',
            'AwA',
            'AzA',
            'yAy',
            '.A.',
            '.a.',
            '.a.',
            '.y.',
            '.y.'
        ]
    },
    {
        key: 'bullet_ring',
        variants: { amber: FROM_MAGENTA.amber, lime: FROM_MAGENTA.lime },
        rows: [
            '..pmMmp..',
            '.mMqqqMm.',
            'pMq...qMp',
            'mq.....qm',
            'Mw.....wM',
            'mq.....qm',
            'pMq...qMp',
            '.mMqqqMm.',
            '..pmMmp..'
        ]
    },
    {
        // crystal shard, points UP; upper-left facets lit, lower-right in shade
        key: 'bullet_shard',
        variants: FROM_LIME,
        rows: [
            '..j..',
            '.jLg.',
            '.Ljl.',
            'jLwLg',
            'LjwLg',
            'lLjlg',
            '.lLg.',
            '.gLg.',
            '..g..'
        ]
    },
    {
        // the player's true hitbox: drawn on top of the ship, pulses so the eye can find it mid-pattern
        key: 'hitbox_dot',
        fps: 6,
        frames: [
            // dark navy corners keep it legible over the silver hull, not just over space
            [
                '.nCn.',
                'nCwCn',
                'CwwwC',
                'nCwCn',
                '.nCn.'
            ],
            [
                '.nnn.',
                'ncCcn',
                'nCwCn',
                'ncCcn',
                '.nnn.'
            ]
        ]
    }
];
