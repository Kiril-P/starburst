// Tiny pooled particle engine for Fx: every short-lived effect object (sprite or text) is a record stepped
// here with plain maths instead of tweens/physics, so there is no per-spawn allocation once the pools are warm,
// and hit-stop / slow-mo apply to effects simply by scaling the dt we are given.
import Phaser from 'phaser';

const MAX_LIVE = 700;   // LOW graphics quality halves this (see systems/quality.js)
const ADD = Phaser.BlendModes.ADD, NORMAL = Phaser.BlendModes.NORMAL;

function resetRecord(r) {
    r.vx = 0; r.vy = 0; r.drag = 0; r.age = 0; r.life = 300; r.delay = 0;
    r.frames = 1; r.fps = 0; r.frame0 = 0; r.fadeFrom = 1; r.a0 = 1; r.tints = null; r.spin = 0;
    r.blink = false; r.rise = 0; r.s0 = 1; r.s1 = 1; r.stepAlpha = false;
    return r;
}

export default class Particles {
    constructor(scene) {
        this.scene = scene;
        this.live = [];
        this.freeRecords = [];
        this.freeSprites = [];
        this.freeTexts = [];
        this.max = MAX_LIVE;
    }

    /** density 1 = full, 0.5 = LOW quality */
    setDensity(d) { this.max = Math.round(MAX_LIVE * d); }

    get full() { return this.live.length >= this.max; }

    /** Spawn a sprite record. Returns the record (configure its fields) or null when the pool is saturated. */
    sprite(key, frame, x, y, depth, add = false) {
        if (this.full) return null;
        const obj = this.freeSprites.pop() || this.scene.add.sprite(0, 0, key);
        obj.setTexture(key, frame).setOrigin(0.5).setScale(1).setRotation(0).setAlpha(1).clearTint()
            .setFlip(false, false).setBlendMode(add ? ADD : NORMAL).setDepth(depth).setActive(true).setVisible(true)
            .setPosition(Math.round(x), Math.round(y));
        return this._record(obj, 'spr', x, y);
    }

    /** Spawn a text record from a factory (pxText) the first time, re-using pooled Text objects afterwards. */
    text(make, str, color, size, x, y, depth) {
        if (this.full) return null;
        let obj = this.freeTexts.pop();
        if (obj) obj.setText(str).setColor(color).setFontSize(`${size}px`);
        else obj = make();
        obj.setOrigin(0.5, 1).setAlpha(1).setDepth(depth).setActive(true).setVisible(true).setPosition(Math.round(x), Math.round(y));
        return this._record(obj, 'txt', x, y);
    }

    _record(obj, type, x, y) {
        const r = resetRecord(this.freeRecords.pop() || {});
        r.obj = obj; r.type = type; r.x = x; r.y = y;
        this.live.push(r);
        return r;
    }

    /** Advance all records by dt ms (already time-scaled; 0 = frozen). */
    step(dt) {
        if (dt <= 0) return;
        const s = dt / 1000;
        const live = this.live;
        for (let i = live.length - 1; i >= 0; i--) {
            const r = live[i], o = r.obj;
            if (r.delay > 0) {
                r.delay -= dt;
                o.setVisible(false);
                if (r.delay > 0) continue;
                o.setVisible(true);
            }
            r.age += dt;
            if (r.age >= r.life) { this._kill(i); continue; }
            const t = r.age / r.life;
            if (r.drag) { const k = Math.exp(-r.drag * s); r.vx *= k; r.vy *= k; }
            r.x += r.vx * s; r.y += r.vy * s;
            const ry = r.rise ? r.y - Math.floor(r.age * r.rise / 1000) : r.y;   // text rises in whole-pixel steps
            o.setPosition(Math.round(r.x), Math.round(ry));
            if (r.frames > 1) o.setFrame(r.frame0 + Math.min(r.frames - 1, Math.floor(r.age * r.fps / 1000)));
            if (r.spin) o.rotation += r.spin * s;
            if (r.s0 !== r.s1) o.setScale(r.s0 + (r.s1 - r.s0) * t);
            if (r.tints) o.setTint(r.tints[Math.min(r.tints.length - 1, Math.floor(t * r.tints.length))]);
            if (t > r.fadeFrom) {
                let a = r.a0 * (1 - (t - r.fadeFrom) / (1 - r.fadeFrom));
                if (r.stepAlpha) a = Math.ceil(a * 3) / 3;
                o.setAlpha(a);
            } else if (r.a0 !== 1) o.setAlpha(r.a0);
            if (r.blink && t > 0.7) o.setVisible(((r.age / 45) | 0) % 2 === 0);
        }
    }

    _kill(i) {
        const live = this.live, r = live[i];
        live[i] = live[live.length - 1];
        live.pop();
        r.obj.setVisible(false).setActive(false);
        (r.type === 'txt' ? this.freeTexts : this.freeSprites).push(r.obj);
        r.obj = null; r.tints = null;
        this.freeRecords.push(r);
    }

    clear() { for (let i = this.live.length - 1; i >= 0; i--) this._kill(i); }

    destroy() {
        this.clear();
        for (const o of this.freeSprites) o.destroy();
        for (const o of this.freeTexts) o.destroy();
        this.freeSprites.length = 0; this.freeTexts.length = 0; this.freeRecords.length = 0;
    }
}
