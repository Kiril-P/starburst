// Second-generation enemies: sniper, kamikaze, shield carrier, turret. (Mine layer / mine / splitter: enemyTypes3.js.)
// They use the Enemy hooks (init / think / armor / onKill) instead of the v1 move-weights + fireRate loop, because
// each one has a small state machine (enter -> act -> leave). Every attack is readable before it is dangerous:
// snipers draw an amber laser and lock it before firing, kamikazes blink and freeze before they dive, turrets
// pause between spins. Bullet speeds scale with c.speed and counts with c.density like the v1 types.
import { H, W } from '../config.js';
import { SPEED_SCALE, ENEMY_BULLET } from '../systems/tuning.js';
import { COLORS } from '../art/palette.js';
import { fan, ring, lance, style, angleTo, DEG, TAU } from './patterns.js';
import { drawLaser } from './laser.js';

const ORB_S = style('orbS', 'magenta');
const ORB_M = style('orbM', 'magenta');
const NEEDLE_M = style('needle', 'magenta');
const V = ENEMY_BULLET.speed;
const n = (count, c) => Math.max(1, Math.round(count * c.density));
const rand = (a, b) => a + Math.random() * (b - a);

/** ease toward y = target (fast far away, gentle on arrival); returns true once there */
function settle(e, target, s, min = 14) {
    e.y += Math.max(min, (target - e.y) * 2.4) * s;
    if (e.y < target) return false;
    e.y = target;
    return true;
}

