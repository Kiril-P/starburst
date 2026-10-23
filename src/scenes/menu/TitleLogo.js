// STARBURST wordmark with a lens-flare that twinkles on random spots of the letters.
import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';

// Flare spots relative to the logo's top-left (on letter tips/corners of the 224x40 wordmark), as fractions so a
// slightly different logo size still works.
const SPOTS = [[0.31, 0.12], [0.06, 0.2], [0.55, 0.15], [0.83, 0.8], [0.97, 0.12], [0.42, 0.85], [0.7, 0.1]];
const FLARE_FRAMES = [0, 1, 2, 3, 2, 1, 0];

export default class TitleLogo {
    constructor(scene, cx, cy) {
        this.scene = scene;
        this.logo = scene.add.image(0, 0, 'ui_logo').setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.w = this.logo.width; this.h = this.logo.height;
        this.x = Math.round(cx - this.w / 2); this.y = Math.round(cy - this.h / 2);
        this.logo.setPosition(this.x, this.y);

        // soft additive bloom behind the wordmark (dithered glow texture, stretched: allowed for glow_*)
        this.halo = scene.add.image(cx, cy, 'glow_l').setDepth(DEPTH.HUD - 1).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(COLORS.c).setAlpha(0.35).setDisplaySize(this.w + 64, this.h + 40);

        this.flareGlow = scene.add.image(0, 0, 'glow_m').setDepth(DEPTH.HUD + 1).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(COLORS.A).setVisible(false);
        this.flare = scene.add.sprite(0, 0, 'ui_logo_flare', 0).setOrigin(0, 0).setDepth(DEPTH.HUD + 2).setVisible(false);
        this.spot = 0;
        this.flareT = 0;          // ms into the current twinkle, <0 = waiting
        this.wait = 900;
        this.t = 0;
    }

    /** Fade/slide in (first appearance). */
    intro(delay = 0) {
        const s = this.scene;
        const y0 = this.y;
        this.logo.setAlpha(0); this.halo.setAlpha(0);
        const p = { v: 0 };
        s.tweens.add({
            targets: p, v: 1, delay, duration: 700, ease: 'Cubic.easeOut',
            onUpdate: () => {
                this.logo.setAlpha(p.v);
                this.logo.y = y0 - Math.round((1 - p.v) * 12);
                this.halo.setAlpha(p.v * 0.35);
            }
        });
    }

    twinkleAt(i) {
        const [fx, fy] = SPOTS[i % SPOTS.length];
        const fw = this.flare.width, fh = this.flare.height;
        const x = this.x + Math.round(this.w * fx), y = this.y + Math.round(this.h * fy);
        this.flare.setPosition(x - Math.floor(fw / 2), y - Math.floor(fh / 2)).setVisible(true);
        this.flareGlow.setPosition(x, y).setVisible(true);
        this.flareT = 0;
    }

    update(dt) {
        this.t += dt;
        // gentle halo breathing (it is a glow layer, alpha is fine there)
        if (this.logo.alpha >= 1) this.halo.setAlpha(0.28 + 0.08 * Math.sin(this.t / 700));
        if (this.flare.visible) {
            this.flareT += dt;
            const f = Math.floor(this.flareT / 70);
            if (f >= FLARE_FRAMES.length) {
                this.flare.setVisible(false); this.flareGlow.setVisible(false);
                this.wait = 1200 + Math.random() * 2200;
            } else {
                this.flare.setFrame(FLARE_FRAMES[f]);
                this.flareGlow.setAlpha([0.2, 0.45, 0.7, 0.9, 0.7, 0.45, 0.2][f]);
            }
        } else if (this.logo.alpha >= 1) {
            this.wait -= dt;
            if (this.wait <= 0) this.twinkleAt(this.spot++);
        }
    }

    setVisible(v) { [this.logo, this.halo].forEach((o) => o.setVisible(v)); if (!v) { this.flare.setVisible(false); this.flareGlow.setVisible(false); } }
}
