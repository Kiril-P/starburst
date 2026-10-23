// Loot tuning: what pickups exist, what they give, and how often enemies drop them. Numbers only; the rules
// that use them live in objects/pickups/Loot.js, the timed effects in objects/pickups/PowerUps.js.

// kind: gem (score, magnets in), repair (heal), buff (timed power-up), bomb (instant)
export const PICKUPS = {
    gem_s: { kind: 'gem', key: 'gem_s', value: 10, r: 4 },
    gem_m: { kind: 'gem', key: 'gem_m', value: 50, r: 5 },
    gem_l: { kind: 'gem', key: 'gem_l', value: 250, r: 6 },
    repair: { kind: 'repair', key: 'pickup_repair', heal: 0.15, r: 7, title: 'HULL REPAIR' },
    magnet: { kind: 'buff', key: 'pickup_magnet', ms: 9000, r: 7, title: 'MAGNET' },
    rapid: { kind: 'buff', key: 'pickup_rapid', ms: 8000, r: 7, title: 'RAPID FIRE' },
    x2: { kind: 'buff', key: 'pickup_x2', ms: 10000, r: 7, title: 'SCORE X2' },
    shield: { kind: 'buff', key: 'pickup_shield', ms: 15000, r: 7, title: 'SHIELD' },   // lasts until it absorbs a hit
    bomb: { kind: 'bomb', key: 'pickup_bomb', r: 7, title: 'BOMB' }
};

export const LOOT = {
    gemChance: 0.85,          // chance a kill drops gems at all
    gemBudget: 0.4,           // gem value dropped = enemy score x this (split into l/m/s gems)
    maxSmallGems: 3,
    gemEnergy: 0.03,          // combo energy per gem: collecting keeps a chain alive a little
    repairChance: 0.03,       // per kill
    repairLowHpMul: 2.5,      // .. multiplied when the hull is below lowHp
    lowHp: 0.4,
    repairPityKills: 45,      // guaranteed repair after this many kills without one (if not near full)
    powerChance: 0.022,       // per kill; big enemies x bigMul
    bigMul: 2.5,
    powerGapMs: 7000,         // min sim time between power-up drops
    maxPowerOnField: 2,
    powerWeights: { magnet: 3, rapid: 3, x2: 2, shield: 2, bomb: 1.5 },
    // boss burst
    boss: { gem_l: 6, gem_m: 10, gem_s: 16, repair: 2, power: 2 }
};

export const PICKUP_MOTION = {
    drag: 3.2,                // per second, on the spawn burst
    fall: 40,                 // px/s drift toward the bottom once the burst settles
    floorY: 50,               // stop drifting this far above the bottom edge (stays reachable above the HUD)
    magnetR: 34,              // gems/repairs fly to the ship inside this radius (anything, when MAGNET is on)
    capsuleMagnetR: 18,
    magnetSpeed: 340,
    collectR: 10,
    lifeMs: { gem: 10000, repair: 12000, buff: 12000, bomb: 12000 },
    blinkMs: 2500
};
