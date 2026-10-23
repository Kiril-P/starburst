// Reusable boss attacks for the expansion bosses (Tempest, Colossus, the mid-bosses, and THE STARBURST, which is
// built by remixing them). Each takes the Boss `b` (pool, sp(), n(), dmg, warn, after(), repeat(), sfx()) plus
// options, fires, and returns the ms it occupies so callers can `return attack(...) + pause`.
//
// Fairness rules (the player turns and shoots in any direction and can be anywhere on screen):
// - everything that fills a lane or a wall is telegraphed in amber first, and walls always leave a gap that is
//   placed within reach of the player's current position (the slowest ship can get there before it arrives);
// - "aimed" means aimed at where the player is at fire time, never predictive.
import { W, H } from '../../config.js';
import { fan, ring, lance, style, angleTo, DEG, TAU } from '../patterns.js';

export const S = {
    orbS: style('orbS', 'magenta'), orbM: style('orbM', 'magenta'), orbL: style('orbL', 'magenta'),
    ring: style('ring', 'magenta'), needle: style('needle', 'amber'), needleM: style('needle', 'magenta'),
    sporeA: style('orbS', 'amber')
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

/** a gap centre near the player (but never exactly on them, so it asks for a move) */
export function gapNear(p, lo, hi, reach = 110) {
    const off = (Math.random() < 0.5 ? -1 : 1) * rnd(reach * 0.3, reach);
    return clamp(p + off, lo, hi);
}

/** a full-width wall of needles falling from y, with a safe gap; needles start slow and accelerate */
export function hWall(b, { y, gapX, gap = 64, warnMs = 950, spacing = 11, speed = 0.45, top = 1.35, style: st = S.needle } = {}) {
    const g0 = gapX - gap / 2, g1 = gapX + gap / 2;
    b.warn.wall(warnMs, { x: 0, y, a: 0, len: W, g0, g1 });
    b.after(warnMs, () => {
        for (let x = 4; x < W; x += spacing) {
            if (x > g0 && x < g1) continue;
            b.pool.spawn(x, y, Math.PI / 2, b.sp(speed), st, { damage: b.dmg, accel: b.sp(1.1), maxSpeed: b.sp(top) });
        }
        b.g.fx.shake(1, 160);
        b.sfx();
    });
    return warnMs;
}

/** a vertical wall that sweeps in from the left (dir 1) or right (dir -1) edge with a safe gap at gapY */
export function vWall(b, { dir = 1, y0 = 96, y1 = H - 24, gapY, gap = 58, warnMs = 1000, spacing = 11, speed = 0.8 } = {}) {
    const x = dir > 0 ? 3 : W - 3, g0 = gapY - gap / 2 - y0, g1 = gapY + gap / 2 - y0;
    b.warn.wall(warnMs, { x, y: y0, a: Math.PI / 2, len: y1 - y0, g0, g1 });
    b.after(warnMs, () => {
        for (let y = y0; y <= y1; y += spacing) {
            if (y - y0 > g0 && y - y0 < g1) continue;
            b.pool.spawn(x, y, dir > 0 ? 0 : Math.PI, b.sp(speed), S.needleM, { damage: b.dmg });
        }
        b.sfx();
    });
    return warnMs;
}

/** amber target rings (first one on the player) that burst into orb rings */
export function mortars(b, { shots = 3, ms = 950, spread = 220, count = 10, speed = 0.42, from = [[0, 0]] } = {}) {
    const c = b.c;
    for (let i = 0; i < shots; i++) {
        const tx = i === 0 ? c.px : clamp(c.px + rnd(-spread, spread) / 2, 30, W - 30);
        const ty = i === 0 ? c.py : clamp(c.py + rnd(-50, 50), H * 0.4, H - 50);
        b.after(i * 160, () => {
            b.warn.ring(ms, { x: tx, y: ty, r: 26 });
            const [dx, dy] = from[i % from.length];
            b.g.fx.hitSpark(b.x + dx, b.y + dy, 0xffb547);
        });
        b.after(ms + i * 160, () => {
            ring(b.pool, tx, ty, { speed: b.sp(speed), style: S.orbM, damage: b.dmg, count: b.n(count), offset: Math.random() * TAU });
            b.g.fx.explosion(tx, ty, 's', 'magenta');
            b.sfx();
        });
    }
    return ms + shots * 160;
}

/** aimed fans from several muzzles (offsets relative to the boss) */
export function muzzleFans(b, muzzles, { volleys = 3, every = 260, count = 5, spread = 36, speed = 0.95, style: st = S.needle } = {}) {
    const c = b.c;
    b.repeat(every, volleys, (i, x, y) => {
        for (const [dx, dy] of muzzles) {
            const mx = x + dx, my = y + dy;
            fan(b.pool, mx, my, angleTo(mx, my, c.px, c.py), { speed: b.sp(speed), style: st, damage: b.dmg, count: b.n(count), spread });
        }
        b.sfx();
    });
    return volleys * every;
}

/** rotating arms from (dx,dy): `arms` streams, rotating `rot` deg per step; dir flips the spin */
export function spiral(b, { dx = 0, dy = 0, arms = 3, steps = 30, every = 85, rot = 11, speed = 0.6, style: st = S.orbS, turn = 0, dir = 1 } = {}) {
    const off = Math.random() * TAU, n = b.n(steps);
    b.repeat(every, n, (i, x, y) => {
        ring(b.pool, x + dx, y + dy, { speed: b.sp(speed), style: st, damage: b.dmg, count: arms, offset: off + dir * i * rot * DEG, turn: turn * dir });
        if (i % 3 === 0) b.sfx();
    });
    return n * every;
}

/** concentric rings from (dx,dy), alternating offsets so they interleave */
export function rings(b, { dx = 0, dy = 0, times = 3, every = 360, count = 16, speed = 0.55, styles = [S.orbM, S.ring], turn = 0 } = {}) {
    const k = b.n(count), off = Math.random() * TAU;
    b.repeat(every, times, (i, x, y) => {
        ring(b.pool, x + dx, y + dy, { speed: b.sp(speed), style: styles[i % styles.length], damage: b.dmg, count: k, offset: off + (i * Math.PI) / k, turn: turn * (i & 1 ? -1 : 1) });
        b.sfx();
    });
    return times * every;
}

/** telegraphed lances from (dx,dy): the middle one aimed at the player, others spaced spreadDeg apart */
export function lances(b, { dx = 0, dy = 0, count = 3, spreadDeg = 24, ms = 820, n = 12 } = {}) {
    const x0 = b.x + dx, y0 = b.y + dy, a = angleTo(x0, y0, b.c.px, b.c.py);
    const angles = Array.from({ length: count }, (_, i) => a + (i - (count - 1) / 2) * spreadDeg * DEG);
    for (const an of angles) b.warn.line(ms, { x: x0, y: y0, a: an });
    b.after(ms, () => {
        for (const an of angles) lance(b.pool, x0, y0, an, { count: b.n(n), speed: b.sp(1.1), speedMax: b.sp(2.3), style: S.needleM, damage: b.dmg });
        b.g.fx.shake(2, 160);
        b.sfx();
    });
    return ms;
}

/** amber lanes under muzzles, then a heavy column of orbs slams down each one */
export function hammer(b, xs, { y, ms = 900, count = 14, every = 70, w = 26 } = {}) {
    for (const x of xs) b.warn.lane(ms, { x, y, w });
    b.after(ms, () => {
        b.repeat(every, b.n(count), (i) => {
            for (const x of xs) b.pool.spawn(x + rnd(-w / 3, w / 3), y, Math.PI / 2 + rnd(-3, 3) * DEG, b.sp(1.45), i & 1 ? S.orbL : S.orbM, { damage: b.dmg });
            if (i % 3 === 0) b.sfx();
        });
        b.g.fx.shake(2, 300);
    });
    return ms + count * every;
}

/** slow drifting debris from random points along the top edge (accelerating) */
export function debrisRain(b, { count = 18, every = 110 } = {}) {
    b.repeat(every, b.n(count), (i) => {
        b.pool.spawn(rnd(16, W - 16), -4, Math.PI / 2 + rnd(-12, 12) * DEG, b.sp(0.25), i % 3 ? S.orbS : S.orbM, { damage: b.dmg, accel: b.sp(0.5), maxSpeed: b.sp(1.1) });
    });
    return count * every;
}
