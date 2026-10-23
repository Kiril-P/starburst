// Extra parallax layers that only some biomes have (Background owns one of these and forwards setBiome/update):
//   5 asteroid  a far band of drifting rocks between the star layers
//   6 station   dark hull slabs far back + girder towers scrolling down both edges
//   7 solar     a flaring sun at the right edge, rising heat-haze lines and embers
// Each biome's set is built lazily the first time it is needed, one texture per frame (each costs a few ms), then
// crossfaded in while the previous set fades out. Sets are kept (hidden) for reuse and freed in destroy().
// Scrolling is whole-pixel tilePosition / integer positions, like Background.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { TILE_H } from './bgArt.js';
import { beltTexture, deckFarTexture, deckNearTexture, sunTexture, hazeTexture, HAZE_H, SUN_R } from './bgArt2.js';

const ADD = Phaser.BlendModes.ADD;
const wrap = (v, m) => ((v % m) + m) % m;
const rand = Phaser.Math.FloatBetween;
const EMBER_TINTS = [COLORS.A, COLORS.a, COLORS.a, COLORS.R, COLORS.z];
const FLARE_SEQ = [2, 3, 3, 3, 4, 4, 0];   // sun frames for one flare, 110ms each

// per biome: textures to bake (one per frame) + a factory for the game objects
const DEFS = {
    5: { bake: [beltTexture], make: makeBelt },
    6: { bake: [deckFarTexture, deckNearTexture], make: makeStation },
    7: { bake: [sunTexture, hazeTexture], make: makeSolar }
};

function tile(scene, key, depth, h = H) {
    return scene.add.tileSprite(0, 0, W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
}

function makeBelt(scene) {
    const belt = tile(scene, 'bg_belt', DEPTH.BG_FAR + 0.5);
    let off = 0;
    return { objs: [belt], update(s) { off = wrap(off + 10 * s, TILE_H); belt.tilePositionY = TILE_H - Math.round(off); } };
}

function makeStation(scene) {
    const far = tile(scene, 'bg_deck_far', DEPTH.BG_FAR + 0.5), near = tile(scene, 'bg_deck_near', DEPTH.BG_NEAR + 0.35);
    let of = 0, on = 0;
    return {
        objs: [far, near],
        update(s) {
            of = wrap(of + 6 * s, TILE_H); on = wrap(on + 18 * s, TILE_H);
            far.tilePositionY = TILE_H - Math.round(of); near.tilePositionY = TILE_H - Math.round(on);
        }
    };
}

function makeSolar(scene) {
    const cx = W + 34, cy = 112;
    const sun = scene.add.sprite(cx, cy, 'bg_sun', 0).setDepth(DEPTH.BG_FAR + 0.6);
    // glow halos are the one thing STYLE.md allows to be stretched; dithered white disc tinted amber, added on top
    const halo = scene.add.image(cx, cy, 'glow_l').setDepth(DEPTH.BG_FAR + 0.65).setBlendMode(ADD).setTint(COLORS.a).setScale(((SUN_R * 2.6) / 64) | 0);
    const haze = tile(scene, 'bg_haze', DEPTH.BG_NEAR + 0.45).setBlendMode(ADD);
    const embers = Array.from({ length: 14 }, () => scene.add.image(rand(0, W) | 0, rand(0, H) | 0, Math.random() < 0.3 ? 'px2' : 'px1')
        .setDepth(DEPTH.BG_NEAR + 0.42).setBlendMode(ADD).setTint(EMBER_TINTS[(Math.random() * EMBER_TINTS.length) | 0]));
    const ember = embers.map((e) => ({ y: e.y, x0: e.x, vy: rand(8, 26), ph: Math.random() * 6.28 }));
    let t = 0, shimmer = 0, flareWait = rand(3000, 6000), flareStep = -1, flareT = 0, hazeOff = 0;
    return {
        objs: [sun, halo, haze, ...embers],
        alphaOf: (o) => (o === halo ? 0.22 : o === haze ? 0.4 : o.blendMode === ADD && o !== sun ? 0.8 : 1),
        update(s, dt) {   // the sun is far away: it never scrolls
            t += s;
            // corona shimmer between frames 0/1, interrupted now and then by a flare (frames 2-4) + halo swell
            if (flareStep < 0) {
                if ((shimmer -= dt) <= 0) { shimmer = 180; sun.setFrame(sun.frame.name === 0 ? 1 : 0); }
                if ((flareWait -= dt) <= 0) { flareStep = 0; flareT = 0; }
            } else if ((flareT -= dt) <= 0) {
                flareT = 110;
                sun.setFrame(FLARE_SEQ[flareStep++]);
                if (flareStep >= FLARE_SEQ.length) { flareStep = -1; flareWait = rand(5000, 9000); }
            }
            halo.setAlpha(this.alpha * (flareStep >= 0 ? 0.34 : 0.22));
            // heat rises: haze scrolls up and wobbles sideways a pixel or two
            hazeOff = wrap(hazeOff + 22 * s, HAZE_H);
            haze.tilePositionY = Math.round(hazeOff);
            haze.tilePositionX = Math.round(Math.sin(t * 2.3) * 2);
            for (let i = 0; i < embers.length; i++) {
                const e = embers[i], st = ember[i];
                st.y -= st.vy * s;
                if (st.y < -4) { st.y = H + 4; st.x0 = rand(0, W) | 0; }
                e.setPosition(Math.round(st.x0 + Math.sin(t * 1.3 + st.ph) * 6), Math.round(st.y));
            }
        }
    };
}

export default class BiomeLayers {
    constructor(scene) {
        this.scene = scene;
        this.sets = {};          // biome index -> { objs, update, alpha, target }
        this.pending = null;
        this.current = -1;
    }

    setBiome(i, fadeMs = 1500) {
        this.current = i;
        this.fadeMs = Math.max(1, fadeMs);
        for (const k in this.sets) if (+k !== i) this.sets[k].target = 0;
        if (!DEFS[i]) { this.pending = null; return; }
        if (this.sets[i]) { this.sets[i].target = 1; this.pending = null; return; }
        this.pending = { i, step: 0 };
        if (fadeMs <= 0) while (this.pending) this._build();   // instant switch: build everything now
    }

    update(dt, m = 1) {
        if (this.pending) this._build();
        const s = dt / 1000;
        for (const k in this.sets) {
            const set = this.sets[k];
            if (set.alpha !== set.target) {
                const step = dt / this.fadeMs;
                set.alpha = set.target > set.alpha ? Math.min(set.target, set.alpha + step) : Math.max(set.target, set.alpha - step);
                this._applyAlpha(set);
            }
            if (set.alpha > 0) set.update(s * m, dt);
        }
    }

    destroy() {
        for (const k in this.sets) for (const o of this.sets[k].objs) o.destroy();
        this.sets = {};
        this.pending = null;
    }

    _build() {
        const p = this.pending, def = DEFS[p.i];
        if (p.step < def.bake.length) { def.bake[p.step++](this.scene); return; }
        const set = def.make(this.scene);
        set.alpha = 0;
        set.target = p.i === this.current ? 1 : 0;
        this.sets[p.i] = set;
        this._applyAlpha(set);
        this.pending = null;
        if (this.fadeMs <= 1) { set.alpha = set.target; this._applyAlpha(set); }
    }

    _applyAlpha(set) {
        const a = set.alpha;
        for (const o of set.objs) o.setAlpha(a * (set.alphaOf ? set.alphaOf(o) : 1)).setVisible(a > 0);
    }
}
