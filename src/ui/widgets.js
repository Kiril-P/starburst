// STUB (owner: ui). Shared pixel-art UI widgets. Real implementation replaces this file; keep the API.
// Everything is positioned in native 640x360 coordinates, origin = centre unless stated.
import { pxText } from './text.js';

/** Nine-slice panel. variant: 'default' | 'active'. Returns a Phaser.GameObjects.Container with .w/.h */
export function createPanel(scene, x, y, w, h, opts = {}) {
    const c = scene.add.container(x, y);
    c.add(scene.add.rectangle(0, 0, w, h, 0x0a0d1f, 0.85).setStrokeStyle(1, 0x39e7ff));
    c.w = w; c.h = h;
    return c;
}

/** Clickable button. opts { w = 96, h = 20, icon?: textureKey, size = 8, disabled }. Methods: setLabel, setEnabled, setFocused */
export class Button extends Phaser.GameObjects.Container {
    constructor(scene, x, y, label, onClick, opts = {}) {
        super(scene, x, y);
        const w = opts.w ?? 96, h = opts.h ?? 20;
        this.bg = scene.add.rectangle(0, 0, w, h, 0x0a0d1f, 0.9).setStrokeStyle(1, 0x39e7ff);
        this.text = pxText(scene, 0, 0, label, { origin: [0.5, 0.5] });
        this.add([this.bg, this.text]);
        this.setSize(w, h).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.enabled !== false && onClick && onClick());
        this.onClick = onClick;
        scene.add.existing(this);
    }
    setLabel(s) { this.text.setText(s); return this; }
    setEnabled(b) { this.enabled = b; this.setAlpha(b ? 1 : 0.4); return this; }
    setFocused(b) { this.bg.setStrokeStyle(1, b ? 0xffffff : 0x39e7ff); return this; }
}

/** Keyboard/gamepad-style navigation over a list of Buttons: up/down (or left/right) moves focus, ENTER/SPACE activates. */
export class MenuNav {
    constructor(scene, buttons, opts = {}) {
        this.buttons = buttons; this.i = 0;
        const k = scene.input.keyboard;
        const move = (d) => { this.i = (this.i + d + buttons.length) % buttons.length; this.refresh(); };
        k.on(opts.horizontal ? 'keydown-LEFT' : 'keydown-UP', () => move(-1));
        k.on(opts.horizontal ? 'keydown-RIGHT' : 'keydown-DOWN', () => move(1));
        k.on('keydown-ENTER', () => buttons[this.i].onClick && buttons[this.i].onClick());
        k.on('keydown-SPACE', () => buttons[this.i].onClick && buttons[this.i].onClick());
        this.refresh();
    }
    refresh() { this.buttons.forEach((b, j) => b.setFocused(j === this.i)); }
}

/** Horizontal bar. opts { color = 0x39e7ff }. Methods: setValue(0..1) */
export function createBar(scene, x, y, w, h, opts = {}) {
    const c = scene.add.container(x, y);
    const back = scene.add.rectangle(0, 0, w, h, 0x0a0d1f).setStrokeStyle(1, 0x2b3459);
    const fill = scene.add.rectangle(-w / 2 + 1, 0, w - 2, h - 2, opts.color ?? 0x39e7ff).setOrigin(0, 0.5);
    c.add([back, fill]);
    c.setValue = (v) => { fill.width = Math.max(0, Math.round((w - 2) * Math.min(1, Math.max(0, v)))); return c; };
    return c;
}

/** Slider 0..1. opts { w = 100 }. Calls onChange(v). */
export function createSlider(scene, x, y, value, onChange, opts = {}) {
    const w = opts.w ?? 100;
    const c = scene.add.container(x, y);
    const bar = createBar(scene, 0, 0, w, 6).setValue(value);
    const knob = scene.add.rectangle(-w / 2 + value * w, 0, 4, 12, 0xffffff);
    const hit = scene.add.rectangle(0, 0, w + 8, 16, 0, 0).setInteractive({ useHandCursor: true });
    const set = (px) => { const v = Math.min(1, Math.max(0, (px - (x - w / 2)) / w)); bar.setValue(v); knob.x = -w / 2 + v * w; onChange(v); };
    hit.on('pointerdown', (p) => set(p.x)); hit.on('pointermove', (p) => p.isDown && set(p.x));
    c.add([bar, knob, hit]);
    return c;
}

/** On/off toggle. Calls onChange(bool). */
export function createToggle(scene, x, y, value, onChange) {
    const c = scene.add.container(x, y);
    const box = scene.add.rectangle(0, 0, 10, 10, 0x0a0d1f).setStrokeStyle(1, 0x39e7ff).setInteractive({ useHandCursor: true });
    const mark = scene.add.rectangle(0, 0, 6, 6, 0x39e7ff).setVisible(value);
    box.on('pointerdown', () => { value = !value; mark.setVisible(value); onChange(value); });
    c.add([box, mark]);
    return c;
}
