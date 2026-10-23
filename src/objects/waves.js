// The v1 wave table, verbatim from legacy/objects/WaveManager.js (duration ms, spawn frequency ms per type,
// max active enemies). v2 adds meteors from wave 3 as a light extra hazard. Tuning knobs that adapt this
// table to 640x360 (duration/max-active scale, pattern tiers, endless mode) live in systems/tuning.js.
// Every BOSS_EVERY-th wave is a boss fight instead of a timed wave (objects/bosses/).
// On top of this table: sectors.js layers each sector's enemy mix, opener formation and pace onto every wave
// (WaveManager.config), and formations.js holds the scripted set pieces (V, sweep, pincer, circle-in, swarm, ...).
export const BOSS_EVERY = 5;

export const WAVE_TABLE = [
    { duration: 30000, max: 8, spawns: [['basic', 2000]] },
    { duration: 45000, max: 10, spawns: [['basic', 1500]] },
    { duration: 60000, max: 12, spawns: [['basic', 2000], ['spread', 3500], ['meteor', 7000]] },
    { duration: 75000, max: 15, spawns: [['basic', 1500], ['spread', 3000], ['meteor', 6500]] },
    { duration: 90000, max: 18, spawns: [['basic', 1500], ['spread', 2500], ['circular', 5000], ['meteor', 6000]] },
    { duration: 105000, max: 20, spawns: [['basic', 1200], ['spread', 2200], ['circular', 4000], ['meteor', 6000]] },
    { duration: 120000, max: 22, spawns: [['basic', 1200], ['spread', 2000], ['circular', 3500], ['meteor', 5500]] },
    { duration: 135000, max: 25, spawns: [['basic', 1000], ['spread', 1800], ['circular', 3000], ['meteor', 5000]] },
    { duration: 150000, max: 28, spawns: [['basic', 900], ['spread', 1500], ['circular', 2500], ['meteor', 5000]] },
    { duration: 180000, max: 30, spawns: [['basic', 800], ['spread', 1200], ['circular', 2000], ['meteor', 4500]] }
];
