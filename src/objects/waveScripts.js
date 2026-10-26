// Per-wave identity for the timed waves (boss waves 3,5,8,10,... keep their own intros). Each script replaces the
// sector filler mix with one idea, introduced alone and then combined:
//   name/sub  banner at wave start        spawns [type, everyMs, firstDelayMs?]   opener  set piece launched at once
//   durMul / maxMul  scale the wave timer / active cap     clear  line on the wave-clear banner
//   events    timeline (pct | at | end) -> banner, toast, form, supply, calm, surge   (runtime: waveEvents.js)
// Each sector's last timed wave (4, 9, 14, 19) is a FINALE ending in a surged FINAL PUSH before the boss.
// Endless: wave n reuses the script of ((n-1) % 20) + 1.
const PUSH = (forms) => ({ end: 9000, banner: ['FINAL PUSH', 'HOLD ON'], surge: 1.6, form: forms });

export const SCRIPTS = {
    1: { name: 'FIRST CONTACT', sub: 'YOUR SHOT FIRES STRAIGHT UP', clear: 'GOOD START', durMul: 1,
        spawns: [['basic', 2300]], opener: 'line',
        events: [{ at: 4500, toast: 'GRAZE BULLETS TO BUILD COMBO', color: '#39e7ff' }, { pct: 0.6, form: 'line' }] },
    2: { name: 'INTERCEPTORS', sub: 'THEY FLY IN FORMATION', clear: 'FORMATION BROKEN',
        spawns: [['basic', 2600], ['f:vee', 7000], ['f:sweep', 11000, 9000]], opener: 'vee',
        events: [{ at: 7000, toast: 'CHAIN KILLS FAST FOR COMBO', color: '#39e7ff' }, { pct: 0.55, toast: 'RAIDERS CROSS THE SCREEN. SHOOT ON THE MOVE', form: 'crossfire' }, { pct: 0.8, form: ['sweep', 'vee'] }] },
    4: { name: 'CROSSFIRE', sub: 'NEEDLES JOIN THE WALL', clear: 'SECTOR EDGE REACHED',
        spawns: [['basic', 2000], ['spread', 3600, 5000], ['f:vee', 9000], ['f:crossfire', 13000, 9000]], opener: 'wall',
        events: [
            { pct: 0.3, toast: 'FIND THE GAP', form: 'wall' },
            { pct: 0.5, banner: ['AMBUSH!', 'DRONES FROM ABOVE'], form: ['rush', 'rush'], gapMs: 2400 },
            PUSH(['wall', 'pincer', 'crossfire'])
        ] },
    6: { name: 'ROCK SHOWER', sub: 'BIG ROCKS SPLIT WHEN SHOT', clear: 'FIELD CROSSED', durMul: 0.8,
        spawns: [['meteor', 2000], ['f:shower', 7000], ['basic', 3000, 5000], ['f:hunt', 15000, 11000], ['f:crossfire', 14000, 5000]], opener: 'shower',
        events: [
            { pct: 0.35, toast: 'LANES OPEN BETWEEN THE ROCKS', form: ['shower', 'shower'], gapMs: 1500 },
            { pct: 0.55, banner: ['SEEKERS', 'THEY TURN SLOWLY. ARC AWAY'], form: 'hunt' },
            { end: 12000, form: ['shower', 'hunt'], gapMs: 2000 }
        ] },
    7: { name: 'MINEFIELD', sub: 'SHOOT ONE MINE, POP THE CLUSTER', clear: 'MINES CLEARED', durMul: 0.8,
        spawns: [['minelayer', 9000], ['basic', 2600, 3000], ['f:vee', 11000, 7000], ['f:crossfire', 15000, 12000]], opener: 'minefield',
        events: [
            { pct: 0.4, banner: ['MINE BLOOM', 'ONE SHOT POPS THE RING'], form: 'bloom' },
            { pct: 0.7, form: ['bloom', 'sweep', 'crossfire'], gapMs: 3000 }
        ] },
    9: { name: 'SWARM', sub: 'PODS SPLIT. DRONES ZIP.', clear: 'HIVE SILENCED', durMul: 0.8,
        spawns: [['splitter', 5200], ['basic', 2800], ['f:swarm', 7500], ['f:rush', 16000, 9000], ['f:hunt', 17000, 12000], ['f:crossfire', 16000, 7000]], opener: 'swarm',
        events: [
            { pct: 0.25, toast: 'AMBER SHIPS CHAIN-EXPLODE', form: 'fuse' },
            { pct: 0.55, banner: ['BROOD', 'THEY ALL DIVE'], form: ['rush', 'rush', 'hunt'], gapMs: 2600 },
            PUSH(['fuse', 'rush', 'hunt'])
        ] },
    // ---- sector 3: the station. Beams are the idea: telegraphed, tracking, locking. Standing still is the one thing that never works.
    11: { name: 'LOCKDOWN', sub: 'BEAMS LOCK ON AFTER A WARNING', clear: 'LOCKDOWN LIFTED', durMul: 0.72,
        spawns: [['basic', 3200], ['f:crossfire', 14000, 13000], ['sniper', 16000, 28000]], opener: 'lasergate',
        events: [
            { at: 3500, toast: 'THE LINE LOCKS, THEN FIRES. KEEP MOVING' },
            { pct: 0.32, toast: 'SEEKER DRONES. SHOOT THEM OR ARC AWAY', form: 'hunt' },
            { pct: 0.55, banner: ['WALL EMITTERS', 'BEAMS FROM THE SIDES'], form: 'crossbeam' },
            { pct: 0.75, form: ['turretline'] },
            { end: 8000, banner: ['FINAL PUSH', 'HOLD ON'], surge: 1.4, form: ['lasergate', 'crossfire'], gapMs: 2200 }
        ] },
    12: { name: 'SECURITY SWEEP', sub: 'GRAB THE SUPPLIES. DODGE THE BEAMS.', clear: 'LOADED UP', durMul: 0.62, maxMul: 0.6,
        spawns: [['basic', 3800], ['meteor', 9000, 6000], ['f:hunt', 20000, 12000]], opener: '',
        events: [
            { at: 1000, banner: ['SUPPLY DROP', 'COLLECT EVERYTHING'], supply: { gem_m: 8, gem_l: 2, repair: 1 } },
            { pct: 0.25, banner: ['SECURITY SWEEP', 'THEY GUARD THE LOOT'], form: 'crossbeam' },
            { pct: 0.4, supply: { gem_m: 8, x2: 1, gem_l: 2 } },
            { pct: 0.58, toast: 'TOO QUIET...', supply: { gem_m: 6, magnet: 1 }, form: 'lasergate' },
            { pct: 0.78, banner: ['AMBUSH!', 'ESCORTED CARRIER'], form: ['escort', 'rush'], gapMs: 2500 }
        ] },
    14: { name: 'GAUNTLET', sub: 'GUNS, SHIELDS, BEAMS AND SNIPERS', clear: 'GAUNTLET RUN', durMul: 0.8,
        spawns: [['turret', 11000, 7000], ['basic', 3000], ['shield', 15000, 8000], ['sniper', 13000, 16000], ['f:crossfire', 17000, 20000]], opener: 'lasergate',
        events: [
            { pct: 0.2, toast: 'SHOOT THE ESCORTS FIRST', form: 'escort' },
            { pct: 0.38, banner: ['CROSSBEAM', 'WALLS AND CEILING'], form: ['crossbeam', 'hunt'], gapMs: 3200 },
            { pct: 0.58, form: ['wall', 'escort'], gapMs: 3500 },
            PUSH(['wall', 'lasergate', 'pincer:spread'])
        ] },
    16: { name: 'KAMIKAZE RUSH', sub: 'THEY DIVE STRAIGHT. SIDESTEP.', clear: 'RUSH BROKEN', durMul: 0.65,
        spawns: [['basic', 3200], ['f:rush', 8000], ['f:swarm', 12000, 6000], ['f:crossfire', 15000, 10000]], opener: 'rush',
        events: [
            { pct: 0.35, banner: ['WARPERS', 'THEY BLINK. HIT THEM WHILE SOLID'], form: 'blink' },
            { pct: 0.55, banner: ['SOLAR FLARE', 'DRONES EVERYWHERE'], form: ['rush', 'rush', 'swarm'], gapMs: 2200 },
            { end: 9000, surge: 1.5, form: ['crossfire'] }
        ] },
    17: { name: 'SPIRAL DANCE', sub: 'FOLLOW THE ARM. DODGE THE RINGS.', clear: 'DANCE OVER', durMul: 0.65,
        spawns: [['basic', 3400], ['f:spiral', 8000], ['circular', 6500, 8000], ['sniper', 14000, 16000], ['f:blink', 27000, 16000]], opener: 'spiral',
        events: [{ pct: 0.45, toast: 'TWO ARMS NOW', form: ['spiral', 'spiral:spread'], gapMs: 1800 }, { pct: 0.7, banner: ['WARPERS', 'HIT THEM WHILE SOLID'], form: 'blink' }, { end: 10000, form: ['spiral:spread'] }] },
    19: { name: 'LAST STAND', sub: 'EVERYTHING AT ONCE', clear: 'THE WAY IS OPEN', durMul: 0.8,
        spawns: [['basic', 2400], ['spread', 3500, 3000], ['turret', 11000, 8000], ['shield', 15000, 12000], ['circular', 7000, 6000], ['f:swarm', 11000, 18000]], opener: 'wall',
        events: [
            { pct: 0.15, form: 'escort' }, { pct: 0.3, toast: 'AMBER SHIPS CHAIN-EXPLODE', form: ['fuse', 'spiral'], gapMs: 2600 },
            { pct: 0.45, banner: ['LASER GRID', 'CEILING AND WALLS'], form: ['lasergate', 'crossbeam'], gapMs: 2800 },
            { pct: 0.62, banner: ['LAST STAND', 'NO MORE SECTORS'], form: ['rush', 'blink', 'turretline'], gapMs: 3000 },
            PUSH(['wall', 'rush', 'hunt', 'pincer:spread'])
        ] }
};

