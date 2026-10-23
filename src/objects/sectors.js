// Sector progression: every BOSS_EVERY waves is one sector (4 timed waves + the boss). Each sector has a backdrop
// biome (fx/bgArt BIOMES), a banner, and an enemy mix layered on top of the v1 wave table (waves.js):
//   1 NEBULA          the v1 mix; the new enemies are introduced one at a time
//   2 ASTEROID FIELD  meteor-heavy (rock showers), mine layers, splitters
//   3 DERELICT STATION turrets bolted to the decks, shield carriers, snipers; few rocks
//   4 SOLAR STORM     fast: shorter waves, quicker bullets, kamikaze swarms
// Past sector 4 the themes repeat on top of the endless scaling (WaveManager.config).
// Spawner entries 'f:<formation>[:<enemy>]' launch a formation (formations.js) instead of a single enemy.
import { BOSS_EVERY } from './waves.js';

const RESERVE = 4;

export const SECTORS = [
    { name: 'NEBULA', sub: 'THE VIOLET DRIFT', biome: 0, color: '#8b62e0' },
    { name: 'ASTEROID FIELD', sub: 'ROCKS INBOUND', biome: 5, color: '#9aaad0' },
    { name: 'DERELICT STATION', sub: 'THE GUNS ARE STILL ONLINE', biome: 6, color: '#39e7ff' },
    { name: 'SOLAR STORM', sub: 'HEAT RISING  //  STAY FAST', biome: 7, color: '#ffb547' }
];

// Per sector: `mul` scales existing spawn intervals by type (>1 = rarer), `pace` scales duration / bullet speed,
// and plan[w] (w = wave within the sector, 0..3) gives the opener formation + extra spawners [type, everyMs].
const THEMES = [
    {
        mul: {}, pace: { duration: 1, bullets: 1 },
        plan: [
            { opener: 'vee', add: [['f:vee', 10000]] },
            { opener: 'swarm', add: [['f:sweep', 12000], ['f:swarm', 15000]] },
            { opener: 'sweep', add: [['sniper', 11000], ['f:pincer', 14000]] },
            { opener: 'pincer:spread', add: [['splitter', 8000], ['shield', 15000], ['f:circle', 16000]] }
        ]
    },
    {
        mul: { meteor: 0.45, basic: 1.2 }, pace: { duration: 1, bullets: 1 },
        plan: [
            { opener: 'shower', add: [['f:shower', 9000], ['minelayer', 13000], ['f:vee', 14000]] },
            { opener: 'vee:splitter', add: [['f:shower', 10000], ['splitter', 8000], ['minelayer', 12000]] },
            { opener: 'minefield', add: [['f:shower', 9000], ['minelayer', 10000], ['sniper', 14000], ['f:circle:splitter', 18000]] },
            { opener: 'circle', add: [['f:shower', 8000], ['splitter', 7000], ['minelayer', 9000], ['shield', 14000], ['f:swarm', 15000]] }
        ]
    },
    {
        mul: { meteor: 3, basic: 1.5, spread: 1.3, circular: 1.5 }, pace: { duration: 1, bullets: 1 },
        plan: [
            { opener: 'turrets', add: [['turret', 9000], ['f:sweep', 12000]] },
            { opener: 'pincer', add: [['turret', 8500], ['shield', 11000], ['sniper', 12000]] },
            { opener: 'snipers', add: [['turret', 8000], ['sniper', 10000], ['f:circle:spread', 16000], ['f:swarm', 14000]] },
            { opener: 'turrets', add: [['turret', 7000], ['shield', 10000], ['sniper', 11000], ['f:vee:splitter', 12000]] }
        ]
    },
    {
        mul: { basic: 1.4, spread: 1.15, circular: 1.4 }, pace: { duration: 0.85, bullets: 1.06 },
        plan: [
            { opener: 'swarm', add: [['f:sweep', 9000], ['f:swarm', 9000]] },
            { opener: 'pincer:kamikaze', add: [['f:swarm', 9000], ['sniper', 10000], ['splitter', 8000]] },
            { opener: 'circle:spread', add: [['f:swarm', 8000], ['minelayer', 11000], ['sniper', 10000]] },
            { opener: 'vee:splitter', add: [['f:swarm', 8000], ['turret', 10000], ['shield', 12000], ['splitter', 8000]] }
        ]
    }
];

/** 0-based sector index for a 1-based wave */
export const sectorOf = (wave) => Math.floor((Math.max(1, wave) - 1) / BOSS_EVERY);
export const sectorInfo = (wave) => SECTORS[sectorOf(wave) % SECTORS.length];
export const isSectorStart = (wave) => (wave - 1) % BOSS_EVERY === 0;
export const sectorBiome = (wave) => sectorInfo(wave).biome;

/** Layer the sector theme onto a WaveManager config (mutates + returns cfg). spawnF = the wave's interval factor. */
export function applySector(cfg, wave, spawnF) {
    const theme = THEMES[sectorOf(wave) % THEMES.length];
    const w = (wave - 1) % BOSS_EVERY;
    cfg.sector = sectorOf(wave);
    if (w >= theme.plan.length) return cfg;   // boss wave: nothing spawns
    const plan = theme.plan[w];
    for (const s of cfg.spawns) { s.every *= theme.mul[s.type] ?? 1; s.filler = true; }
    // the v1 filler may not take the last few slots: late waves spawn it so fast it would starve the sector's
    // own enemies and formations of room (WaveManager checks this reserve)
    cfg.reserve = RESERVE;
    // new enemies are not hit by the endless interval shrink as hard: they are already the escalation
    const f = Math.sqrt(spawnF);
    for (const [type, every] of plan.add) cfg.spawns.push({ type, every: every * f });
    cfg.opener = plan.opener;
    cfg.duration *= theme.pace.duration;
    cfg.bulletSpeed *= theme.pace.bullets;
    return cfg;
}
