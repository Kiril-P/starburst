// Enemy type table. Stats in the first block of each type are v1 values (legacy/objects/Enemy.js);
// speeds are v1 px/s converted with SPEED_SCALE. `attack(e, c, tier)` fires the type's pattern for the
// current wave tier: tier 0 is exactly the v1 attack, higher tiers escalate (see tuning.tierByWave).
// Colour coding (STYLE.md): basic/circular = magenta orbs & rings, spread = amber needles, meteors = lime shards.
import { SPEED_SCALE, ENEMY_BULLET, SCORE } from '../systems/tuning.js';
import { aimed, fan, ring, curtain, burst, style, angleTo, DEG, TAU } from './patterns.js';
import { TYPES_2 } from './enemyTypes2.js';
import { TYPES_3 } from './enemyTypes3.js';

const ORB_S = style('orbS', 'magenta');
const ORB_M = style('orbM', 'magenta');
const RING = style('ring', 'magenta');
const NEEDLE = style('needle', 'amber');
const NEEDLE_M = style('needle', 'magenta');
const SHARD = style('shard', 'lime');
const ORB_S_AMBER = style('orbS', 'amber');

const n = (count, c) => Math.max(1, Math.round(count * c.density));
const V = ENEMY_BULLET.speed; // v1 enemy bullet speed in v2 px/s

// movement: weights for [straight, sine, zigzag] (v1), hover = enter, hold position while firing, then leave
export const ENEMY_TYPES = {
    basic: {
        key: 'enemy_basic', radius: 8, hp: 20, score: SCORE.basic, speed: 100 * SPEED_SCALE, fireRate: 2000,
        moves: [7, 2, 1], amplitude: [20, 40], frequency: [1.0, 2.5], explosion: 's', shake: 0,
        attack(e, c, tier) {
            const sp = V * c.speed;
            const o = { speed: sp, style: ORB_S, damage: c.damage };
            if (tier === 0) return aimed(c.pool, e.x, e.y + 8, c.px, c.py, o);
            if (tier === 1) return c.seq.run(e, 110, 3, (i, x, y) => aimed(c.pool, x, y + 8, c.px, c.py, o));
            const a = () => angleTo(e.x, e.y, c.px, c.py);
            c.seq.run(e, 160, 2, (i, x, y) => fan(c.pool, x, y + 8, a(), { ...o, count: 3, spread: 22 }));
            if (tier >= 3 && e.shots % 3 === 2) ring(c.pool, e.x, e.y, { speed: sp * 0.55, style: ORB_S_AMBER, damage: c.damage, count: n(8, c), offset: Math.random() * TAU });
        }
    },
    spread: {
        key: 'enemy_spread', radius: 10, hp: 30, score: SCORE.spread, speed: 80 * SPEED_SCALE, fireRate: 2500,
        moves: [3, 5, 2], amplitude: [40, 70], frequency: [1.0, 2.5], explosion: 'm', shake: 1,
        attack(e, c, tier) {
            const a = angleTo(e.x, e.y, c.px, c.py);
            const o = { speed: V * c.speed, style: NEEDLE, damage: c.damage };
            if (tier === 0) return fan(c.pool, e.x, e.y + 10, a, { ...o, count: 3, spread: 30 });   // v1: 3 bullets, 15deg apart
            fan(c.pool, e.x, e.y + 10, a, { ...o, count: n(5, c), spread: 48 });
            if (tier >= 2 && (e.shots & 1)) {
                // needle curtain: a wall that starts slow and accelerates, with a gap above the player
                curtain(c.pool, e.x, e.y + 14, { style: NEEDLE_M, damage: c.damage, speed: 25, accel: 150 * c.speed, maxSpeed: V * 1.3 * c.speed, count: n(11, c), width: 150, gapX: c.px, gap: 34 });
            }
            if (tier >= 3) c.seq.run(e, 260, 1, (i, x, y) => fan(c.pool, x, y + 10, angleTo(x, y, c.px, c.py), { ...o, speed: o.speed * 0.7, count: n(6, c), spread: 60 }));
        }
    },
    circular: {
        key: 'enemy_circular', radius: 9, hp: 40, score: SCORE.circular, speed: 50 * SPEED_SCALE, fireRate: 3000,
        moves: [2, 3, 5], amplitude: [50, 90], frequency: [1.5, 3.0], explosion: 'm', shake: 2, big: true,
        hoverFromTier: 2,
        attack(e, c, tier) {
            const sp = V * c.speed;
            const off = Math.random() * TAU;
            if (!e.hover) tier = Math.min(tier, 1);   // only the (capped) hovering casters paint spirals
            if (tier === 0) return ring(c.pool, e.x, e.y, { speed: sp, style: ORB_M, damage: c.damage, count: 8, offset: off }); // v1: 8-way ring
            if (tier === 1) {
                const k = n(12, c);
                ring(c.pool, e.x, e.y, { speed: sp, style: ORB_M, damage: c.damage, count: k, offset: off });
                return ring(c.pool, e.x, e.y, { speed: sp * 0.6, style: RING, damage: c.damage, count: k, offset: off + Math.PI / k });
            }
            // spiral: arms rotate a little every step; tier 3 adds a counter-rotating second spiral
            const arms = tier >= 3 ? 4 : 3;
            const spin = (e.shots & 1 ? -1 : 1) * 11 * DEG;
            const steps = n(16, c);
            c.seq.run(e, 85, steps, (i, x, y) => {
                ring(c.pool, x, y, { speed: sp * 0.8, style: RING, damage: c.damage, count: arms, offset: off + i * spin });
                if (tier >= 3 && (i & 1)) ring(c.pool, x, y, { speed: sp * 0.6, style: ORB_S, damage: c.damage, count: arms, offset: -off - i * spin });
            });
        }
    },
    // meteors don't shoot; they tumble through and burst into lime shards when broken (tier >= 1)
    meteor_s: { meteor: 's', radius: 5, hp: 10, score: SCORE.meteor_s, speed: 70 * SPEED_SCALE, explosion: 's', shake: 0, shards: [0, 0, 3, 4] },
    meteor_m: { meteor: 'm', radius: 8, hp: 30, score: SCORE.meteor_m, speed: 55 * SPEED_SCALE, explosion: 'm', shake: 1, shards: [0, 4, 6, 8] },
    meteor_l: { meteor: 'l', radius: 12, hp: 60, score: SCORE.meteor_l, speed: 40 * SPEED_SCALE, explosion: 'l', shake: 2, big: true, shards: [3, 6, 9, 12], splitInto: 'meteor_s' }
};

// v2 enemies (sniper, kamikaze, shield, turret, minelayer, mine, splitter, splitter_s) live in their own files.
// maxAlive caps how many of a type the timed spawners keep on screen (formations may add a few more).
Object.assign(ENEMY_TYPES, TYPES_2, TYPES_3);

/** Shard burst for a broken meteor. */
export function meteorShards(e, c, tier) {
    const count = e.type.shards[Math.min(tier, 3)];
    if (count) burst(c.pool, e.x, e.y, { count: n(count, c), speedMin: V * 0.35 * c.speed, speedMax: V * 0.75 * c.speed, style: SHARD, damage: c.damage });
}

/** wave spawn name -> concrete type ('meteor' picks a size) */
export function resolveType(name, rnd = Math.random) {
    if (name !== 'meteor') return name;
    const r = rnd();
    return r < 0.45 ? 'meteor_s' : r < 0.8 ? 'meteor_m' : 'meteor_l';
}
