// Big centred announcement banner + small toasts for the HUD. Animated on the game clock (uiTween) so they keep
// playing while gameplay is paused or slowed down.
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { pxText, centerText } from './text.js';
import { TEXT, nine, uiTween, uiDelay } from './widgets.js';

const BAND_H = 46;

export class Banner {
    constructor(scene, y = Math.round(H * 0.3)) {
        this.scene = scene;
        this.y = y;
        const c = (this.c = scene.add.container(0, y).setDepth(DEPTH.HUD + 5).setScrollFactor(0).setVisible(false));
        this.band = scene.add.rectangle(0, -(BAND_H >> 1), W, BAND_H, COLORS.k, 0.7).setOrigin(0, 0);
        this.lineT = scene.add.rectangle(W / 2, -(BAND_H >> 1), 0, 1, COLORS.C).setOrigin(0, 0);
        this.lineB = scene.add.rectangle(W / 2, (BAND_H >> 1) - 1, 0, 1, COLORS.C).setOrigin(0, 0);
        // chromatic ghosts behind the title: they sit 1px apart during the wipe and snap together (a tiny glitch)
        this.ghostC = pxText(scene, 0, 0, '', { size: 24, font: 'TITLE', color: TEXT.cyan, shadow: null });
        this.ghostM = pxText(scene, 0, 0, '', { size: 24, font: 'TITLE', color: TEXT.magenta, shadow: null });
        this.title = pxText(scene, 0, 0, '', { size: 24, font: 'TITLE', color: TEXT.white });
        this.sub = pxText(scene, 0, 0, '', { size: 8, color: TEXT.cyan, spacing: 2 });
        c.add([this.band, this.lineT, this.lineB, this.ghostC, this.ghostM, this.title, this.sub]);
        this.anims = [];
    }

    stopAll() {
        this.anims.forEach((a) => a.stop());
        this.anims.length = 0;
    }

    show(title, sub = '', ms = 1800) {
        this.stopAll();
        const { title: t, sub: s, ghostC, ghostM, lineT, lineB, band } = this;
        const hasSub = !!sub;
        [t, ghostC, ghostM].forEach((o) => { o.setText(title); centerText(o, W / 2, hasSub ? -6 : 0); });
        centerText(s.setText(sub), W / 2, 12);
        s.setText('');
        const tw = Math.ceil(t.width), th = Math.ceil(t.height) + 2;
        this.c.setVisible(true);
        band.setAlpha(0).setVisible(true);
        lineT.setSize(0, 1); lineB.setSize(0, 1);
        t.setCrop(0, 0, 0, th); ghostC.setCrop(0, 0, 0, th); ghostM.setCrop(0, 0, 0, th);
        ghostC.setVisible(true); ghostM.setVisible(true);
        const lineW = Math.min(W - 40, tw + 120);
        const push = (a) => (this.anims.push(a), a);

        // 1) lines grow out from the centre and the band fades in (stepped)
        push(uiTween(this.scene, {
            ms: 220, steps: 8, onUpdate: (v) => {
                const lw = Math.round(lineW * v) & ~1;
                lineT.setPosition(W / 2 - lw / 2, -(BAND_H >> 1)).setSize(lw, 1);
                lineB.setPosition(W / 2 - lw / 2, (BAND_H >> 1) - 1).setSize(lw, 1);
                band.setAlpha(0.7 * v);
            }
        }));
        // 2) title wipes left -> right with the RGB ghosts leading by 1px
        push(uiTween(this.scene, {
            delay: 120, ms: 260, steps: 10, onUpdate: (v, k) => {
                const cw = Math.round(tw * v);
                t.setCrop(0, 0, cw, th);
                ghostC.setCrop(0, 0, Math.min(tw, cw + 4), th);
                ghostM.setCrop(0, 0, Math.min(tw, cw + 8), th);
                const off = k < 1 ? 1 : 0;
                ghostC.x = t.x - off; ghostM.x = t.x + off;
            },
            onComplete: () => { ghostC.setVisible(false); ghostM.setVisible(false); }
        }));
        // 3) subtitle types out
        if (hasSub) {
            push(uiTween(this.scene, {
                delay: 380, ms: Math.min(400, sub.length * 28), ease: 'linear',
                onUpdate: (v) => { const n = Math.round(sub.length * v); if (s.text.length !== n) s.setText(sub.slice(0, n)); }
            }));
        }
        // 4) out: title wipes away to the right, lines retract, band fades
        push(uiDelay(this.scene, Math.max(700, ms - 300), () => {
            push(uiTween(this.scene, {
                ms: 300, steps: 8, onUpdate: (v) => {
                    const cut = Math.round(tw * v);
                    t.setCrop(cut, 0, tw - cut, th);
                    s.setAlpha(v > 0.5 ? 0 : 1);
                    const lw = Math.round(lineW * (1 - v)) & ~1;
                    lineT.setPosition(W / 2 - lw / 2, -(BAND_H >> 1)).setSize(lw, 1);
                    lineB.setPosition(W / 2 - lw / 2, (BAND_H >> 1) - 1).setSize(lw, 1);
                    band.setAlpha(0.7 * (1 - v));
                },
                onComplete: () => { this.c.setVisible(false); s.setAlpha(1); }
            }));
        }));
    }

    setVisible(v) { if (!v) { this.stopAll(); this.c.setVisible(false); } }
    destroy() { this.stopAll(); this.c.destroy(); }
}

/** Small stacked notices under the top-centre of the screen. */
export class Toasts {
    constructor(scene, y = 40) {
        this.scene = scene;
        this.y = y;
        this.items = [];
        this.visible = true;
    }

    show(text, color = TEXT.white, ms = 1500) {
        const scene = this.scene;
        const label = pxText(scene, 0, 0, text, { color });
        const w = Math.max(24, Math.ceil(label.width) + 16), h = 16;
        const c = scene.add.container(Math.round(W / 2 - w / 2), this.y).setDepth(DEPTH.HUD + 4).setScrollFactor(0);
        const bg = nine(scene, 0, 0, 'ui_panel', w, h).setAlpha(0.85);
        label.setPosition(8, 4);
        c.add([bg, label]);
        c.setVisible(this.visible);
        const item = { c, anims: [] };
        this.items.unshift(item);
        if (this.items.length > 3) this.kill(this.items[this.items.length - 1]);
        this.layout();
        // slide in 4px in two steps, hold, then blink out
        c.y -= 4;
        item.anims.push(uiTween(scene, { ms: 80, steps: 2, onUpdate: (v) => { item.dy = Math.round(-4 * (1 - v)); this.layout(); } }));
        item.anims.push(uiDelay(scene, ms, () => {
            item.anims.push(uiTween(scene, {
                ms: 240, ease: 'linear', onUpdate: (v) => c.setVisible(this.visible && (((v * 6) | 0) & 1) === 0),
                onComplete: () => this.kill(item)
            }));
        }));
    }

    layout() {
        this.items.forEach((it, i) => { it.c.y = this.y + i * 18 + (it.dy || 0); });
    }

    kill(item) {
        item.anims.forEach((a) => a.stop());
        item.c.destroy();
        this.items = this.items.filter((i) => i !== item);
        this.layout();
    }

    setVisible(v) { this.visible = v; this.items.forEach((i) => i.c.setVisible(v)); }
    destroy() { [...this.items].forEach((i) => this.kill(i)); }
}
