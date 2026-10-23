// Effects for a scene: explosions, sparks, debris, text pops, screen shake, flashes, hit-stop and slow-mo.
// Everything is built from the pixel-art textures in art/sprites/fx.js; glowing parts use ADD blending.
// All coordinates are native 640x360 world pixels. Colours are 0xRRGGBB numbers unless stated.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS as C } from '../art/palette.js';
import { save } from '../systems/Save.js';
import { pxText } from '../ui/text.js';
import Particles from './particles.js';
import TimeControl from './timeControl.js';
import { addBloom, removeBloom } from './bloom.js';

// per explosion size: sprite fps, glow, shockwave scale, debris/spark counts, shake [px, ms]
const SIZES = {
    s: { fps: 18, glow: 'glow_m', glowScale: 1, ring: 0.36, debris: 3, sparks: 10, speed: 120, shake: [1, 70] },
    m: { fps: 16, glow: 'glow_l', glowScale: 0.8, ring: 0.6, debris: 6, sparks: 16, speed: 160, shake: [2, 140] },
    l: { fps: 14, glow: 'glow_l', glowScale: 1.5, ring: 1, debris: 11, sparks: 28, speed: 220, shake: [3, 280] }
};
// heat ramps (hot -> cold) used for spark tints, glow and shockwave colour per palette
const PALETTES = {
    fire: { ramp: [C.w, C.z, C.A, C.a, C.r], glow: C.A, ring: C.z, debris: [C['5'], C.a] },
    cyan: { ramp: [C.w, C.b, C.C, C.c, C.n], glow: C.C, ring: C.b, debris: [C['5'], C.c] },
    magenta: { ramp: [C.w, C.q, C.M, C.m, C.p], glow: C.M, ring: C.q, debris: [C.x, C.m] },
    lime: { ramp: [C.w, C.j, C.L, C.l, C.g], glow: C.L, ring: C.j, debris: [C.V, C.l] }
};
const DEBRIS = ['debris_0', 'debris_1', 'debris_2', 'debris_3'];
const SHOCK_FRAMES = 12, SHOCK_FPS = 24;
// radius (px) of each shockwave frame, mirrors the generator in art/sprites/fx.js
const SHOCK_R = Array.from({ length: SHOCK_FRAMES }, (_, i) => 3 + 44 * (1 - Math.pow(1 - i / 11, 2.2)));
const rand = Phaser.Math.FloatBetween;

export default class Fx {
    constructor(scene) {
        this.scene = scene;
        this.p = new Particles(scene);
        this.clock = new TimeControl(scene);
        this.shakeAmp = 0; this.shakeMs = 0; this.shakeLeft = 0; this.shakeX = 0; this.shakeY = 0;
        this.flashRect = null; this.flashA = 0; this.flashMs = 0; this.flashLeft = 0;
        this.bloom = false;
        this.stepped = false;
        this.setGlow(save.glow);
        scene.events.on('postupdate', this._tick, this);
        scene.events.once('shutdown', this.destroy, this);
    }

    /** current effect time scale (0 during hit-stop, <1 during slow-mo). Gameplay may multiply its own dt by this. */
    get timeScale() { return this.clock.scale; }
    get frozen() { return this.clock.frozen; }

    /** pixel-art explosion + glow + debris. size: 's' | 'm' | 'l'. palette: 'fire' | 'cyan' | 'magenta' | 'lime' */
    explosion(x, y, size = 'm', palette = 'fire') {
        if (!SIZES[size]) size = 'm';
        if (!PALETTES[palette]) palette = 'fire';
        const cfg = SIZES[size], pal = PALETTES[palette], suffix = palette === 'fire' ? '' : `_${palette}`;
        const key = `explosion_${size}${suffix}`;
        this._glow(x, y, cfg.glow, pal.glow, cfg.glowScale, 0.7, size === 'l' ? 420 : 260);
        this._glow(x, y, size === 's' ? 'glow_s' : 'glow_m', C.w, 1, 0.9, 90);           // white-hot core pop
        const n = this.scene.textures.get(key).frameTotal - 1;   // frameTotal includes the __BASE frame
        const r = this.p.sprite(key, 0, x, y, DEPTH.FX);
        if (r) { r.frames = n; r.fps = cfg.fps; r.life = (n * 1000) / cfg.fps; }
        this.shockwave(x, y, pal.ring, cfg.ring);
        this._burst(x, y, cfg.sparks, cfg.speed, pal.ramp, size === 'l' ? 'px2' : 'px1', size === 's' ? 380 : 520);
        this.debris(x, y, cfg.debris, pal.debris[0]);
        if (size !== 's') this.debris(x, y, cfg.debris >> 1, pal.debris[1]);
        if (size === 'l') {
            // secondary pops + lingering smoke make big kills feel heavy
            for (let i = 0; i < 3; i++) {
                const a = rand(0, Math.PI * 2), d = rand(12, 22);
                const s = this.p.sprite(`explosion_s${suffix}`, 0, x + Math.cos(a) * d, y + Math.sin(a) * d, DEPTH.FX);
                if (s) { s.frames = 6; s.fps = 18; s.life = 6000 / 18; s.delay = 90 + i * 80; }
            }
            for (let i = 0; i < 4; i++) {
                const s = this.p.sprite('smoke', 0, x + rand(-14, 14), y + rand(-14, 14), DEPTH.FX - 1);
                if (s) { s.frames = 4; s.fps = 6; s.life = 4000 / 6; s.delay = 250 + i * 60; s.vy = rand(-8, 8); s.vx = rand(-8, 8); }
            }
        }
        this.shake(cfg.shake[0], cfg.shake[1]);
    }

