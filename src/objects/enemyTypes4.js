// Fourth generation of enemies, built to make you MOVE: strafer (crosses the screen firing aimed bursts), seeker (a
// slow homing drone), pylon + emitter (telegraphed laser beams from the ceiling / the walls, objects/beams.js) and
// warper (blinks around you, only hittable while solid). Same hook contract as enemyTypes2.js.
import { H, W } from '../config.js';
import { SPEED_SCALE, ENEMY_BULLET } from '../systems/tuning.js';
import { COLORS } from '../art/palette.js';
import { aimed, fan, ring, style, angleTo, TAU } from './patterns.js';

const ORB_S = style('orbS', 'magenta');
const ORB_M = style('orbM', 'magenta');
const RING = style('ring', 'magenta');
const V = ENEMY_BULLET.speed;
const n = (count, c) => Math.max(1, Math.round(count * c.density));
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * pylon (ceiling mount, beam straight down, tracks your x) and emitter (wall mount, beam straight across, tracks your y)
 * share one state machine: arrive -> idle (drift toward you) -> charge (track, then LOCK) -> fire -> rest -> ... -> leave.
 */
function beamEmitter({ wall, hp, score, chargeMs, restMs, width, track, sweep }) {
    return {
        key: 'enemy_pylon', radius: 10, hp, score, maxAlive: wall ? 2 : 3, speed: 0, explosion: 'm', shake: 2, big: true,
        init(e) {
            e.mode = 0; e.holdMs = wall ? 13000 : 12000; e.timer = rand(800, 1300); e.bt = 0;
            e.stop(); e.setFrame(0);
            if (wall) {
                e.side = e.x < W / 2 ? -1 : 1;
                e.anchorX = e.side < 0 ? 12 : W - 12;
                e.x = e.side < 0 ? -16 : W + 16;
                if (e.y < 0) e.y = rand(70, 210);
                e.setRotation(e.side < 0 ? -Math.PI / 2 : Math.PI / 2);   // the sprite faces down: turn the lens inward
            } else {
                e.anchorY = 13;
            }
        },
        think(e, dt, c) {
            const s = dt / 1000, tier = Math.min(3, e.tier), t = e.type;
            // arrive
            if (e.mode === 0) {
                if (wall) { e.x += e.side * -Math.max(30, Math.abs(e.anchorX - e.x) * 2.4) * s; if ((e.side < 0 && e.x >= e.anchorX) || (e.side > 0 && e.x <= e.anchorX)) { e.x = e.anchorX; e.mode = 1; } }
                else { e.y += Math.max(26, (e.anchorY - e.y) * 2.4) * s; if (e.y >= e.anchorY) { e.y = e.anchorY; e.mode = 1; } }
                return;
            }
            if (e.mode === 3) { if (wall) e.x += e.side * 50 * s; else e.y -= 50 * s; return; }   // leaving the way it came
            const drift = (v) => {
                if (wall) e.y += clamp(clamp(c.py, 30, H - 58) - e.y, -v * s, v * s);
                else e.x += clamp(clamp(c.px, 26, W - 26) - e.x, -v * s, v * s);
            };
            if (e.mode === 1) {
                if ((e.holdMs -= dt) <= 0) { e.mode = 3; return; }
                drift(26);
                if ((e.timer -= dt) > 0) return;
                // start a shot
                e.mode = 2; e.bt = 0; e.setFrame(1);
                e.chargeMs = chargeMs[tier] * (e.scene.diff?.id === 'easy' ? 1.2 : e.scene.diff?.id === 'hard' ? 0.92 : 1);   // easy warns longer, hard a little less
                e.scene.beams.add(e, {
                    x: wall ? e.x + e.side * 16 : e.x, y: wall ? e.y : e.y + 16, a: wall ? (e.side < 0 ? 0 : Math.PI) : Math.PI / 2,
                    w: width + (tier >= 2 ? 2 : 0), chargeMs: e.chargeMs, lockMs: 430, fireMs: sweep[tier] ? 520 : 380, damage: 1.8, sweep: sweep[tier], dir: Math.random() < 0.5 ? -1 : 1,
                    follow: (b) => { b.x = wall ? e.x + e.side * 16 : e.x; b.y = wall ? e.y : e.y + 16; }
                });
                e.scene.audio?.play('beam-charge', { vol: 0.6, rate: 1100 / e.chargeMs });
                return;
            }
            // charging / firing
            e.bt += dt;
            if (e.bt < e.chargeMs - 430) drift(track);       // tracks you, then LOCKS for the last 430 ms
            if (e.bt >= e.chargeMs && e.frame.name !== 2) e.setFrame(2);
            if (e.bt >= e.chargeMs + (sweep[tier] ? 520 : 380)) { e.mode = 1; e.setFrame(0); e.timer = restMs[tier] * c.fireRateMod; }
        }
    };
}

