// Between-wave upgrades. v1 offered "full heal" + one random not-yet-owned upgrade (dash, phase shift,
// forcefield, improved thrusters). v2 keeps that offer shape and adds levels to each ability
// (values in tuning.ABILITIES). When everything is maxed, a repeatable hull upgrade replaces it.
// Weapon cards (ids 'w:*' / 'syn:*') come from the run's Arsenal and are applied by it, not by Player.
import { ABILITIES } from './tuning.js';

const sec = (ms) => `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}S`;
const A = ABILITIES;

// levels[i] describes what buying level i+1 gives. `maxLevel` = levels.length.
export const UPGRADES = {
    dash: {
        title: 'DASH', icon: 'card_dash',
        levels: [
            `SHIFT: invulnerable burst dash. CD ${sec(A.dash.cooldown[0])}`,
            `Dash cooldown ${sec(A.dash.cooldown[0])} > ${sec(A.dash.cooldown[1])}`,
            `Longer dash, cooldown ${sec(A.dash.cooldown[2])}`
        ]
    },
    forcefield: {
        title: 'FORCEFIELD', icon: 'card_forcefield',
        levels: [
            `Z: erase every enemy bullet + brief shield. CD ${sec(A.forcefield.cooldown[0])}`,
            `Cooldown ${sec(A.forcefield.cooldown[1])}, longer shield`,
            `Cooldown ${sec(A.forcefield.cooldown[2])}, longer shield`
        ]
    },
    phase: {
        title: 'PHASE SHIFT', icon: 'card_phase',
        levels: [
            `X: pass through bullets and ships for ${sec(A.phase.duration[0])}`,
            `Phase lasts ${sec(A.phase.duration[1])}, CD ${sec(A.phase.cooldown[1])}`,
            `Phase lasts ${sec(A.phase.duration[2])}, CD ${sec(A.phase.cooldown[2])}`
        ]
    },
    thrusters: {
        title: 'THRUSTERS', icon: 'card_speed',
        levels: ['Permanently boost ship speed', 'Even faster engines']
    }
};

export const HEAL = { id: 'heal', title: 'REPAIR', desc: 'Restore the hull to full health', icon: 'card_heal', tag: 'HEAL' };
export const HULL = { id: 'hull', title: 'HULL PLATING', desc: '+20% max hull, fully repaired', icon: 'card_heal', tag: 'UPGRADE' };

/**
 * levels: { dash: 0..3, ... } -> UpgradeScreen options. v1 offered heal + one random ability; v2 adds a weapon
 * card from the arsenal (objects/weapons/Arsenal.offers) and, after a boss, a second weapon card.
 * Synergies are rare: offered 35% of the time when one is unlocked (always after a boss).
 * arsenal / opts are optional so the v1 call shape rollOptions(levels) still works.
 */
export function rollOptions(levels, rnd = Math.random, arsenal = null, opts = {}) {
    const open = Object.keys(UPGRADES).filter((id) => (levels[id] || 0) < UPGRADES[id].levels.length);
    // prefer abilities that aren't unlocked yet half of the time so new players see them early
    const fresh = open.filter((id) => !levels[id]);
    const pool = fresh.length && rnd() < 0.5 ? fresh : open;
    const pick = pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
    const options = [HEAL];
    const weapons = arsenal ? arsenal.offers() : [];
    options.push(pick ? describe(pick, levels[pick] || 0) : HULL);
    const nWeapon = opts.boss ? 2 : 1;
    for (let i = 0; i < nWeapon && weapons.length; i++) options.push(pickWeapon(weapons, rnd, opts.boss || i > 0));
    return shuffle(options, rnd);
}

/** weighted weapon pick (removes it from `list`); synergies win outright on a lucky roll */
function pickWeapon(list, rnd, rich) {
    const syn = list.filter((o) => o.rare);
    let o;
    if (syn.length && rnd() < (rich ? 1 : 0.35)) o = syn[Math.floor(rnd() * syn.length)];
    else {
        const normal = list.filter((x) => !x.rare);
        const src = normal.length ? normal : list;
        let r = rnd() * src.reduce((t, x) => t + x.weight, 0);
        o = src.find((x) => (r -= x.weight) < 0) || src[0];
    }
    list.splice(list.indexOf(o), 1);
    return o;
}

function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

function describe(id, level) {
    const u = UPGRADES[id];
    const title = level ? `${u.title} LV${level + 1}` : u.title;
    return { id, title, desc: u.levels[level], icon: u.icon, tag: level ? 'UPGRADE' : 'NEW' };
}
