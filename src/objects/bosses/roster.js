// Which boss fights on which wave, plus the persistent boss log (seen / defeated / fastest kill) for the gallery.
//   main bosses: every BOSS_EVERY-th wave (5, 10, 15 ...); wave 20 (and every 20th after) is THE STARBURST
//   mid-bosses:  two waves before each main boss (3, 8, 13, 18 ...)
// A run's main-boss order is planned when the run starts: the Warden always opens sector 1, sectors 2-3 get the
// two main bosses this player has seen least (so new players meet new bosses and the gallery fills up), and
// endless mode after the final boss cycles through all of them with a rising MK level.
import { save } from '../../systems/Save.js';
import { BOSS_EVERY } from '../waves.js';
import Warden, { WARDEN } from './Warden.js';
import Hive, { HIVE } from './Hive.js';
import Prism, { PRISM } from './Prism.js';
import Tempest, { TEMPEST } from './Tempest.js';
import Colossus, { COLOSSUS } from './Colossus.js';
import Starburst, { STARBURST } from './Starburst.js';
import Lancer, { LANCER } from './Lancer.js';
import Gyre, { GYRE } from './Gyre.js';
import Bastion, { BASTION } from './Bastion.js';
import Manta, { MANTA } from './Manta.js';

export const FINAL_EVERY = 20;
export const MID_OFFSET = 3;

export const MAIN = [Warden, Hive, Prism, Tempest, Colossus];
export const MINI = [Lancer, Gyre, Bastion, Manta];
export const FINAL = Starburst;
const PAIRS = [[WARDEN, Warden], [HIVE, Hive], [PRISM, Prism], [TEMPEST, Tempest], [COLOSSUS, Colossus],
    [LANCER, Lancer], [GYRE, Gyre], [BASTION, Bastion], [MANTA, Manta], [STARBURST, Starburst]];
export const BY_ID = Object.fromEntries(PAIRS.map(([d, C]) => [d.id, C]));
const ID_OF = new Map(PAIRS.map(([d, C]) => [C, d.id]));
export const DEF_OF = Object.fromEntries(PAIRS.map(([d]) => [d.id, d]));

/** gallery order + flavour text (sprite key / frame to show) */
export const GALLERY = [
    { def: LANCER, key: 'boss_lancer', blurb: 'FAST STRAFING RUNS. WATCH THE NOSE.' },
    { def: GYRE, key: 'boss_gyre', blurb: 'DIVES DOWN AMBER LANES. STAY OUT.' },
    { def: BASTION, key: 'boss_bastion', blurb: 'SHELLS AND A SWEEPING BEAM.' },
    { def: MANTA, key: 'boss_manta', blurb: 'BLINKS AWAY. FOLLOW THE AMBER RING.' },
    { def: WARDEN, key: 'boss_warden', blurb: 'BROADSIDES FROM THE WING PODS.' },
    { def: HIVE, key: 'boss_hive', blurb: 'LAUNCHES DRONES. MORTARS BURST.' },
    { def: PRISM, key: 'boss_prism', blurb: 'ONLY HURT WHILE THE EYE IS OPEN.' },
    { def: TEMPEST, key: 'boss_tempest', blurb: 'BEAM WALLS AND GRAVITY WELLS.' },
    { def: COLOSSUS, key: 'boss_colossus', blurb: 'BREAK FOUR PLATES TO OPEN THE CORE.' },
    { def: STARBURST, key: 'boss_starburst', blurb: 'THE HEART OF THE SECTOR.' }
];

export const isMainBossWave = (w) => w > 0 && w % BOSS_EVERY === 0;
export const isMidBossWave = (w) => w > 0 && w % BOSS_EVERY === MID_OFFSET;
export const isBossWave = (w) => isMainBossWave(w) || isMidBossWave(w);
export const isFinalWave = (w) => w > 0 && w % FINAL_EVERY === 0;

/** this run's main-boss order (see header) */
export function planRun() {
    const log = bossLog();
    const rest = MAIN.slice(1).map((C) => ({ C, seen: log[ID_OF.get(C)]?.seen ?? 0, r: Math.random() }));
    rest.sort((a, b) => a.seen - b.seen || a.r - b.r);
    return [MAIN[0], ...rest.map((o) => o.C)];
}

/** { Cls, cycle } for a boss wave (null for normal waves). order = planRun() result. */
export function bossFor(wave, order) {
    if (isMidBossWave(wave)) {
        const slot = Math.floor(wave / BOSS_EVERY);
        return { Cls: MINI[slot % MINI.length], cycle: Math.floor(slot / MINI.length) };
    }
    if (!isMainBossWave(wave)) return null;
    if (isFinalWave(wave)) return { Cls: FINAL, cycle: wave / FINAL_EVERY - 1 };
    const sector = wave / BOSS_EVERY, slot = sector - 1 - Math.floor(sector / 4);   // sectors 4, 8, ... are finals
    return { Cls: order[slot % order.length], cycle: Math.floor(slot / order.length) + Math.floor((wave - 1) / FINAL_EVERY) };
}

// ---- persistent log -------------------------------------------------------------------------------------------
export function bossLog() { const l = save.bossLog; return l && typeof l === 'object' ? l : {}; }

export function logBoss(id, event, ms) {
    const log = bossLog();
    const e = (log[id] ??= { seen: 0, kills: 0, best: 0 });
    if (event === 'seen') e.seen++;
    else if (event === 'kill') { e.kills++; if (ms && (!e.best || ms < e.best)) e.best = Math.round(ms); }
    save.bossLog = log;
}
