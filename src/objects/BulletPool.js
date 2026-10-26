// Custom pooled bullets: plain Images moved by our own integrator and tested with circle-vs-circle math.
// No arcade bodies, no per-frame allocations: dead bullets go back on a free stack and stay invisible.
//
// A bullet carries: angle (rad), speed (px/s), accel (px/s^2), turn (rad/s), r (hit radius), damage,
// grazed flag, age. Movement is polar so curving (spiral) and accelerating (needle curtain) patterns are cheap.
import { W, H } from '../config.js';
import { ENEMY_BULLET } from '../systems/tuning.js';
import { save } from '../systems/Save.js';
import { contrastTexture } from '../art/highContrast.js';
import { origin } from './patterns.js';

export default class BulletPool {
    /** opts: { size, depth, cullMargin } */
    constructor(scene, opts) {
        this.scene = scene;
        this.margin = opts.cullMargin ?? ENEMY_BULLET.cullMargin;
        this.free = [];
        this.live = [];
        this.textureCache = new Map();
        this.contrast = save.bulletContrast;   // Settings > ENEMY BULLETS, fixed for the run (only enemy bullet_* keys change)
        for (let i = 0; i < opts.size; i++) {
            const b = scene.add.image(-99, -99, 'px1').setDepth(opts.depth).setVisible(false).setActive(false);
            b.alive = false;
            this.free.push(b);
        }
    }

    get count() { return this.live.length; }

    /**
     * Spawn one bullet. style: { key, r, orient, tint? } (see patterns.js STYLE). Returns the bullet or null when the pool is dry.
     * extra: { accel, turn, minSpeed, maxSpeed, damage }
     */
    spawn(x, y, angle, speed, style, extra) {
        const b = this.free.pop();
        if (!b) return null;
        const tex = this.resolve(style);
        b.setTexture(tex.key);
        if (tex.tint !== null) b.setTint(tex.tint); else b.clearTint();
        b.setPosition(x, y).setVisible(true).setActive(true);
        b.alive = true;
        b.angle0 = angle;
        b.speed = speed;
        b.r = style.r;
        b.orient = !!style.orient;
        b.accel = extra?.accel ?? 0;
        b.turn = extra?.turn ?? 0;
        b.minSpeed = extra?.minSpeed ?? 0;
        b.maxSpeed = extra?.maxSpeed ?? 9999;
        b.damage = extra?.damage ?? ENEMY_BULLET.damage;
        b.grazed = false;
        b.age = 0;
        b.src = origin.v;   // who fired it (telemetry: what hurt the player)
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        // needles/shards/player shots are drawn pointing UP, so rotate by +90deg relative to travel angle
        b.setRotation(b.orient ? angle + Math.PI / 2 : 0);
        this.live.push(b);
        return b;
    }

    /** Variant keys (bullet_orb_m_amber) may not exist until the art lands: fall back to the base key + tint. */
    resolve(style) {
        let t = this.textureCache.get(style.key);
        if (!t) {
            const ok = this.scene.textures.exists(style.key);
            t = contrastTexture(this.scene.textures, style, this.contrast)
                || (ok ? { key: style.key, tint: null } : { key: style.base, tint: style.fallbackTint ?? null });
            this.textureCache.set(style.key, t);
        }
        return t;
    }

    kill(b) {
        if (!b.alive) return;
        b.alive = false;
        b.setVisible(false).setActive(false);
        // removal from `live` happens lazily in update() (swap-remove), so kill() is safe mid-iteration
    }

    update(dt) {
        const s = dt / 1000;
        const live = this.live;
        const m = this.margin;
        for (let i = live.length - 1; i >= 0; i--) {
            const b = live[i];
            if (b.alive) {
                b.age += dt;
                if (b.accel !== 0 || b.turn !== 0) {
                    if (b.accel !== 0) b.speed = Math.min(b.maxSpeed, Math.max(b.minSpeed, b.speed + b.accel * s));
                    if (b.turn !== 0) {
                        b.angle0 += b.turn * s;
                        if (b.orient) b.rotation = b.angle0 + Math.PI / 2;
                    }
                    b.vx = Math.cos(b.angle0) * b.speed;
                    b.vy = Math.sin(b.angle0) * b.speed;
                }
                b.x += b.vx * s;
                b.y += b.vy * s;
                if (b.x < -m || b.x > W + m || b.y < -m || b.y > H + m || b.age > ENEMY_BULLET.maxAgeMs) this.kill(b);
            }
            if (!b.alive) {
                live[i] = live[live.length - 1];
                live.pop();
                this.free.push(b);
            }
        }
    }

    /** Kill every bullet, calling fn(b) first (used by forcefield / wave clear to spawn sparks). */
    clear(fn) {
        for (const b of this.live) {
            if (!b.alive) continue;
            if (fn) fn(b);
            this.kill(b);
        }
    }

    destroy() {
        for (const b of this.free) b.destroy();
        for (const b of this.live) b.destroy();
        this.free.length = 0;
        this.live.length = 0;
    }
}
