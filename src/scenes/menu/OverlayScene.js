// Base for the menu's modal panels (Settings, Quests, Difficulty). Each runs as its own Scene launched on top of
// MainMenu, so it owns its keyboard/MenuNav while the title screen keeps animating underneath.
// Subclasses implement build(body) (adding their objects to this.root so they animate with the panel) and may
// override onKey(key).
import Phaser from 'phaser';
import { W, H, DEPTH } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { createPanel } from '../../ui/widgets.js';
import { sfx } from '../../systems/sfx.js';
import { text } from './helpers.js';

export default class OverlayScene extends Phaser.Scene {
    /** @param key scene key, @param title heading, @param size [w, h] of the panel */
    constructor(key, title, size) {
        super(key);
        this.title = title;
        this.size = size;
    }

    create(data = {}) {
        this.data0 = data;
        this.closing = false;
        const [w, h] = this.size;
        this.dim = this.add.rectangle(0, 0, W, H, COLORS.k, 0).setOrigin(0).setDepth(DEPTH.OVERLAY).setInteractive();
        this.dim.on('pointerdown', (p, lx, ly, e) => { if (!this.inside(p)) this.close(); });
        this.tweens.add({ targets: this.dim, fillAlpha: 0.6, duration: 160 });

        this.px = Math.round((W - w) / 2); this.py = Math.round((H - h) / 2);
        this.root = this.add.container(0, 0).setDepth(DEPTH.MODAL);
        const panel = createPanel(this, W / 2, H / 2, w, h, { variant: 'active' });
        this.root.add(panel);
        // header: title + rule, top-left inside the panel
        const head = text(this, this.px + 14, this.py + 12, this.title, { font: 'TITLE', size: 16, color: PALETTE.w });
        const rule = this.add.graphics();
        rule.fillStyle(COLORS.c).fillRect(this.px + 14, this.py + 33, w - 28, 1);
        rule.fillStyle(COLORS.C).fillRect(this.px + 14, this.py + 33, 24, 1);
        // top-right header note (subclasses may replace it, e.g. quest count)
        this.hint = text(this, this.px + w - 14, this.py + 18, 'ESC  BACK', { size: 8, origin: [1, 0], color: PALETTE[4] });
        this.root.add([head, rule, this.hint]);
        this.body = { x: this.px + 14, y: this.py + 42, w: w - 28, h: h - 56 };
        this.build(this.body);

        const k = this.input.keyboard;
        k.enabled = true;
        this.input.enabled = true;
        k.on('keydown-ESC', () => this.close());
        k.on('keydown-BACKSPACE', () => this.close());
        k.on('keydown', (e) => this.onKey && this.onKey(e.key));

        // pop in: rise 8px, in whole pixels
        const p = { v: 0 };
        this.root.setAlpha(0);
        this.tweens.add({
            targets: p, v: 1, duration: 180, ease: 'Cubic.easeOut',
            onUpdate: () => { this.root.setAlpha(p.v); this.root.y = Math.round((1 - p.v) * 8); }
        });
        sfx(this, 'button-sound', { vol: 0.5, rate: 1.15 });
    }

    inside(p) {
        const [w, h] = this.size;
        return p.x >= this.px && p.x < this.px + w && p.y >= this.py && p.y < this.py + h;
    }

    /** Override in subclasses: lay out content inside body {x, y, w, h}. */
    build(body) {}

    close() {
        if (this.closing) return;
        this.closing = true;
        sfx(this, 'button-sound', { vol: 0.4, rate: 0.9 });
        this.input.keyboard.enabled = false;
        this.input.enabled = false;
        const p = { v: 1 };
        this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 140 });
        this.tweens.add({
            targets: p, v: 0, duration: 140, ease: 'Cubic.easeIn',
            onUpdate: () => { this.root.setAlpha(p.v); this.root.y = Math.round((1 - p.v) * 6); },
            onComplete: () => this.scene.stop()
        });
    }
}
