// "Entering sector" title card, shown when a wave starts a new sector (WaveManager.start). It sits under the HUD's
// WAVE banner (Banner.js uses the band around H*0.3) so both read as one stacked announcement:
//        WAVE 6 / SURVIVE 70S
//   ---- SECTOR 02 ----
//        ASTEROID FIELD
//        rocks inbound
// Stepped wipes only (no smooth fades on the text), animated on the game loop like the HUD banner so pause /
// hit-stop don't freeze it half-drawn. Text via pxText, colours from the palette / the sector's accent.
import { W, H, DEPTH } from '../config.js';
import { COLORS, PALETTE } from '../art/palette.js';
import { pxText, centerText } from '../ui/text.js';
import { uiTween, uiDelay } from '../ui/anim.js';

const Y = Math.round(H * 0.3) + 40;   // just below the WAVE banner band

export default class SectorBanner {
    constructor(scene) {
        this.scene = scene;
        this.c = scene.add.container(0, Y).setDepth(DEPTH.HUD + 4).setScrollFactor(0).setVisible(false);
        this.label = pxText(scene, 0, 0, '', { size: 8, font: 'TITLE', color: PALETTE.w });
        this.name = pxText(scene, 0, 0, '', { size: 16, font: 'TITLE', color: PALETTE.w });
        this.sub = pxText(scene, 0, 0, '', { size: 8, color: PALETTE[5], spacing: 2 });
        this.lineL = scene.add.rectangle(0, 4, 0, 1, COLORS.w).setOrigin(0, 0);
        this.lineR = scene.add.rectangle(0, 4, 0, 1, COLORS.w).setOrigin(0, 0);
        this.tickL = scene.add.rectangle(0, 2, 1, 5, COLORS.w).setOrigin(0, 0);
        this.tickR = scene.add.rectangle(0, 2, 1, 5, COLORS.w).setOrigin(0, 0);
        this.c.add([this.lineL, this.lineR, this.tickL, this.tickR, this.label, this.name, this.sub]);
        this.anims = [];
    }

    /** info: { name, sub, color } from sectors.js */
    show(wave, info, ms = 2800) {
        this.stop();
        const num = String(Math.floor((wave - 1) / 5) + 1).padStart(2, '0');
        const accent = parseInt(info.color.slice(1), 16);
        const { label, name, sub, lineL, lineR, tickL, tickR } = this;
        label.setText(`SECTOR ${num}`).setColor(info.color);
        name.setText(info.name);
        centerText(label, W / 2, 4);
        centerText(name, W / 2, 22);
        centerText(sub.setText(info.sub), W / 2, 38);
        sub.setText('');
        for (const r of [lineL, lineR, tickL, tickR]) r.setFillStyle(accent);
        const gap = Math.ceil(label.width / 2) + 8, span = Math.min(150, W / 2 - gap - 20);
        const nw = Math.ceil(name.width), nh = Math.ceil(name.height) + 2;
        name.setCrop(0, 0, 0, nh);
        this.c.setVisible(true).setAlpha(1);
        const push = (a) => (this.anims.push(a), a);

        // rules grow outward from the label, ticks ride their ends
        push(uiTween(this.scene, {
            delay: 250, ms: 260, steps: 8, onUpdate: (v) => {
                const w = Math.round(span * v);
                lineL.setPosition(W / 2 - gap - w, 4).setSize(w, 1);
                lineR.setPosition(W / 2 + gap, 4).setSize(w, 1);
                tickL.setPosition(W / 2 - gap - w, 2); tickR.setPosition(W / 2 + gap + w - 1, 2);
            }
        }));
        // name wipes in left -> right, sub types out
        push(uiTween(this.scene, { delay: 420, ms: 320, steps: 10, onUpdate: (v) => name.setCrop(0, 0, Math.round(nw * v), nh) }));
        push(uiTween(this.scene, {
            delay: 700, ms: Math.min(500, info.sub.length * 24), ease: 'linear',
            onUpdate: (v) => { const k = Math.round(info.sub.length * v); if (sub.text.length !== k) sub.setText(info.sub.slice(0, k)); }
        }));
        // out: a short stepped blink, then hide
        push(uiDelay(this.scene, ms, () => {
            push(uiTween(this.scene, {
                ms: 300, ease: 'linear', onUpdate: (v) => this.c.setVisible((((v * 6) | 0) & 1) === 0),
                onComplete: () => this.c.setVisible(false)
            }));
        }));
    }

    stop() { this.anims.forEach((a) => a.stop()); this.anims.length = 0; }

    destroy() { this.stop(); this.c.destroy(); }
}
