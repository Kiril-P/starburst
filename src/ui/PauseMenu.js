// Pause overlay. Game scene: `this.pause = new PauseMenu(this, { onResume, onQuit })`, `pause.show()`, `pause.hide()`,
// `pause.visible`. The Game scene owns ESC and physics/time pausing; this only draws UI and calls the callbacks.
// Don't use scene.pause() on the Game scene while this is open: a paused scene receives no input. Freezing physics,
// scene.time and tweens is fine, the menu animates on the game clock.
// QUIT TO MENU asks for a second press within 2s, so a stray ENTER can't throw a run away.
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { pxText, centerText } from './text.js';
import { createPanel, Button, MenuNav, TEXT, uiTween, uiDelay } from './widgets.js';

const PW = 192, PH = 124;

export default class PauseMenu {
    constructor(scene, { onResume, onQuit }) {
        this.scene = scene;
        this.onResume = onResume;
        this.onQuit = onQuit;
        this.visible = false;
        this.anims = [];

        this.dim = scene.add.rectangle(0, 0, W, H, COLORS.k, 0).setOrigin(0, 0).setDepth(DEPTH.MODAL).setScrollFactor(0).setInteractive();
        const root = (this.root = scene.add.container(0, 0).setDepth(DEPTH.MODAL + 1).setScrollFactor(0));
        const cy = H >> 1;
        root.add(createPanel(scene, W / 2, cy, PW, PH, { variant: 'active' }));
        root.add(centerText(pxText(scene, 0, 0, 'PAUSED', { size: 16, font: 'TITLE', color: TEXT.white }), W / 2, cy - 40));
        const rule = scene.add.graphics().fillStyle(COLORS.c, 1).fillRect(W / 2 - 56, cy - 28, 112, 1).fillStyle(COLORS.b, 1).fillRect(W / 2 - 1, cy - 29, 3, 3);
        root.add(rule);
        this.resumeBtn = new Button(scene, W / 2, cy - 6, 'RESUME', () => this.resume(), { w: 152, h: 22 });
        this.quitBtn = new Button(scene, W / 2, cy + 22, 'QUIT TO MENU', () => this.quit(), { w: 152, h: 22 });
        root.add([this.resumeBtn, this.quitBtn]);
        root.add(centerText(pxText(scene, 0, 0, 'ESC  RESUME', { color: TEXT.muted, spacing: 1 }), W / 2, cy + 46));
        this.setShown(false);
    }

    setShown(v) {
        this.dim.setVisible(v);
        this.root.setVisible(v);
        // hidden buttons must not catch clicks
        [this.resumeBtn, this.quitBtn].forEach((b) => (v ? b.setInteractive() : b.disableInteractive()));
        if (v) this.dim.setInteractive(); else this.dim.disableInteractive();
    }

    stopAnims() { this.anims.forEach((a) => a.stop()); this.anims.length = 0; }

    show() {
        if (this.visible) return;
        this.visible = true;
        this.stopAnims();
        this.armed = false;
        this.quitBtn.setLabel('QUIT TO MENU');
        this.setShown(true);
        this.nav = new MenuNav(this.scene, [this.resumeBtn, this.quitBtn]);
        // stepped fade + 6px drop-in
        this.anims.push(uiTween(this.scene, {
            ms: 140, steps: 4, onUpdate: (v) => {
                this.dim.setFillStyle(COLORS.k, 0.6 * v);
                this.root.y = Math.round(-6 * (1 - v));
                this.root.setAlpha(v);
            }
        }));
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;
        this.stopAnims();
        if (this.nav) { this.nav.destroy(); this.nav = null; }
        [this.resumeBtn, this.quitBtn].forEach((b) => { b.hovered = false; b.pressed = false; b.refresh(); });
        this.setShown(false);
    }

    resume() {
        if (!this.visible) return;
        this.hide();
        this.onResume && this.onResume();
    }

    quit() {
        if (!this.visible) return;
        if (!this.armed) {
            this.armed = true;
            this.quitBtn.setLabel('PRESS AGAIN');
            this.quitBtn.text.setColor(TEXT.amber);
            this.anims.push(uiDelay(this.scene, 2000, () => {
                this.armed = false;
                this.quitBtn.setLabel('QUIT TO MENU');
                this.quitBtn.refresh();
            }));
            return;
        }
        this.hide();
        this.onQuit && this.onQuit();
    }

    destroy() {
        this.stopAnims();
        if (this.nav) this.nav.destroy();
        this.root.destroy();
        this.dim.destroy();
    }
}