export const TYPES_4 = {
    // Flies across the screen from one side, firing aimed bursts as it goes, and leaves by the other. Never stops, so
    // it is a moving target that punishes standing still: line up a shot as it crosses.
    strafer: {
        key: 'enemy_strafer', radius: 9, hp: 26, score: 140, maxAlive: 3, speed: 0, explosion: 'm', shake: 1,
        fireEvery: [1250, 1100, 950, 850],
        init(e) {
            e.dir = e.x < W / 2 ? 1 : -1;
            e.rowY = e.y > 0 ? e.y : rand(52, 150);
            e.x = e.dir > 0 ? -16 : W + 16; e.y = e.rowY;
            e.cross = 88 + Math.min(3, e.tier) * 8;
            e.nextFire = rand(450, 800);
        },
        think(e, dt, c) {
            const s = dt / 1000, tier = Math.min(3, e.tier);
            e.x += e.dir * e.cross * s;
            e.y = e.rowY + Math.round(Math.sin(e.age * 0.0028) * 9) + e.age * 0.006;
            if (e.x < 12 || e.x > W - 12 || (e.nextFire -= dt) > 0) return;
            const dx = c.px - e.x, dy = c.py - e.y;
            if (dx * dx + dy * dy < 72 * 72) { e.nextFire = 250; return; }   // never an unreadable point-blank shot
            e.nextFire = e.type.fireEvery[tier] * c.fireRateMod;
            const o = { speed: V * 0.95 * c.speed, style: ORB_S, damage: c.damage };
            if (tier === 0) aimed(c.pool, e.x, e.y + 6, c.px, c.py, o);
            else if (tier <= 2) c.seq.run(e, 120, 2, (i, x, y) => aimed(c.pool, x, y + 6, c.px, c.py, o));
            else fan(c.pool, e.x, e.y + 6, angleTo(e.x, e.y, c.px, c.py), { ...o, count: e.shots & 1 ? 5 : 3, spread: e.shots & 1 ? 44 : 28 });
            e.shots++;
            c.onShoot(e);
        }
    },

    // A slow homing drone: it turns toward you at a limited rate, so a wide arc loses it and a straight line does not.
    // It dies to two shots; left alone it blinks amber for its last second and bursts into a slow ring.
    seeker: {
        key: 'enemy_seeker', radius: 7, hp: 30, score: 90, maxAlive: 4, speed: 0, explosion: 's', shake: 0,
        init(e) {
            e.h = Math.PI / 2 + rand(-0.5, 0.5); e.life = 9500; e.sp = 0;
            e.rotation = e.h - Math.PI / 2;
            e.scene.audio?.play('seeker-lock', { vol: 0.4 });
        },
        think(e, dt, c) {
            const s = dt / 1000, tier = Math.min(3, e.tier);
            e.life -= dt;
            e.sp += ((58 + tier * 6) - e.sp) * Math.min(1, s * 1.8);   // eases up to cruising speed
            const turn = 1.15 + tier * 0.14;
            e.h += clamp(wrapPi(angleTo(e.x, e.y, c.px, c.py) - e.h), -turn * s, turn * s);
            e.x += Math.cos(e.h) * e.sp * s; e.y += Math.sin(e.h) * e.sp * s;
            e.rotation = e.h - Math.PI / 2;
            if (e.life < 1200) { if (((e.life / 80) | 0) & 1) e.setTintFill(COLORS.A); else e.clearTint(); }
            if (e.life > 0) return;
            ring(c.pool, e.x, e.y, { speed: V * 0.45 * c.speed, style: ORB_S, damage: c.damage, count: n(6 + tier, c), offset: Math.random() * TAU });
            c.onShoot(e);
            e.scene.combat?.killEnemy(e, false);
        }
    },

    // Ceiling-mounted laser: drifts toward your column, charges (the amber line tracks you, then locks and strobes), fires.
    pylon: beamEmitter({ wall: false, hp: 64, score: 260, chargeMs: [1400, 1300, 1200, 1100], restMs: [1900, 1700, 1450, 1250], width: 7, track: 80, sweep: [0, 0, 0.16, 0.2] }),
    // Wall-mounted laser: the same, but it slides up and down and the beam sweeps across the whole screen.
    emitter: beamEmitter({ wall: true, hp: 56, score: 240, chargeMs: [1500, 1400, 1300, 1200], restMs: [2400, 2200, 1900, 1700], width: 8, track: 75, sweep: [0, 0, 0, 0] }),

    // Blinks in near you, flares, fires a pattern, blinks out and reappears elsewhere. Armoured (damage 0) except while
    // solid, so the window to hit it is the second between flare and exit.
    warper: {
        key: 'enemy_warper', radius: 9, hp: 46, score: 280, maxAlive: 2, speed: 0, explosion: 'm', shake: 1,
        armor(e) { return e.mode === 2 ? 1 : 0; },
        init(e) {
            e.mode = 0; e.timer = rand(250, 500); e.t = 0; e.fired = false;
            e.visits = e.tier >= 2 ? 4 : 3;
            e.stop(); e.setFrame(0); e.setAlpha(0);
            e.x = W / 2; e.y = -30;
        },
        think(e, dt, c) {
            const tier = Math.min(3, e.tier);
            if (e.mode === 0) {                                      // hidden: pick the next spot
                if ((e.timer -= dt) > 0) return;
                const side = Math.random() < 0.5 ? -1 : 1;
                e.x = clamp(c.px + side * rand(90, 210), 38, W - 38);
                if (Math.abs(e.x - c.px) < 70) e.x = clamp(c.px - side * 120, 38, W - 38);
                e.y = rand(44, 138);
                e.mode = 1; e.t = 0; e.fired = false;
                e.scene.fx?.shockwave(Math.round(e.x), Math.round(e.y), COLORS.M, 0.35);
                e.scene.audio?.play('warp', { vol: 0.45 });
                return;
            }
            e.t += dt;
            if (e.mode === 1) {                                      // materialising: faint, not hittable
                e.setAlpha(Math.min(0.8, (e.t / 420) * 0.8));
                if (e.t >= 420) { e.mode = 2; e.t = 0; e.setAlpha(1); e.setFrame(1); }
                return;
            }
            if (e.mode === 2) {                                      // solid: flare, fire, hang for a moment
                if (!e.fired && e.t >= 380) { e.fired = true; this.fire(e, c, tier); }
                if (e.t >= 560 && e.frame.name !== 0) e.setFrame(0);
                if (e.t >= 1350) { e.mode = 3; e.t = 0; e.setFrame(1); e.scene.audio?.play('warp', { vol: 0.35, rate: 0.7 }); }
                return;
            }
            e.setAlpha(Math.max(0, 1 - e.t / 200));                  // mode 3: vanishing
            if (e.t < 200) return;
            e.setAlpha(0);
            if (--e.visits <= 0) { e.y = -100; return; }             // done: slips away (culled above the screen)
            e.mode = 0; e.timer = rand(500, 800); e.x = W / 2; e.y = -30;
        },
        fire(e, c, tier) {
            const a = angleTo(e.x, e.y, c.px, c.py), o = { speed: V * 0.8 * c.speed, style: ORB_M, damage: c.damage };
            const off = Math.random() * TAU;
            if (tier <= 1) fan(c.pool, e.x, e.y + 6, a, { ...o, count: n(5, c), spread: 56 });
            if (tier === 1) ring(c.pool, e.x, e.y, { ...o, speed: o.speed * 0.6, style: RING, count: n(8, c), offset: off });
            if (tier >= 2) {
                ring(c.pool, e.x, e.y, { ...o, speed: o.speed * 0.65, style: RING, count: n(tier >= 3 ? 10 : 12, c), offset: off });
                c.seq.run(e, 190, tier >= 3 ? 2 : 3, (i, x, y) => fan(c.pool, x, y + 6, angleTo(x, y, c.px, c.py), { ...o, speed: o.speed * 1.15, count: tier >= 3 ? 3 : 1, spread: 26 }));
            }
            c.onShoot(e);
        }
    }
};