    /** tiny impact burst of square pixels */
    hitSpark(x, y, color = 0x39e7ff) {
        const r = this.p.sprite('spark', 0, x, y, DEPTH.FX_TOP, true);
        if (r) { r.frames = 3; r.fps = 24; r.life = 3000 / 24; r.obj.setTint(color); }
        this._burst(x, y, 4, 90, [C.w, color], 'px1', 140);
    }

    /** expanding 1px ring (uses the `shockwave` frames). scale 1 = 96px diameter */
    shockwave(x, y, color = 0xffffff, scale = 1) {
        const r = this.p.sprite('shockwave', 0, x, y, DEPTH.FX, true);
        if (!r) return;
        r.obj.setTint(color);
        r.fps = SHOCK_FPS;
        if (scale >= 1) {
            r.frames = SHOCK_FRAMES; r.obj.setScale(scale); r.s0 = r.s1 = scale;
        } else {
            // a 1px ring can't be scaled down without losing pixels: play only the frames up to the wanted radius
            let k = 1;
            while (k < SHOCK_FRAMES - 1 && SHOCK_R[k + 1] <= 48 * scale) k++;
            r.frames = k + 1; r.fadeFrom = 0.5;
        }
        r.life = (r.frames * 1000) / SHOCK_FPS;
    }

    debris(x, y, count = 6, tint = 0x9aaad0) {
        for (let i = 0; i < count; i++) {
            const r = this.p.sprite(DEBRIS[(Math.random() * 4) | 0], 0, x, y, DEPTH.FX - 1, false);   // emerges from under the fireball
            if (!r) return;
            const a = rand(0, Math.PI * 2), v = rand(40, 130);
            r.vx = Math.cos(a) * v; r.vy = Math.sin(a) * v; r.drag = 2.2;
            r.spin = rand(-9, 9); r.obj.setRotation(a).setTint(tint);
            r.life = rand(450, 850); r.blink = true;
        }
    }

    /** floating text that rises and fades. color is a CSS string */
    floatText(x, y, text, color = '#f4faff', size = 8) {
        const r = this.p.text(() => pxText(this.scene, 0, 0, text, { size, color }), text, color, size, x, y, DEPTH.FX_TOP);
        if (!r) return;
        r.rise = 22; r.life = 750; r.fadeFrom = 0.6; r.stepAlpha = true;
    }

    /** camera shake in whole pixels; honours save.screenShake. strength 1 = small hit, 3 = big boom */
    shake(strength = 1, ms = 120) {
        const amp = strength * save.screenShake;
        if (amp <= 0) return;
        // stronger shakes override, weaker ones only extend the time a little
        if (amp >= this.shakeAmp * (this.shakeLeft / (this.shakeMs || 1))) { this.shakeAmp = amp; this.shakeMs = ms; this.shakeLeft = ms; }
        else this.shakeLeft = Math.min(this.shakeMs, this.shakeLeft + ms * 0.25);
    }

    /** freeze-frame feel: briefly pause physics+tweens+time for ms */
    hitStop(ms = 40) { this.clock.hitStop(ms); }