// Mid-boss reinforcements: spawners that run while a mid-boss is in its fight phase (3 / 8 / 13 / 18; endless reuses ((n-1) % 20) + 1).
// Formations only, and WaveManager.spawnGroup still asks for room, so they never stack on top of each other.
const MID_ADDS = {
    3: [['f:crossfire', 18000, 11000]],
    8: [['f:hunt', 15000, 8000]],
    13: [['f:crossfire', 14000, 8000], ['f:hunt', 19000, 12000]],
    18: [['f:crossfire', 13000, 8000], ['f:blink', 21000, 14000]]
};
export const midAddsFor = (wave) => MID_ADDS[((Math.max(1, wave) - 1) % 20) + 1] ?? null;

export const scriptFor = (wave) => SCRIPTS[((Math.max(1, wave) - 1) % 20) + 1] ?? null;

/** Replace the sector mix with this wave's script (mutates + returns cfg). spawnF = the wave's interval factor. */
export function applyScript(cfg, wave, spawnF) {
    const sc = scriptFor(wave);
    if (!sc || cfg.opener === undefined) return cfg;   // boss waves: applySector left no opener
    cfg.script = sc;
    cfg.duration *= sc.durMul ?? 1;
    cfg.max = Math.max(4, Math.round(cfg.max * (sc.maxMul ?? 1)));
    const f = Math.sqrt(spawnF);
    cfg.spawns = sc.spawns.map(([type, every, delay]) => ({ type, every: every * f, delay }));
    cfg.reserve = 0;
    cfg.opener = sc.opener;
    cfg.events = sc.events ?? [];
    return cfg;
}
