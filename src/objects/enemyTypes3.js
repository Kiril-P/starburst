// Mine layer + its mines, splitter + its pods (see enemyTypes2.js for the hook contract).
// Mines are "minor" enemies: they don't count against a wave's max-active cap (they would starve the spawners),
// and shooting one just pops it; only an un-shot mine bursts, after a visible arm + fuse blink.
import { H, W } from '../config.js';
import { SPEED_SCALE, ENEMY_BULLET } from '../systems/tuning.js';
import { aimed, fan, ring, style, angleTo, TAU } from './patterns.js';

const ORB_S = style('orbS', 'magenta');
const ORB_M = style('orbM', 'magenta');
const V = ENEMY_BULLET.speed;
const n = (count, c) => Math.max(1, Math.round(count * c.density));
const rand = (a, b) => a + Math.random() * (b - a);
const PROXIMITY = 42, SHORT_FUSE = 420;

export const TYPES_3 = {
    // Crosses the upper half sideways, seeding mines. Spawned at any x: it picks the nearer edge to enter from.
    minelayer: {
        key: 'enemy_minelayer', radius: 10, hp: 45, score: 200, maxAlive: 2, speed: 40 * SPEED_SCALE, explosion: 'm', shake: 1,
        init(e) {
            const fromLeft = e.x < W / 2;
            e.cruiseY = e.y > 0 ? e.y : rand(28, 96);
            e.x = fromLeft ? -14 : W + 14;
            e.y = e.cruiseY;
            e.vx = (fromLeft ? 1 : -1) * e.speed;
            e.nextFire = rand(500, 900);
        },
        think(e, dt, c) {
            const s = dt / 1000;
            e.x += e.vx * s;
            e.y = e.cruiseY + Math.round(Math.sin(e.age * 0.0016) * 3);
            if (e.x < 16 || e.x > W - 16 || (e.nextFire -= dt) > 0) return;
            e.nextFire = (1500 - Math.min(3, e.tier) * 140) * c.fireRateMod;
            e.scene.waves?.spawn('mine', e.x, e.y + 8);
            e.shots++;
        }
    },

    mine: {
        key: 'enemy_mine', radius: 4, hp: 6, score: 25, minor: true, speed: 14, explosion: 's', shake: 0,
        init(e) { e.vy = 34; e.mode = 0; e.timer = 900; e.fuse = 0; e.stop(); e.setFrame(0); },
        think(e, dt, c) {
            const s = dt / 1000;
            e.vy += (e.speed - e.vy) * Math.min(1, s * 1.5);    // dropped fast, settles into a slow sink
            e.y += e.vy * s;
            if (e.mode === 0) { if ((e.timer -= dt) <= 0) { e.mode = 1; e.fuse = 3600; e.setFrame(1); } return; }
            const dx = c.px - e.x, dy = c.py - e.y;
            if (e.fuse > SHORT_FUSE && dx * dx + dy * dy < PROXIMITY * PROXIMITY) e.fuse = SHORT_FUSE;
            e.fuse -= dt;
            // blink faster as the fuse runs out
            const rate = e.fuse < 700 ? 60 : 260;
            e.setFrame((((e.age / rate) | 0) & 1) ? 2 : 1);
            if (e.fuse > 0) return;
            const tier = Math.min(3, e.tier);
            ring(c.pool, e.x, e.y, { speed: V * 0.5 * c.speed, style: ORB_S, damage: c.damage, count: n(6 + tier * 2, c), offset: Math.random() * TAU });
            c.onShoot(e);
            e.scene.combat?.killEnemy(e, false);
        }
    },

    // Three fused pods. Killing it cracks it into 2 (tier 2+: 3) pods that scatter, then sink and take a shot each.
    splitter: {
        key: 'enemy_splitter', radius: 9, hp: 36, score: 150, maxAlive: 4, speed: 70 * SPEED_SCALE, fireRate: 2600, explosion: 'm', shake: 1,
        moves: [4, 4, 2], amplitude: [20, 50], frequency: [1.0, 2.0],
        attack(e, c, tier) {
            const o = { speed: V * c.speed, style: ORB_M, damage: c.damage };
            if (tier === 0) return aimed(c.pool, e.x, e.y + 8, c.px, c.py, o);
            if (tier === 1) return c.seq.run(e, 140, 2, (i, x, y) => aimed(c.pool, x, y + 8, c.px, c.py, o));
            fan(c.pool, e.x, e.y + 8, angleTo(e.x, e.y, c.px, c.py), { ...o, count: 3, spread: 24 });
        },
        onKill(e, g, byPlayer, x, y) {
            if (!byPlayer || !g.waves) return;
            const k = e.tier >= 2 ? 3 : 2;
            for (let i = 0; i < k; i++) {
                const a = -Math.PI / 2 + (i - (k - 1) / 2) * 1.25;
                const p = g.waves.spawn('splitter_s', Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6));
                p.vx = Math.cos(a) * 90; p.vy = Math.sin(a) * 70;
            }
        }
    },
    splitter_s: {
        key: 'enemy_splitter_s', radius: 5, hp: 10, score: 50, minor: true, speed: 60 * SPEED_SCALE, explosion: 's', shake: 0,
        init(e) { e.nextFire = rand(700, 1100); },
        think(e, dt, c) {
            const s = dt / 1000, k = Math.min(1, s * 2);
            e.vx -= e.vx * k;                         // scatter impulse dies off...
            e.vy += (e.speed - e.vy) * k * 0.6;       // ...and it sinks like the rest
            e.x += e.vx * s; e.y += e.vy * s;
            if (e.x < 6) e.x = 6; else if (e.x > W - 6) e.x = W - 6;
            if (e.y > 6 && e.y < H * 0.7 && (e.nextFire -= dt) <= 0) {
                e.nextFire = 2600 * c.fireRateMod;
                aimed(c.pool, e.x, e.y + 5, c.px, c.py, { speed: V * 0.85 * c.speed, style: ORB_S, damage: c.damage });
                c.onShoot(e);
            }
        }
    }
};
