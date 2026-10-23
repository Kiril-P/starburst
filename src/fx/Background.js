// Parallax pixel-art space backdrop. Layers, back to front:
//   deep gradient (static) -> far nebula -> far 1px stars -> planet -> near nebula filaments -> near stars
//   -> twinkling stars -> drifting asteroid chunks -> speed streaks
// All textures are generated once (bgArt.js) and cached under unique keys; nebulae/stars are TileSprites that
// scroll by whole-pixel tilePosition, so a frame costs a few draw calls and zero allocations.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS as C } from '../art/palette.js';
import { save } from '../systems/Save.js';
import { BIOMES, TILE_H, gradientTexture, nebulaTexture, starTexture, planetKey, bakeProps, streakKey, STREAK_COUNT, ROCK_KEYS } from './bgArt.js';

const SPEED = { far: 4, starsFar: 7, planet: 2.5, near: 13, starsNear: 22 };   // px/s at intensity 1
const ADD = Phaser.BlendModes.ADD;
const N_TWINKLE = 14, N_STREAK = 24, N_ROCK = 4;
const STREAK_TINTS = [C.b, C.b, C['6'], C.x, C.C];
const rand = Phaser.Math.FloatBetween;
const wrap = (v, m) => ((v % m) + m) % m;

export default class Background {
    /** @param opts { biome: 0..4 } */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.biome = Phaser.Math.Clamp(opts.biome | 0, 0, BIOMES.length - 1);
        bakeProps(scene);
        const tile = (key, depth) => scene.add.tileSprite(0, 0, W, H, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
        // two layer sets so a biome change can crossfade; `front` is the visible one
        this.sets = [0, 1].map(() => ({
            grad: scene.add.image(0, 0, '__WHITE').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.BG),
            far: tile('__WHITE', DEPTH.BG + 0.1),
            near: tile('__WHITE', DEPTH.BG_NEAR)
        }));
        this.front = 0;
        this.fade = null;
        this.pending = null;
        this._assign(this.sets[0], this.biome);
        this._setAlpha(this.sets[1], 0, false);

        this.starsFar = tile(starTexture(scene, 'far'), DEPTH.BG_FAR);
        this.starsNear = tile(starTexture(scene, 'near'), DEPTH.BG_NEAR + 0.1);
        // ADD-blended copies used only while pulsing: brighten nebula filaments + stars, not the black
        this.pulseFar = tile(this.sets[0].far.texture.key, DEPTH.BG + 0.15).setBlendMode(ADD).setVisible(false);
        this.pulseNeb = tile(this.sets[0].near.texture.key, DEPTH.BG_NEAR + 0.05).setBlendMode(ADD).setVisible(false);
        this.pulseStars = tile(this.starsNear.texture.key, DEPTH.BG_NEAR + 0.15).setBlendMode(ADD).setVisible(false);
        this.pulseV = 0;
        this.off = { far: 0, starsFar: 0, near: 0, starsNear: 0 };

        // a planet is on screen from the start (upper right), later ones drift in rarely
        // planet sits above the star layers (stars are always further away) but below the drifting rocks
        this.planet = scene.add.image(0, 0, planetKey(scene, this.biome)).setDepth(DEPTH.BG_NEAR + 0.25);
        this.planetY = 70; this.planetX = W - 96; this.planetWait = 0;
        this.planet.setPosition(this.planetX, this.planetY);