    /** full-screen additive flash; honours save.flashEffects */
    flash(color = 0xffffff, alpha = 0.3, ms = 80) {
        if (!save.flashEffects) return;
        if (!this.flashRect) {
            this.flashRect = this.scene.add.rectangle(0, 0, W, H, color).setOrigin(0).setScrollFactor(0)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FX_TOP + 1);
        }
        if (this.flashLeft > 0 && this.flashA * (this.flashLeft / this.flashMs) > alpha) return;
        this.flashRect.setFillStyle(color).setVisible(true).setAlpha(alpha);
        this.flashA = alpha; this.flashMs = ms; this.flashLeft = ms;
    }

    /** spark when the player grazes a bullet */
    grazeSpark(x, y) {
        const r = this.p.sprite('spark', 1, x, y, DEPTH.FX_TOP, true);
        if (r) { r.frames = 2; r.frame0 = 1; r.fps = 20; r.life = 100; r.obj.setTint(C.b); }
        this._burst(x, y, 2, 70, [C.w, C.b, C.C], 'px1', 200);
    }

    muzzle(x, y) {
        const r = this.p.sprite('pshot_muzzle', 0, x, y, DEPTH.FX, true);
        if (r) { r.frames = 3; r.fps = 30; r.life = 100; }
        this._glow(x, y, 'glow_s', C.C, 1, 0.5, 80);
    }

    /** global time scale dip (0.4 = 40% speed) for dramatic moments */
    slowmo(scale = 0.4, ms = 300) { this.clock.slowmo(scale, ms); }

    /** step effects by dt (ms, real time). Called by the scene; if a scene forgets, Fx steps itself. */
    update(dt) {
        if (!this.p) return;   // already destroyed (scene shutdown)
        this.stepped = true;
        this.p.step(dt * this.clock.scale);
    }

    /** turn the subtle bloom post-FX on/off (WebGL only; the preference itself lives in save.glow) */
    setGlow(on) {
        try {
            const cam = this.scene.cameras.main;
            if (on && !this.bloom) this.bloom = addBloom(cam);
            else if (!on && this.bloom) { removeBloom(cam); this.bloom = false; }
        } catch (e) { this.bloom = false; /* canvas renderer: no post-FX */ }
    }

    destroy() {
        if (!this.p) return;
        this.scene.events.off('postupdate', this._tick, this);
        this.scene.events.off('shutdown', this.destroy, this);
        this.clock.destroy();
        this._applyShake(0, 0);
        this.setGlow(false);
        this.p.destroy();
        if (this.flashRect) this.flashRect.destroy();
        this.p = null;
    }

    // ---- internals --------------------------------------------------------------------------------------

    _glow(x, y, key, tint, scale, alpha, life) {
        const r = this.p.sprite(key, 0, x, y, DEPTH.FX, true);
        if (!r) return;
        r.obj.setTint(tint).setAlpha(alpha);
        r.a0 = alpha; r.fadeFrom = 0.15; r.life = life; r.s0 = scale; r.s1 = scale * 1.25;
    }

    /** spray of square pixels that cool down along a colour ramp */
    _burst(x, y, count, speed, ramp, key = 'px1', life = 380) {
        for (let i = 0; i < count; i++) {
            const r = this.p.sprite(i % 3 === 0 && key === 'px1' ? 'px2' : key, 0, x, y, DEPTH.FX_TOP, true);
            if (!r) return;
            const a = rand(0, Math.PI * 2), v = speed * rand(0.35, 1);
            r.vx = Math.cos(a) * v; r.vy = Math.sin(a) * v; r.drag = 3;
            r.tints = ramp; r.obj.setTint(ramp[0]);
            r.life = life * rand(0.6, 1.2); r.blink = true;
        }
    }

    _applyShake(ox, oy) {
        const cam = this.scene.cameras && this.scene.cameras.main;
        if (!cam) return;
        // offset relative to what we applied last frame, so we never fight other camera scrolling
        cam.scrollX += ox - this.shakeX; cam.scrollY += oy - this.shakeY;
        this.shakeX = ox; this.shakeY = oy;
    }

    /** real-time housekeeping, runs after the scene's update every frame */
    _tick() {
        const dt = this.scene.game.loop.delta;
        this.clock.tick();
        if (!this.stepped) this.p.step(dt * this.clock.scale);
        this.stepped = false;
        if (this.shakeLeft > 0) {
            this.shakeLeft -= dt;
            const amp = this.shakeLeft > 0 ? this.shakeAmp * (this.shakeLeft / this.shakeMs) : 0;
            this._applyShake(Math.round(rand(-amp, amp)), Math.round(rand(-amp, amp)));
        } else if (this.shakeX || this.shakeY) this._applyShake(0, 0);
        if (this.flashLeft > 0) {
            this.flashLeft -= dt;
            if (this.flashLeft <= 0) this.flashRect.setVisible(false);
            else this.flashRect.setAlpha(this.flashA * (this.flashLeft / this.flashMs));
        }
    }
}
