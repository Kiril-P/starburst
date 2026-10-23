// Circle-vs-circle collision passes. No arcade physics: a few hundred squared-distance checks per frame.
import { PLAYER } from '../systems/tuning.js';

const REJECT = 40; // cheap axis reject before the distance test (bigger than any radius sum + graze)

/**
 * Enemy bullets vs the player's tiny hitbox, plus graze detection.
 * h: { onHit(b), onGraze(b) } — onHit is called at most once per pass.
 */
export function bulletsVsPlayer(pool, player, h) {
    if (!player.alive) return;
    const px = player.x, py = player.y;
    const hittable = player.hittable;
    const live = pool.live;
    for (let i = 0; i < live.length; i++) {
        const b = live[i];
        if (!b.alive) continue;
        const dx = b.x - px, dy = b.y - py;
        if (dx > REJECT || dx < -REJECT || dy > REJECT || dy < -REJECT) continue;
        const d2 = dx * dx + dy * dy;
        const rr = PLAYER.hitRadius + b.r;
        if (d2 < rr * rr) {
            if (hittable) { h.onHit(b); return; }
        } else if (hittable && !b.grazed) {
            const g = rr + PLAYER.grazeRadius;
            if (d2 < g * g) { b.grazed = true; h.onGraze(b); }
        }
    }
}

/** Player shots vs enemies. onHit(shot, enemy) */
export function shotsVsEnemies(shots, enemies, onHit) {
    const sl = shots.live;
    for (let i = 0; i < sl.length; i++) {
        const s = sl[i];
        if (!s.alive) continue;
        for (let j = 0; j < enemies.length; j++) {
            const e = enemies[j];
            if (!e.alive || (s.hits && s.hits.length && s.hits.indexOf(e) >= 0)) continue;   // pierced already
            const dx = e.x - s.x, dy = e.y - s.y;
            const rr = e.r + s.r;
            if (dx * dx + dy * dy < rr * rr) { onHit(s, e); break; }
        }
    }
}

/** Ramming: player hitbox vs enemy bodies. onHit(enemy) for the first overlap. Phase shift passes through. */
export function playerVsEnemies(player, enemies, onHit) {
    if (!player.alive || player.phasing) return;
    for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const rr = e.r + PLAYER.hitRadius + 2;
        if (dx * dx + dy * dy < rr * rr) { onHit(e); return; }
    }
}
