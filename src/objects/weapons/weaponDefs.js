// Weapon data. Damage and fire-rate numbers are MULTIPLIERS of the ship's own stats (tuning.SHIPS damage /
// fireRate), so ship identity survives every weapon: the speedy ship stays a quick light hitter, the tank a slow
// heavy one. levels[i] = what owning level i+1 gives; `desc` is the upgrade-card text for BUYING that level.
//
// Loadout model: exactly one PRIMARY is equipped (picking another primary swaps to it; levels are kept, so you can
// swap back), SECONDARIES stack on top and fire on their own, SYNERGIES are rare global perks unlocked when two
// weapon lines are both at level SYNERGY_MIN or more.

export const PRIMARY = {
    blaster: {
        title: 'BLASTER', icon: 'card_blaster',
        levels: [
            { desc: 'Steady single shot', barrels: 1, dmg: 1, rate: 1 },
            { desc: 'Twin barrels', barrels: 2, dmg: 0.75, rate: 1 },
            { desc: 'Twin barrels hit harder, fire faster', barrels: 2, dmg: 1, rate: 0.85 },
            { desc: 'Triple barrels', barrels: 3, dmg: 1, rate: 0.8 }
        ]
    },
    spread: {
        title: 'SPREAD', icon: 'card_spread',
        levels: [
            { desc: 'Fan of 3 pellets. Swaps your primary', count: 3, arc: 26, dmg: 0.6, rate: 1.1 },
            { desc: 'Fan of 5 pellets', count: 5, arc: 40, dmg: 0.6, rate: 1.1 },
            { desc: 'Heavier pellets, faster', count: 5, arc: 40, dmg: 0.75, rate: 1 },
            { desc: 'Fan of 7 pellets', count: 7, arc: 54, dmg: 0.75, rate: 1 }
        ]
    },
    lance: {
        title: 'LANCE', icon: 'card_lance',
        levels: [
            { desc: 'Fast bolt pierces 2 ships. Swaps your primary', pierce: 2, dmg: 1.3, rate: 1.35, twin: false },
            { desc: 'Pierces 3, more damage', pierce: 3, dmg: 1.5, rate: 1.3, twin: false },
            { desc: 'Pierces 4, faster', pierce: 4, dmg: 1.7, rate: 1.15, twin: false },
            { desc: 'Twin lances', pierce: 5, dmg: 1.7, rate: 1.15, twin: true }
        ]
    },
    charge: {
        title: 'CHARGE', icon: 'card_charge',
        levels: [
            { desc: 'Hold fire to charge, release a piercing orb. Swaps primary', chargeMs: 1000, dmg: 5, nova: false },
            { desc: 'Charges faster, hits harder', chargeMs: 800, dmg: 6, nova: false },
            { desc: 'Charges faster, hits harder', chargeMs: 650, dmg: 7, nova: false },
            { desc: 'Full charge also fires a ring of pellets', chargeMs: 550, dmg: 8, nova: true }
        ]
    }
};

export const SECONDARY = {
    missiles: {
        title: 'MISSILES', icon: 'card_missiles',
        levels: [
            { desc: 'Auto-launches a homing missile', every: 1300, count: 1, dmg: 1.1, splash: 0 },
            { desc: 'Missiles launch in pairs', every: 1100, count: 2, dmg: 1.1, splash: 0 },
            { desc: 'Faster launches, blast damage', every: 900, count: 2, dmg: 1.3, splash: 22 }
        ]
    },
    drones: {
        title: 'DRONES', icon: 'card_drones',
        levels: [
            { desc: 'An orbiting drone shoots the nearest enemy', count: 1, every: 650, dmg: 0.45, block: false },
            { desc: 'Two drones', count: 2, every: 600, dmg: 0.5, block: false },
            { desc: 'Three drones that also absorb enemy bullets', count: 3, every: 550, dmg: 0.55, block: true }
        ]
    }
};

export const SYNERGY_MIN = 2;
export const SYNERGIES = {
    splinter: { title: 'SPLINTER', icon: 'card_splinter', needs: ['spread', 'lance'], desc: 'All shots pierce one extra enemy' },
    swarm: { title: 'SWARM', icon: 'card_swarm', needs: ['missiles', 'drones'], desc: 'Drones fire seeker missiles' },
    overload: { title: 'OVERLOAD', icon: 'card_overload', needs: ['charge', 'lance'], desc: 'Charged orbs pierce everything and split into lances' },
    hunter: { title: 'HUNTER', icon: 'card_hunter', needs: ['blaster', 'missiles'], desc: 'Blaster shots home in on enemies' }
};

/** ship identity applied to every weapon: arc = spread width, speed = shot speed, heavy = fat tank slugs */
export const SHIP_WEAPON = {
    normal: { arc: 1, speed: 1, heavy: false },
    speedy: { arc: 0.6, speed: 1.15, heavy: false },
    tank: { arc: 1.25, speed: 0.85, heavy: true }
};

// shot styles for BulletPool.spawn (orient: drawn pointing up, rotated to the travel angle)
const st = (key, r) => ({ key, base: key, r, orient: true });
export const SHOT = {
    basic: st('pshot_basic', 2), heavy: st('wshot_heavy', 3), pellet: st('wshot_pellet', 2), lance: st('wshot_lance', 2),
    missile: st('wshot_missile', 3), chargeS: st('wshot_charge_s', 3), chargeM: st('wshot_charge_m', 5), chargeL: st('wshot_charge_l', 7)
};

export const MISSILE = { speed: 140, accel: 380, maxSpeed: 330, turn: 5, fuseMs: 2600 };
export const DRONE = { radius: 22, spin: 2.4, range: 240, blockR: 6 };
export const BUFF_RATE = 0.55;    // rapid-fire power-up: fire interval multiplier

export const isWeaponId = (id) => typeof id === 'string' && (id.startsWith('w:') || id.startsWith('syn:'));
