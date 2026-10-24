// Every gameplay knob in one place. Legacy (v1, 800x600) numbers are kept verbatim where they exist and
// converted to the 640x360 playfield with the SCALE factors below, so the feel of v1 is preserved while
// distances/speeds fit the smaller screen. Change numbers here, not in the gameplay modules.

// v1 ran at 800x600; vertical travel is what matters for a top-down shooter, so speeds scale by 360/600.
export const SPEED_SCALE = 0.6;

export const PLAYER = {
    hitRadius: 3,            // TRUE hitbox (the hitbox_dot marker shows it); independent of sprite size
    grazeRadius: 10,         // a bullet passing within hitRadius+bulletRadius+grazeRadius is a graze
    invulnMs: 1000,          // i-frames after taking damage (v1: 1000)
    shotSpeed: 700 * SPEED_SCALE,
    shotRadius: 2,
    fireRateScale: 1,        // multiplies the ship's fire-rate interval (1 = v1)
    bankThreshold: 30,       // |vx| (px/s) above which the bank frame shows
    contactDamage: 20,       // ramming an enemy (v1: 20 to player, 10 to the enemy)
    contactDamageToEnemy: 10,
    // keep the ship this far from the screen edges; the bottom margin keeps it (and its hitbox) above the HUD strip
    // (HP bar / ability slots) so the HUD never hides where you are
    marginX: 8, marginTop: 12, marginBottom: 40
};

// v1 ship classes (Player.applyShipStats). speed in v1 px/s; accel/decel are v1's per-frame lerp percentages.
export const SHIPS = {
    normal: { hp: 100, speed: 430, accel: 60, decel: 30, damage: 20, fireRate: 500, accent: 0x39e7ff },
    speedy: { hp: 80, speed: 550, accel: 80, decel: 50, damage: 15, fireRate: 400, accent: 0xb7ff4a },
    tank: { hp: 140, speed: 300, accel: 40, decel: 20, damage: 25, fireRate: 650, accent: 0xffb547 }
};
export const DIAGONAL_FACTOR = 0.8;    // v1 normalised diagonals to 80% speed

// Abilities: level 1 = v1 values; later levels come from the upgrade list (systems/upgrades.js).
export const ABILITIES = {
    dash: { cooldown: [5000, 3800, 2800], duration: [200, 220, 260], speed: 900 * SPEED_SCALE },
    forcefield: { cooldown: [18000, 15000, 12000], bubbleMs: [900, 1200, 1600], cancelPoints: 5 },
    phase: { cooldown: [16000, 14000, 12000], duration: [2500, 2800, 3200] },
    thrusters: { bonus: [100, 60] }      // v1: +100 speed (v1 px/s, scaled by SPEED_SCALE)
};

export const ENEMY_BULLET = {
    damage: 10,              // v1 enemy bullet damage
    speed: 300 * SPEED_SCALE, // v1 enemy bullet speed; patterns use multiples of this
    cullMargin: 24,          // bullets this far off-screen are recycled
    maxAgeMs: 14000
};

