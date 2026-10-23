// Meta progression: credits earned per run, permanent HANGAR upgrades, ship unlocks and the run mode
// (normal / daily). Pure data + save bookkeeping; scenes (Hangar, GameOver) and the in-run hook
// (scenes/run/RunMeta.js) call into it. Every value is read from / written to Save, never cached, so the
// menu, hangar and game always agree.
import { save } from './Save.js';
import { PLAYER } from './tuning.js';
import { dateKey, dailySeed } from './rng.js';

// ---- permanent upgrades ---------------------------------------------------------------------------------------
// costs[i] = price of tier i+1. Small steps on purpose: meta should smooth the curve, not trivialise the game.
export const META_UPGRADES = [
    { id: 'hull', title: 'REINFORCED HULL', icon: 'icon_heart', costs: [80, 160, 280, 450, 700], per: 10, desc: (n) => `+${n * 10} MAX HULL` },
    { id: 'cannons', title: 'CANNON COOLANT', icon: 'icon_firerate', costs: [100, 200, 350, 550], per: 0.05, desc: (n) => `FIRE RATE +${n * 5}%` },
    { id: 'damage', title: 'PLASMA CORE', icon: 'icon_damage', costs: [120, 240, 400, 640], per: 0.08, desc: (n) => `SHOT DAMAGE +${n * 8}%` },
    { id: 'graze', title: 'GRAZE FIELD', icon: 'icon_graze', costs: [90, 200, 360], per: 2, desc: (n) => `GRAZE RADIUS +${n * 2}PX` },
    { id: 'dash', title: 'DASH DRIVE', icon: 'icon_dash', costs: [300], desc: () => 'START RUNS WITH DASH [SHIFT]' },
    { id: 'shield', title: 'SHIELD EMITTER', icon: 'icon_forcefield', costs: [600], desc: () => 'START RUNS WITH FORCEFIELD [Z]' },
    { id: 'salvage', title: 'SALVAGE RIG', icon: 'icon_credit', costs: [150, 300, 500], per: 0.1, desc: (n) => `+${n * 10}% CREDITS PER RUN` }
];
const BY_ID = Object.fromEntries(META_UPGRADES.map((u) => [u.id, u]));

export const metaLevel = (id) => Math.min(save.metaLevels[id] ?? 0, BY_ID[id]?.costs.length ?? 0);
export const maxLevel = (id) => BY_ID[id].costs.length;
/** price of the next tier, or null when maxed */
export const nextCost = (id) => BY_ID[id].costs[metaLevel(id)] ?? null;

/** Spend credits on the next tier. Returns true if bought. */
export function buyUpgrade(id) {
    const cost = nextCost(id);
    if (cost === null || save.credits < cost) return false;
    save.credits -= cost;
    save.metaLevels = { ...save.metaLevels, [id]: metaLevel(id) + 1 };
    bumpLifetime({ purchases: 1 });
    return true;
}

/**
 * Apply the permanent upgrades to a freshly created Player. Player.stats points at the shared tuning table,
 * so it is replaced by a copy rather than mutated.
 */
export function applyMeta(player) {
    const lv = (id) => metaLevel(id);
    const st = { ...player.stats };
    st.fireRate = Math.round(st.fireRate * (1 - lv('cannons') * BY_ID.cannons.per));
    st.damage = Math.round(st.damage * (1 + lv('damage') * BY_ID.damage.per) * 10) / 10;
    player.stats = st;
    player.maxHp += lv('hull') * BY_ID.hull.per;
    player.hp = player.maxHp;
    player.grazeBonus = lv('graze') * BY_ID.graze.per;   // read by objects/collisions.js
    if (lv('dash') && !player.levels.dash) player.applyUpgrade('dash');
    if (lv('shield') && !player.levels.forcefield) player.applyUpgrade('forcefield');
}

/** graze radius the HUD/hangar can show */
export const grazeRadius = () => PLAYER.grazeRadius + metaLevel('graze') * BY_ID.graze.per;

// ---- ships ------------------------------------------------------------------------------------------------------
// A ship unlocks by beating its challenge OR by buying it in the hangar.
export const SHIP_UNLOCKS = {
    speedy: { cost: 600, challenge: 'CLEAR SECTOR 1 (WAVE 5)', met: () => save.highestWaveCompleted >= 5 },
    tank: { cost: 900, challenge: 'DEFEAT 2 BOSSES', met: () => save.bossesDefeated >= 2 }
};

export function isShipUnlocked(id) {
    const u = SHIP_UNLOCKS[id];
    return !u || save.unlockedShips.includes(id) || u.met();
}

export function buyShip(id) {
    const u = SHIP_UNLOCKS[id];
    if (!u || isShipUnlocked(id) || save.credits < u.cost) return false;
    save.credits -= u.cost;
    save.unlockedShips = [...new Set([...save.unlockedShips, id])];
    bumpLifetime({ purchases: 1 });
    return true;
}

// ---- run mode --------------------------------------------------------------------------------------------------
// Set by the menu right before scene.start('Game'); GameOver / RETRY read it back.
let run = { mode: 'normal', seed: null, date: null };

export function setRunMode(mode) {
    run = mode === 'daily' ? { mode, date: dateKey(), seed: dailySeed() } : { mode: 'normal', seed: null, date: null };
    return run;
}
export const runInfo = () => run;

// ---- credits ----------------------------------------------------------------------------------------------------
const DIFF_MULT = { easy: 0.75, normal: 1, hard: 1.4 };

/** Credits for a finished run, itemised for the GameOver screen. */
export function creditsForRun({ score = 0, wave = 1, bosses = 0 }, mode = run.mode, difficulty = save.difficulty) {
    const lines = [
        ['SCORE', Math.floor(score / 200)],
        ['WAVES', Math.max(0, wave - 1) * 4],
        ['BOSSES', bosses * 40]
    ];
    const base = lines.reduce((a, [, v]) => a + v, 0);
    let mult = mode === 'daily' ? 1.25 : DIFF_MULT[difficulty] ?? 1;
    mult *= 1 + metaLevel('salvage') * BY_ID.salvage.per;
    return { lines, base, mult, total: Math.round(base * mult) };
}

/** Add to the lifetime counters (runs, kills, ...). */
export function bumpLifetime(add) {
    const l = save.lifetime;
    for (const [k, v] of Object.entries(add)) l[k] = (l[k] ?? 0) + v;
    save.lifetime = l;
    return l;
}