        this.twinkles = Array.from({ length: N_TWINKLE }, () => {
            const s = scene.add.sprite(rand(0, W) | 0, rand(0, H) | 0, 'bg_twinkle', 0).setDepth(DEPTH.BG_NEAR + 0.2).setBlendMode(ADD);
            s.setData({ fy: s.y, phase: Math.random(), rate: rand(0.15, 0.45) });
            return s;
        });
        this.rocks = Array.from({ length: N_ROCK }, () => scene.add.image(0, 0, ROCK_KEYS[0]).setDepth(DEPTH.BG_NEAR + 0.3).setVisible(false));
        this.rockState = this.rocks.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
        this.rockWait = rand(2000, 6000);
        this.streaks = Array.from({ length: N_STREAK }, () => scene.add.image(0, 0, streakKey(0)).setOrigin(0.5, 1).setDepth(DEPTH.BG_NEAR + 0.4).setBlendMode(ADD).setVisible(false));
        this.streakVy = new Float32Array(N_STREAK);
        this.streakY = new Float32Array(N_STREAK);
        this.streakAcc = 0;
        this.time = 0;
    }

    /** @param dt ms since last frame, @param intensity 1 = calm drift, >1 = faster streaks (boss/dash) */
    update(dt, intensity = 1) {
        dt = Math.min(dt || 0, 100);
        const s = dt / 1000, boost = Math.max(0, intensity - 1), m = 1 + boost * 0.8;
        this.time += dt;
        const o = this.off;
        o.far = wrap(o.far + SPEED.far * m * s, TILE_H);
        o.starsFar = wrap(o.starsFar + SPEED.starsFar * m * s, TILE_H);
        o.near = wrap(o.near + SPEED.near * m * s, TILE_H);
        o.starsNear = wrap(o.starsNear + SPEED.starsNear * m * s, TILE_H);
        // decreasing tilePosition moves the texture DOWN the screen (we fly "up")
        for (const set of this.sets) { set.far.tilePositionY = TILE_H - Math.round(o.far); set.near.tilePositionY = TILE_H - Math.round(o.near); }
        this.starsFar.tilePositionY = TILE_H - Math.round(o.starsFar);
        this.starsNear.tilePositionY = TILE_H - Math.round(o.starsNear);

        if (this.pending) this._buildPending();
        this._updateFade(dt);
        this._updatePulse(dt);
        this._updatePlanet(s * m, dt);
        this._updateTwinkles(s * m);
        this._updateRocks(s, m, dt);
        this._updateStreaks(s, boost);
    }

    /** crossfade to another palette/biome (0..N) */
    setBiome(i, fadeMs = 1500) {
        i = wrap(i | 0, BIOMES.length);
        if (this.fade) this._finishFade();
        this.pending = null;
        if (i === this.biome) return;
        this.biome = i;
        if (fadeMs <= 0) {
            const back = this.sets[1 - this.front];
            this._assign(back, i);
            this._setAlpha(back, 1, true);
            this.fade = { t: 1, ms: 1 };
            this._finishFade();
            return;
        }
        // a new biome's textures cost ~45ms to generate: build one per frame, then start the fade
        this.pending = { i, fadeMs, step: 0 };
    }

    /** brief brightness pulse for beats / big hits, strength 0..1 */
    pulse(strength = 0.5) {
        if (!save.flashEffects) strength *= 0.3;   // reduced-flash setting: keep a hint of the beat, lose the strobe
        this.pulseV = Math.min(1, Math.max(this.pulseV, strength));
    }

    destroy() {
        for (const set of this.sets) { set.grad.destroy(); set.far.destroy(); set.near.destroy(); }
        for (const o of [this.starsFar, this.starsNear, this.pulseFar, this.pulseNeb, this.pulseStars, this.planet, ...this.twinkles, ...this.rocks, ...this.streaks]) o.destroy();
        this.sets = []; this.twinkles = []; this.rocks = []; this.streaks = [];
    }

    // ---- internals --------------------------------------------------------------------------------------

    _assign(set, i) {
        set.grad.setTexture(gradientTexture(this.scene, i));
        set.far.setTexture(nebulaTexture(this.scene, i, 'far'));
        set.near.setTexture(nebulaTexture(this.scene, i, 'near'));
    }
    _buildPending() {
        const p = this.pending, sc = this.scene;
        if (p.step === 0) gradientTexture(sc, p.i);
        else if (p.step === 1) nebulaTexture(sc, p.i, 'far');
        else if (p.step === 2) nebulaTexture(sc, p.i, 'near');
        else {
            const back = this.sets[1 - this.front];
            this._assign(back, p.i);
            // incoming set draws just above the outgoing one in every layer
            this._raise(back, true); this._raise(this.sets[this.front], false);
            this._setAlpha(back, 0, true);
            this.fade = { t: 0, ms: p.fadeMs };
            this.pending = null;
            return;
        }
        p.step++;
    }
    _setAlpha(set, a, visible) { for (const k of ['grad', 'far', 'near']) set[k].setAlpha(a).setVisible(visible); }
    _raise(set, up) {
        const d = up ? 0.01 : 0;
        set.grad.setDepth(DEPTH.BG + d); set.far.setDepth(DEPTH.BG + 0.1 + d); set.near.setDepth(DEPTH.BG_NEAR + d);
    }

    _updateFade(dt) {
        if (!this.fade) return;
        const f = this.fade;
        f.t = Math.min(1, f.t + dt / f.ms);
        const a = f.t, out = this.sets[this.front], inn = this.sets[1 - this.front];
        inn.grad.setAlpha(a); inn.far.setAlpha(a); inn.near.setAlpha(a);
        out.far.setAlpha(1 - a); out.near.setAlpha(1 - a);   // outgoing gradient stays opaque underneath
        if (f.t >= 1) this._finishFade();
    }
    _finishFade() {
        const out = this.sets[this.front];
        this.front = 1 - this.front;
        this._setAlpha(this.sets[this.front], 1, true);
        this._setAlpha(out, 0, false);
        this.pulseFar.setTexture(this.sets[this.front].far.texture.key);
        this.pulseNeb.setTexture(this.sets[this.front].near.texture.key);
        this.fade = null;
    }

    _updatePulse(dt) {
        if (this.pulseV <= 0.02) {
            if (this.pulseNeb.visible) { this.pulseFar.setVisible(false); this.pulseNeb.setVisible(false); this.pulseStars.setVisible(false); }
            this.pulseV = 0;
            return;
        }
        this.pulseV *= Math.exp(-dt / 260);
        this.pulseFar.setVisible(true).setAlpha(this.pulseV * 0.6);
        this.pulseNeb.setVisible(true).setAlpha(this.pulseV);
        this.pulseStars.setVisible(true).setAlpha(this.pulseV);
        this.pulseFar.tilePositionY = this.sets[this.front].far.tilePositionY;
        this.pulseNeb.tilePositionY = this.sets[this.front].near.tilePositionY;
        this.pulseStars.tilePositionY = this.starsNear.tilePositionY;
    }

    _updatePlanet(s, dt) {
        const p = this.planet;
        if (this.planetWait > 0) {
            this.planetWait -= dt;
            if (this.planetWait > 0) return;
            // rare visitor: respawn above the screen in the side thirds, using the current biome's planet
            p.setTexture(planetKey(this.scene, this.biome)).setVisible(true).setFlipX(false);
            this.planetX = Math.random() < 0.5 ? rand(40, 200) : rand(W - 200, W - 40);
            this.planetY = -p.height / 2;
        }
        this.planetY += SPEED.planet * s;
        p.setPosition(Math.round(this.planetX), Math.round(this.planetY));
        if (this.planetY - p.height / 2 > H) { p.setVisible(false); this.planetWait = rand(45000, 80000); }
    }

    _updateTwinkles(s) {
        const t = this.time / 1000;
        for (const tw of this.twinkles) {
            const d = tw.data.values;
            d.fy += SPEED.starsNear * s;
            if (d.fy > H + 4) { d.fy = -4; tw.x = rand(0, W) | 0; }
            tw.y = Math.round(d.fy);
            // mostly a dim dot; now and then flares through the cross frames
            const ph = (t * d.rate + d.phase) % 1;
            const f = ph < 0.78 ? 0 : ph < 0.83 ? 1 : ph < 0.9 ? 2 : ph < 0.95 ? 3 : 1;
            if (tw.frame.name !== f) tw.setFrame(f);   // setFrame re-sizes + emits every call: only when it changes
        }
    }

    _updateRocks(s, m, dt) {
        this.rockWait -= dt * m;
        for (let i = 0; i < this.rocks.length; i++) {
            const r = this.rocks[i], st = this.rockState[i];
            if (!r.visible) {
                if (this.rockWait > 0) continue;
                this.rockWait = rand(5000, 12000);
                const big = Math.random() < 0.35;
                r.setTexture(ROCK_KEYS[big ? 2 + ((Math.random() * 2) | 0) : (Math.random() * 2) | 0]).setVisible(true).setFlip(Math.random() < 0.5, false);
                // keep rocks near the side edges so they frame the playfield instead of cluttering it
                st.x = Math.random() < 0.5 ? rand(6, 110) : rand(W - 110, W - 6);
                st.y = -r.height; st.vy = big ? rand(26, 34) : rand(16, 26); st.vx = rand(-3, 3);
                continue;
            }
            st.x += st.vx * s; st.y += st.vy * m * s;
            r.setPosition(Math.round(st.x), Math.round(st.y));
            if (st.y - r.height > H) r.setVisible(false);
        }
    }

    _updateStreaks(s, boost) {
        // calm: an occasional streak; boost (dash/boss): a storm of long fast ones
        this.streakAcc += s * (0.6 + boost * 9);
        for (let i = 0; i < this.streaks.length; i++) {
            const st = this.streaks[i];
            if (!st.visible) {
                if (this.streakAcc < 1) continue;
                this.streakAcc -= 1;
                const len = Math.min(STREAK_COUNT - 1, Math.floor(boost * 1.6 + Math.random() * 2.2));
                st.setTexture(streakKey(len)).setTint(STREAK_TINTS[(Math.random() * STREAK_TINTS.length) | 0])
                    .setAlpha(rand(0.45, 0.9)).setVisible(true);
                st.x = rand(2, W - 2) | 0;
                this.streakY[i] = -2;
                this.streakVy[i] = 240 + boost * 220 + rand(0, 140);
                continue;
            }
            this.streakY[i] += this.streakVy[i] * s;
            st.y = Math.round(this.streakY[i]);
            if (st.y - st.height > H) st.setVisible(false);
        }
        if (this.streakAcc > 1) this.streakAcc = 1;   // pool exhausted: drop the backlog instead of bursting later
    }
}