export const TYPES_2 = {
    // Parks near the top and fires a fast needle lance down an amber laser line. The line tracks the player,
    // then LOCKS (dense, fast blink) for the last third of the charge, which is the cue to step sideways.
    sniper: {
        key: 'enemy_sniper', radius: 7, hp: 30, score: 175, maxAlive: 2, speed: 44 * SPEED_SCALE, explosion: 's', shake: 1,
        fireRate: 3400, chargeMs: [1250, 1100, 1000, 950],
        init(e) {
            e.mode = 0; e.charge = 0; e.aimA = Math.PI / 2;
            e.hoverY = rand(52, 84);   // below the HUD corner panels e.hoverMs = 9000; e.nextFire = rand(500, 1100);
        },
        think(e, dt, c) {
            const s = dt / 1000, t = e.type;
            if (e.mode === 0) { if (settle(e, e.hoverY, s)) e.mode = 1; }
            else if (e.mode === 1) {
                e.x = e.startX + Math.sin(e.age * 0.0006) * 18;
                if ((e.hoverMs -= dt) <= 0 && e.charge <= 0) e.mode = 2;
            } else e.y -= 40 * s;    // job done: back off upward the way it came
            if (e.mode !== 1) return;
            if (e.charge > 0) {
                e.charge -= dt;
                const lockAt = e.chargeTotal * 0.36;
                const mx = e.x, my = e.y + 11;
                if (e.charge > lockAt) e.aimA = angleTo(mx, my, c.px, c.py);
                drawLaser(e, mx, my, e.aimA, e.charge < lockAt, e.age);
                if (e.charge <= 0) {
                    e.gfx.clear();
                    e.setFrame(0);
                    const o = { speed: V * 1.55 * c.speed, speedMax: V * 1.95 * c.speed, style: NEEDLE_M, damage: c.damage, count: e.tier >= 1 ? 4 : 3 };
                    lance(c.pool, mx, my, e.aimA, o);
                    if (e.tier >= 2) for (const d of [-1, 1]) lance(c.pool, mx, my, e.aimA + d * 8 * DEG, { ...o, count: 2, speed: o.speed * 0.8, speedMax: o.speed });
                    e.shots++;
                    c.onShoot(e);
                }
            } else if (e.x > 8 && e.x < W - 8 && (e.nextFire -= dt) <= 0) {
                e.nextFire = t.fireRate * c.fireRateMod;
                e.charge = e.chargeTotal = t.chargeMs[Math.min(3, e.tier)];
                e.setFrame(1);
            }
        }
    },

    // Comes in with its swarm, hangs for a moment, blinks red and freezes, then dives in a STRAIGHT line at where
    // the player was when the blink ended (no homing: one sidestep beats it). No guns; it only hurts by ramming.
    kamikaze: {
        key: 'enemy_kamikaze', radius: 6, hp: 8, score: 60, speed: 110 * SPEED_SCALE, explosion: 's', shake: 0,
        init(e, opts) {
            e.mode = 0; e.holdY = e.y < 0 ? rand(36, 104) : e.y + 30;
            e.wait = opts.delay ?? rand(300, 1200);
            e.lockMs = 520 - Math.min(3, e.tier) * 40;
        },
        think(e, dt, c) {
            const s = dt / 1000;
            if (e.mode === 0) {                           // enter (straight in, or along a formation path)
                if (e.path) { if (e.path(e, e.age) === false) { e.path = null; e.holdY = e.y; e.startX = e.x; } }
                else if (settle(e, e.holdY, s, 30)) { e.mode = 1; e.startX = e.x; }
                return;
            }
            if (e.mode === 1) {                           // loiter with a small bob, waiting its turn
                e.x = e.startX + Math.round(Math.sin(e.age * 0.004) * 2);
                if ((e.wait -= dt) <= 0) { e.mode = 2; e.timer = e.lockMs; }
                return;
            }
            if (e.mode === 2) {                           // tell: freeze + red blink, then commit to a heading
                e.timer -= dt;
                const on = ((e.timer / 70) | 0) & 1;
                if (on) e.setTintFill(COLORS.R); else e.clearTint();
                if (e.timer <= 0) {
                    e.clearTint();
                    const a = angleTo(e.x, e.y, c.px, c.py), sp = (150 + Math.min(3, e.tier) * 12) * Math.min(1.25, c.speed);
                    e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
                    e.mode = 3;
                }
                return;
            }
            e.x += e.vx * s; e.y += e.vy * s;
        }
    },

    // Slow armoured carrier. The magenta arc in front (below) deflects shots coming from below; shots from the
    // sides land normally and shots from above (behind) do double damage, so it rewards flying around it.
    // From tier 1 it also launches a pair of kamikaze drones every third volley.
    shield: {
        key: 'enemy_shield', radius: 11, hp: 70, score: 250, maxAlive: 2, speed: 24 * SPEED_SCALE, fireRate: 2800, explosion: 'm', shake: 2, big: true,
        moves: [6, 4, 0], amplitude: [18, 40], frequency: [0.5, 1.1],
        armor(e, shot) {
            const dx = shot.x - e.x, dy = shot.y - e.y;
            if (dy > 3 && Math.abs(dx) <= dy * 1.7) {
                e.setFrame(1); e.frameMs = 90;
                e.scene.fx?.hitSpark(shot.x, Math.min(shot.y, e.y + 14), COLORS.q);
                return 0;
            }
            return dy < -3 ? 2 : 1;
        },
        attack(e, c, tier) {
            const a = angleTo(e.x, e.y + 14, c.px, c.py);
            const o = { speed: V * 0.8 * c.speed, style: ORB_M, damage: c.damage, count: tier >= 1 ? n(5, c) : 3, spread: tier >= 1 ? 44 : 26 };
            fan(c.pool, e.x, e.y + 14, a, o);
            if (tier >= 2 && e.shots % 3 === 1) ring(c.pool, e.x, e.y, { speed: V * 0.5 * c.speed, style: ORB_S, damage: c.damage, count: n(10, c), offset: Math.random() * TAU });
            if (tier >= 1 && e.shots % 3 === 2) {
                const waves = e.scene.waves;
                if (waves && waves.room() >= 2) for (const d of [-1, 1]) waves.spawn('kamikaze', e.x + d * 14, e.y + 4, { delay: 500 + (d + 1) * 160 });
            }
        }
    },

    // Drops in, bolts itself in place (drifting only with the scrolling station) and sprays a rotating cross of
    // orbs in on/off bursts. The barrels on the sprite point where the next bullets go.
    turret: {
        key: 'enemy_turret', radius: 10, hp: 60, score: 220, maxAlive: 2, speed: 60 * SPEED_SCALE, explosion: 'm', shake: 2, big: true,
        init(e) {
            e.mode = 0; e.anchorY = rand(34, H * 0.32); e.holdMs = 9500;
            e.spinA = Math.random() * TAU; e.spinDir = Math.random() < 0.5 ? -1 : 1;
            e.cycle = 900; e.firing = false; e.nextFire = 0;
            e.stop();
        },
        think(e, dt, c) {
            const s = dt / 1000;
            if (e.mode === 0) { if (settle(e, e.anchorY, s, 20)) e.mode = 1; return; }
            if (e.mode === 2) { e.y += e.speed * s; return; }
            e.y += 5 * s;
            if ((e.holdMs -= dt) <= 0) { e.mode = 2; return; }
            // 1.8s spin, 1.2s rest: the rest is the window to slip through the arms
            if ((e.cycle -= dt) <= 0) { e.firing = !e.firing; e.cycle = e.firing ? 1800 : 1200; }
            const tier = Math.min(3, e.tier);
            e.spinA += e.spinDir * (55 + tier * 8) * DEG * s;
            e.setFrame((((e.spinA % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) / (Math.PI / 8)) | 0);
            if (!e.firing || (e.nextFire -= dt) > 0) return;
            const arms = tier >= 2 ? 4 : 2, step = TAU / arms;
            e.nextFire += (arms === 4 ? 300 : 210) / c.density;   // ~13 bullets/s either way while spinning
            for (let k = 0; k < arms; k++) {
                const a = e.spinA + k * step;
                c.pool.spawn(e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, a, V * 0.6 * c.speed, ORB_S, { damage: c.damage });
            }
            e.shots++;
            if ((e.shots & 3) === 0) c.onShoot(e);
        }
    }
};
