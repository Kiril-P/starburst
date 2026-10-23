// Between-wave upgrades. v1 offered "full heal" + one random not-yet-owned upgrade (dash, phase shift,
// forcefield, improved thrusters). v2 keeps that offer shape and adds levels to each ability
// (values in tuning.ABILITIES). When everything is maxed, a repeatable hull upgrade replaces it.
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

/** levels: { dash: 0..3, ... } -> UpgradeScreen options (heal + one random upgrade, shuffled like v1). */
export function rollOptions(levels, rnd = Math.random) {
    const open = Object.keys(UPGRADES).filter((id) => (levels[id] || 0) < UPGRADES[id].levels.length);
    // prefer abilities that aren't unlocked yet half of the time so new players see them early
    const fresh = open.filter((id) => !levels[id]);
    const pool = fresh.length && rnd() < 0.5 ? fresh : open;
    const pick = pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
    const options = [HEAL, pick ? describe(pick, levels[pick] || 0) : HULL];
    if (rnd() < 0.5) options.reverse();
    return options;
}

function describe(id, level) {
    const u = UPGRADES[id];
    const title = level ? `${u.title} LV${level + 1}` : u.title;
    return { id, title, desc: u.levels[level], icon: u.icon, tag: level ? 'UPGRADE' : 'NEW' };
}
