// Station lasers (pylons, wall emitters). A beam is a straight band from a point along an angle: telegraphed first
// (dotted centre line + edge ticks that show its width; the last `lockMs` is dense and strobing = locked, it no longer
// tracks you), then live for `fireMs` as a thick magenta band. The band hurts once per beam (like a bullet it is
// ignored while you have i-frames / dash / phase / a shield) and a near miss counts as a graze.
// Driven by simulation dt, so pause / hit-stop freeze it exactly like the bullets it replaces. The beam dies with its
// emitter: shooting the pylon during the charge cancels the shot.
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { PLAYER } from '../systems/tuning.js';

const LONG = Math.hypot(W, H);

export default class Beams {
    constructor(scene) {
        this.scene = scene;
        this.g = scene.add.graphics().setDepth(DEPTH.ENEMY + 1);
        this.items = [];
        this.spare = [];
        this.t = 0;
    }

    /**
     * owner = the emitting enemy. o: { x, y, a, w (band width px), damage (x enemy bullet damage), chargeMs, lockMs, fireMs,
     * len, sweep (half-range in rad: the live band rotates a0 - sweep -> a0 + sweep, and the telegraph shows both edges), dir (+1 / -1),
     * follow(b) (called every frame: move x / y / a here, and stop tracking when b.locked) }. Returns the beam.
     */
    add(owner, o) {
        const b = this.spare.pop() || {};
        Object.assign(b, {
            owner, gen: owner.gen, x: o.x, y: o.y, a: o.a, w: o.w ?? 7, mul: o.damage ?? 1.8, len: o.len ?? LONG, a0: o.a, sweep: o.sweep ?? 0, dir: o.dir ?? 1,
            chargeMs: o.chargeMs ?? 1100, lockMs: o.lockMs ?? 400, fireMs: o.fireMs ?? 380, follow: o.follow ?? null,
            t: 0, locked: false, live: false, hit: false, grazed: false, done: false
        });
        this.items.push(b);
        return b;
    }

    clear() {
        for (const b of this.items) { b.done = true; this.spare.push(b); }
        this.items.length = 0;
        this.g.clear();
    }

    update(dt, game) {
        const gfx = this.g.clear();
        if (!this.items.length) return;
        this.t += dt;
        const p = game.player;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const b = this.items[i], o = b.owner;
            if (!o.alive || o.gen !== b.gen || b.t >= b.chargeMs + b.fireMs) {
                b.done = true;
                this.items[i] = this.items[this.items.length - 1];
                this.items.pop();
                this.spare.push(b);
                continue;
            }
            b.t += dt;
            b.locked = b.t >= b.chargeMs - b.lockMs;
            if (b.follow) b.follow(b);
            if (b.t < b.chargeMs) { this.telegraph(gfx, b); continue; }
            if (b.sweep) b.a = b.a0 + b.dir * b.sweep * (2 * Math.min(1, (b.t - b.chargeMs) / b.fireMs) - 1);
            if (!b.live) { b.live = true; game.fx.shake(2, 200); game.audio.play('beam-fire', { vol: 0.8 }); game.bg.pulse(0.4); }
            this.band(gfx, b);
            if (p.alive && !game.dying) this.test(game, p, b);
        }
    }

    /** player vs the live band: one hit per beam, a near miss is a graze */
    test(game, p, b) {
        if (b.hit || !p.hittable) return;
        const dx = Math.cos(b.a), dy = Math.sin(b.a);
        const along = Math.max(0, Math.min(b.len, (p.x - b.x) * dx + (p.y - b.y) * dy));
        const nx = b.x + dx * along, ny = b.y + dy * along;
        const d = Math.hypot(p.x - nx, p.y - ny), reach = b.w / 2 + PLAYER.hitRadius;
        if (d < reach) { b.hit = true; game.combat.beamHit(b); }
        else if (!b.grazed && d < reach + PLAYER.grazeRadius + (p.grazeBonus || 0)) { b.grazed = true; game.combat.graze({ x: nx, y: ny }); }
    }

    telegraph(g, b) {
        if (b.sweep) {   // a sweeping band: mark both edges of the sector it will cross, and where it starts
            const late = b.locked, col = late ? (((this.t / 45) | 0) & 1 ? COLORS.z : COLORS.A) : (((this.t / 90) | 0) & 1 ? COLORS.A : COLORS.a);
            g.fillStyle(col, 1);
            const step = late ? 2 : 4, off = (this.t / 30) % step;
            for (const e of [-1, 1]) {
                const a = b.a0 + e * b.sweep, c = Math.cos(a), s = Math.sin(a);
                for (let d = 6 + off; d < b.len; d += step) {
                    const px = Math.round(b.x + c * d), py = Math.round(b.y + s * d);
                    if (px < -1 || px > W || py < -1 || py > H) break;
                    g.fillRect(px, py, 1, 1);
                    if (e === -b.dir && d % 12 < step) g.fillRect(px + 1, py, 1, 1);   // thicker line = where the sweep STARTS
                }
            }
            if (late) g.fillRect(Math.round(b.x) - 3, Math.round(b.y) + 1, 7, 1);
            return;
        }
        const late = b.locked, c = Math.cos(b.a), s = Math.sin(b.a), half = b.w / 2 + 1;
        const col = late ? (((this.t / 45) | 0) & 1 ? COLORS.z : COLORS.A) : (((this.t / 90) | 0) & 1 ? COLORS.A : COLORS.a);
        g.fillStyle(col, 1);
        const step = late ? 2 : 4, off = (this.t / 30) % step;
        for (let d = 6 + off; d < b.len; d += step) {
            const px = Math.round(b.x + c * d), py = Math.round(b.y + s * d);
            if (px < -1 || px > W || py < -1 || py > H) break;
            g.fillRect(px, py, 1, 1);
        }
        // edge ticks: where the band will be, so "how far do I have to move" is readable at a glance
        for (let d = 14 + (late ? 0 : off * 2); d < b.len; d += late ? 8 : 14) {
            for (const k of [-half, half]) {
                const px = Math.round(b.x + c * d - s * k), py = Math.round(b.y + s * d + c * k);
                if (px < -1 || px > W || py < -1 || py > H) continue;
                g.fillRect(px, py, 1, 2);
            }
        }
        if (late) { g.fillRect(Math.round(b.x) - 3, Math.round(b.y) + 1, 7, 1); }
    }

    band(g, b) {
        const k = (b.t - b.chargeMs) / b.fireMs, shrink = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, flick = ((this.t / 40) | 0) & 1 ? 1 : 0;
        const x1 = b.x + Math.cos(b.a) * b.len, y1 = b.y + Math.sin(b.a) * b.len;
        const w = b.w * shrink;
        g.lineStyle(Math.round(w + 6 + flick * 2), COLORS.p, 0.55);
        g.lineBetween(b.x, b.y, x1, y1);
        g.lineStyle(Math.round(w + 2), COLORS.M, 1);
        g.lineBetween(b.x, b.y, x1, y1);
        g.lineStyle(Math.max(1, Math.round(w - 3 - flick)), COLORS.w, 1);
        g.lineBetween(b.x, b.y, x1, y1);
        g.fillStyle(COLORS.q, 1);
        g.fillCircle(Math.round(b.x), Math.round(b.y), Math.round(4 + w / 3));
    }

    destroy() { this.g.destroy(); this.items.length = 0; }
}
