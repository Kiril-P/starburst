// Dev-only __dbg additions for enemies / formations / sectors (installed by systems/debug.js).
//   __dbg.formation('pincer:spread')   launch a formation now (ignores the max-active cap)
//   __dbg.sector(3)                    jump to the first wave of sector 3 (1-based)
//   __dbg.biome(6)                     crossfade the backdrop to a biome (fx/bgArt BIOMES index)
//   __dbg.zoo()                        one of every new enemy type, spread across the top
//   __dbg.enemies()                    -> { sniper: 2, mine: 5, ... } live counts by type
import { W } from '../config.js';
import { BOSS_EVERY } from './waves.js';
import { FORMATION_NAMES } from './formations.js';

const ZOO = ['sniper', 'kamikaze', 'shield', 'turret', 'minelayer', 'splitter', 'strafer', 'seeker', 'pylon', 'emitter', 'warper'];

export function installEnemyDebug(g, dbg) {
    Object.assign(dbg, {
        formations: FORMATION_NAMES,
        formation(spec = 'vee') { return g.waves.formations.launch(spec, true); },
        sector(n = 1) { dbg.skipToWave((n - 1) * BOSS_EVERY + 1); return g.waves.cfg.opener; },
        biome(i, ms = 1200) { g.bg.setBiome(i, ms); return i; },
        zoo(types = ZOO) { types.forEach((t, i) => g.waves.spawn(t, Math.round((W * (i + 1)) / (types.length + 1)), -14)); return types.length; },
        enemies() {
            const out = {};
            for (const e of g.waves.live) if (e.alive) out[e.typeName] = (out[e.typeName] || 0) + 1;
            return out;
        }
    });
}