// Waves. The v1 table (duration / enemy mix / spawn frequency / max active) lives in objects/waves.js verbatim;
// these knobs adapt it to the smaller screen and faster pacing.
export const WAVES = {
    durationScale: 0.67,     // v1 waves are 30s..180s; 0.67 -> 20s..120s keeps runs snappy
    maxActiveScale: 0.65,    // 640x360 has ~half the area of 800x600; fewer ships, denser patterns reads better
    spawnJitter: 0.3,        // v1: +-30% random spawn interval
    minSpawnMs: 300,
    staggerMs: 800,          // v1: each enemy type starts 800ms after the previous one
    introMs: 2000,           // v1 waveStartDelay: banner before spawning starts
    clearToUpgradeMs: 2500,  // v1: wave complete -> upgrade screen
    upgradeToNextMs: 1500,   // v1: pick -> next wave
    spawnMarginX: 40,
    firstAttackMs: [300, 1500],   // v1 random initial attack delay
    // v2: a basic-enemy spawn sometimes arrives as a V of three flying in sync (keeps early waves lively)
    formationChance: [0.3, 0.25, 0.15, 0.1],    // by tier (late waves have enough going on)
    formationSpacing: 26,
    // pattern tier by wave (index = wave-1; waves past the end use the last entry). 0 = v1 behaviour.
    // Spread over the 20 authored waves (it used to max out at wave 8, built for v1's 10 boss-less waves).
    tierByWave: [0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
    // which v1 table row (waves.js, 1-based) each wave plays; values past the table's 10 rows are the last row plus
    // that many endless steps (endlessSpawnFactor / endlessBulletSpeedStep). The v1 table was 10 waves with no
    // bosses; with bosses on 3/5/8/10/... the timed waves used to reach row 10 at wave 11 and go endless from there.
    // Boss-wave entries are unused. Past wave 20: the last entry + 1 endless step per wave.
    tableRowByWave: [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8, 8, 9, 9, 10, 11, 11, 12, 12],
    maxHovering: 2,          // at most this many spiral-casting (hovering) enemies at once, so patterns stay legible
    // background biome per wave (fx/bgArt BIOMES: 0 violet, 1 teal, 2 magenta, 3 dusk, 4 toxic). Magenta/dusk are
    // avoided because magenta orbs / amber needles would melt into them. Past the end it alternates the last two.
    biomeByWave: [0, 0, 0, 1, 1, 1, 4, 4, 0, 1],
    // endless mode after the last authored wave: each extra wave multiplies spawn intervals by this
    endlessSpawnFactor: 0.92,
    endlessBulletSpeedStep: 0.03
};

// Boss HP. Boss defs (objects/bosses/*) hold each boss's own base HP; the player's damage output grows a lot over a
// run (weapon levels, secondaries, synergies), and main bosses 2-3 are shuffled between waves 10 and 15, so the HP
// multiplier is set by the WAVE the fight happens on. Tuned with the balance bot (docs/BALANCE.md).
export const BOSSES = {
    hpByWave: { 3: 0.5, 5: 1.1, 8: 1.2, 10: 1.3, 13: 4.5, 15: 2.4, 18: 4, 20: 9.5 },   // past wave 20: the wave-20 value (+ cycle)
    cycleHp: 0.6                                                        // endless: each pass through the roster
};
export const bossHpScale = (wave) => BOSSES.hpByWave[wave] ?? BOSSES.hpByWave[((wave - 1) % 20) + 1] ?? 1;

// Bullet speed multiplier per tier: late waves get faster, denser patterns.
export const TIER_BULLET_SPEED = [0.9, 1, 1.05, 1.1];

export const COMBO = {
    windowMs: 2600,          // time to keep the chain alive at x1..
    minWindowMs: 1400,       // ..shrinking to this at high multipliers
    windowShrinkPerLevel: 120,
    killEnergy: 0.35,        // energy per kill (1 energy = +1 multiplier); scaled by enemy value / 100
    grazeEnergy: 0.12,
    maxMultiplier: 16
};

export const SCORE = {
    graze: 25,               // x combo multiplier
    basic: 100, spread: 150, circular: 200,   // v1 enemy score values
    meteor_s: 50, meteor_m: 100, meteor_l: 200
};

export const JUICE = {
    hitStopBigKillMs: 45,
    hitStopDamageMs: 60,
    lowHp: 0.3,              // fraction of maxHp that triggers the warning pulse
    lowHpPulseMs: 1100,
    dashIntensity: 3.2,      // background streak intensity during a dash (1 = calm)
    intensityDecay: 3,       // per second
    deathSlowmo: 0.3,
    deathToGameOverMs: 2200, // real ms from death to the GameOver scene
    sfxThrottleMs: 70        // min gap between repeated enemy-shoot / graze sounds
};
