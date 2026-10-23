// Spawning player shots with the weapon-only fields (pierce, homing, splash) on top of BulletPool's own.
// BulletPool recycles images without resetting unknown fields, so EVERY field read by Combat / homing is written
// here on every spawn. `hits` is a per-image array (allocated once per pooled image, reused): enemies a piercing
// shot already went through, so it never hits the same target twice (collisions.js skips them).
import { PLAYER } from '../../systems/tuning.js';

const EX = { accel: 0, turn: 0, minSpeed: 0, maxSpeed: 9999, damage: 0 };   // reused: no per-shot allocation

/**
 * o (optional): { pierce, homing (max turn rad/s), splash (px radius), fuse (ms of homing), accel, maxSpeed }
 * speedMul scales PLAYER.shotSpeed. Returns the shot or null when the pool is dry.
 */
export function spawnShot(pool, x, y, angle, speedMul, style, damage, o) {
    EX.accel = o?.accel ?? 0;
    EX.maxSpeed = o?.maxSpeed ?? 9999;
    EX.damage = damage;
    const b = pool.spawn(Math.round(x), Math.round(y), angle, PLAYER.shotSpeed * speedMul, style, EX);
    if (!b) return null;
    b.pierce = o?.pierce ?? 0;
    b.homing = o?.homing ?? 0;
    b.splash = o?.splash ?? 0;
    b.fuse = o?.fuse ?? 0;
    if (b.hits) b.hits.length = 0; else b.hits = [];
    return b;
}

/** nearest live target (enemies, then boss hit circles) to (x,y) within range, skipping ones in `skip` */
export function nearestTarget(game, x, y, range, skip) {
    let best = null, bd = range * range;
    const lists = [game.waves.live, game.bosses.targets];
    for (let l = 0; l < 2; l++) {
        const list = lists[l];
        for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e.alive || (skip && skip.length && skip.indexOf(e) >= 0)) continue;
            if (e.y < -8) continue;   // not on screen yet: don't waste missiles on spawns above the top edge
            const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = e; }
        }
    }
    return best;
}

/** turn every homing shot toward its nearest target (sets the pool's per-bullet turn rate) */
export function steerHoming(game, pool) {
    const live = pool.live;
    for (let i = 0; i < live.length; i++) {
        const b = live[i];
        if (!b.alive || !b.homing) continue;
        if (b.fuse && b.age > b.fuse) { b.homing = 0; b.turn = 0; continue; }   // burnt out: fly straight off-screen
        const t = nearestTarget(game, b.x, b.y, 400, b.hits);
        if (!t) { b.turn = 0; continue; }
        let d = Math.atan2(t.y - b.y, t.x - b.x) - b.angle0;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        // proportional, clamped: snaps onto close targets, wide curves for far ones; never exactly 0 while tracking
        b.turn = Math.max(-b.homing, Math.min(b.homing, d * 10)) || 1e-4;
    }
}
