// Shared pixel-art UI widgets, built on the nine-slice frames from src/art/sprites/ui.js (contract keys ui_*).
// Everything is positioned in native 640x360 coordinates with integer pixels; containers are centred on (x, y)
// unless stated. Nine-slice corners are 8px (see contract.js) so frames must be >= 16px in each direction.
//
// Usage:
//   const p = createPanel(scene, W / 2, 120, 200, 80, { variant: 'active', title: 'STATS' });
//   const b = new Button(scene, W / 2, 200, 'RETRY', () => retry(), { w: 112, icon: 'icon_star' });
//   const nav = new MenuNav(scene, [b, b2]);          // UP/DOWN (+W/S) move, ENTER/SPACE activate, mouse hover syncs focus
//   nav.destroy();                                    // remove key listeners when the screen goes away (scene shutdown does it too)
//   const bar = createBar(scene, 100, 50, 80, 8, { ramp: 'lime' }).setValue(0.5);
//   const s = createSlider(scene, x, y, save.musicVolume, (v) => (save.musicVolume = v), { w: 100, steps: 10 });
//   s.nudge(+1)  // keyboard step;  createToggle(scene, x, y, true, (on) => ..., { label: 'SCREEN SHAKE' })
//   const row = createLabelValueRow(scene, x, y, 160, 'SCORE', '0'); row.setValue(fmtNum(score));
//   const tip = new Tooltip(scene); tip.show('Dash through bullets', x, y); tip.hide();
//   uiTween(scene, { ms: 300, ease: 'out', onUpdate: (v) => ..., onComplete }) // runs on the game clock: ignores scene pause/timeScale
import Phaser from 'phaser';
import { pxText, centerText } from './text.js';
import { PALETTE, COLORS } from '../art/palette.js';
import { sfx } from '../systems/sfx.js';

export const SLICE = 8;

/** Named 4-step colour ramps for bars/tints: [dark, mid, bright, highlight] as 0xRRGGBB. */
export const RAMPS = {
    cyan: [COLORS.n, COLORS.c, COLORS.C, COLORS.b],
    magenta: [COLORS.p, COLORS.m, COLORS.M, COLORS.q],
    amber: [COLORS.y, COLORS.a, COLORS.A, COLORS.z],
    lime: [COLORS.g, COLORS.l, COLORS.L, COLORS.j],
    red: [COLORS.k, COLORS.r, COLORS.R, COLORS.z],
    violet: [COLORS.u, COLORS.v, COLORS.V, COLORS.x],
    steel: [COLORS[1], COLORS[3], COLORS[5], COLORS[6]]
};

/** Text colours (CSS hex strings for pxText). */
export const TEXT = {
    white: PALETTE.w, light: PALETTE[6], dim: PALETTE[5], muted: PALETTE[4], off: PALETTE[3],
    cyan: PALETTE.C, cyanHi: PALETTE.b, magenta: PALETTE.M, amber: PALETTE.A, lime: PALETTE.L, red: PALETTE.R
};

/** A nine-slice image with integer top-left at (x, y) (origin 0,0). */
export function nine(scene, x, y, key, w, h) {
    return scene.add.nineslice(Math.round(x), Math.round(y), key, undefined, w, h, SLICE, SLICE, SLICE, SLICE).setOrigin(0, 0);
}

// ---------------------------------------------------------------------------------------------------------------
// Game-clock animation. Phaser tweens/timers belong to a scene and stop when gameplay pauses its clock, so UI that
// lives on a paused Game scene (upgrade picks, pause menu) animates from the game loop's 'step' event instead.

/** Calls fn(dtMs) every game step until the returned function is called or the scene shuts down. */
export function onUiStep(scene, fn) {
    const ev = scene.game.events;
    const h = (t, dt) => fn(Math.min(dt, 50));
    const off = () => {
        ev.off('step', h);
        scene.events.off('shutdown', off);
    };
    ev.on('step', h);
    scene.events.once('shutdown', off);
    return off;
}

const EASE = {
    linear: (k) => k,
    out: (k) => 1 - (1 - k) ** 3,
    in: (k) => k * k * k,
    back: (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2
};

/**
 * opts { ms, delay = 0, from = 0, to = 1, ease = 'out' | fn, steps (quantise progress into N stepped frames),
 *        onUpdate(value, k), onComplete() }. Returns { stop() }.
 */
export function uiTween(scene, o) {
    const ease = typeof o.ease === 'function' ? o.ease : EASE[o.ease ?? 'out'];
    const from = o.from ?? 0, to = o.to ?? 1, ms = Math.max(1, o.ms ?? 300);
    let t = -(o.delay ?? 0);
    let done = false;
    const off = onUiStep(scene, (dt) => {
        t += dt;
        if (t < 0) return;
        let k = Math.min(1, t / ms);
        if (o.steps) k = Math.min(1, Math.ceil(k * o.steps) / o.steps);
        o.onUpdate && o.onUpdate(from + (to - from) * ease(k), k);
        if (t >= ms) finish(true);
    });
    const finish = (complete) => {
        if (done) return;
        done = true;
        off();
        if (complete && o.onComplete) o.onComplete();
    };
    return { stop: () => finish(false) };
}

/** delayedCall on the game clock. Returns { stop() }. */
export function uiDelay(scene, ms, fn) {
    return uiTween(scene, { ms, onComplete: fn });
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Nine-slice panel. variant: 'default' | 'active'. opts { alpha = 0.9, title, titleColor }.
 * Returns a Phaser.GameObjects.Container with .w/.h, .bg and setVariant(v).
 */
export function createPanel(scene, x, y, w, h, opts = {}) {
    const c = scene.add.container(Math.round(x), Math.round(y));
    const bg = nine(scene, -(w >> 1), -(h >> 1), opts.variant === 'active' ? 'ui_panel_active' : 'ui_panel', w, h);
    bg.setAlpha(opts.alpha ?? 0.9);
    c.add(bg);
    c.w = w; c.h = h; c.bg = bg;
    if (opts.title) {
        c.title = pxText(scene, -(w >> 1) + 8, -(h >> 1) + 6, opts.title, { color: opts.titleColor ?? TEXT.cyan });
        c.add(c.title);
    }
    c.setVariant = (v) => {
        bg.setTexture(v === 'active' ? 'ui_panel_active' : 'ui_panel');
        bg.setSlices(w, h, SLICE, SLICE, SLICE, SLICE);
        return c;
    };
    return c;
}

/**
 * Clickable button. opts { w = 96, h = 20, icon?: textureKey, size = 8, font = 'TITLE', disabled, color, hoverSfx = true }.
 * Methods: setLabel, setEnabled, setFocused, activate() (keyboard press: flashes the press frame then clicks).
 * Emits 'hover' (button) on pointer over so MenuNav can follow the mouse.
 */
export class Button extends Phaser.GameObjects.Container {
    constructor(scene, x, y, label, onClick, opts = {}) {
        super(scene, Math.round(x), Math.round(y));
        const w = opts.w ?? 96, h = opts.h ?? 20;
        this.w = w; this.h = h;
        this.opts = opts;
        this.onClick = onClick;
        this.enabled = !opts.disabled;
        this.focused = false;
        this.hovered = false;
        this.pressed = false;

        // the face (frame + label + icon) moves 1px for hover-lift / press-down; the focus ring stays put
        this.face = scene.add.container(0, 0);
        this.bg = nine(scene, -(w >> 1), -(h >> 1), 'ui_button', w, h);
        this.text = pxText(scene, 0, 0, label, { size: opts.size ?? 8, font: opts.font ?? 'TITLE' });
        this.face.add([this.bg, this.text]);
        if (opts.icon) {
            this.icon = scene.add.image(-(w >> 1) + 6, -8, opts.icon).setOrigin(0, 0);
            this.face.add(this.icon);
        }
        this.ring = scene.add.graphics();
        this.add([this.ring, this.face]);
        this.layoutLabel();

        this.setSize(w, h).setInteractive({ useHandCursor: true });
        this.on('pointerover', () => {
            this.hovered = true;
            if (this.enabled && opts.hoverSfx !== false) sfx(scene, 'button-sound', { vol: 0.25, rate: 1.5 });
            this.emit('hover', this);
            this.refresh();
        });
        this.on('pointerout', () => { this.hovered = false; this.pressed = false; this.refresh(); });
        this.on('pointerdown', () => { if (this.enabled) { this.pressed = true; this.refresh(); } });
        this.on('pointerup', () => {
            const was = this.pressed;
            this.pressed = false;
            this.refresh();
            if (was && this.enabled) this.click();
        });
        scene.add.existing(this);
        this.refresh();
    }

    layoutLabel() {
        // icon buttons: label centred in the space right of the icon
        const off = this.icon ? 8 : 0;
        centerText(this.text, off, 0);
    }

    click() {
        sfx(this.scene, 'button-sound', { vol: 0.8 });
        this.onClick && this.onClick(this);
    }

    /** Keyboard activation: show the press frame for a beat, then fire. */
    activate() {
        if (!this.enabled || this.pressed) return;
        this.pressed = true;
        this.refresh();
        uiDelay(this.scene, 70, () => {
            if (!this.scene) return; // destroyed meanwhile
            this.pressed = false;
            this.refresh();
            this.click();
        });
    }

    setLabel(s) { this.text.setText(s); this.layoutLabel(); return this; }
    setEnabled(b) { this.enabled = b; this.refresh(); return this; }
    setFocused(b) { this.focused = b; this.refresh(); return this; }

    refresh() {
        if (!this.scene) return this;
        const hot = this.enabled && (this.hovered || this.focused);
        const key = !this.enabled ? 'ui_button_disabled' : this.pressed ? 'ui_button_press' : hot ? 'ui_button_hover' : 'ui_button';
        if (this.bg.texture.key !== key) {
            this.bg.setTexture(key);
            this.bg.setSlices(this.w, this.h, SLICE, SLICE, SLICE, SLICE);
        }
        this.face.y = this.pressed ? 1 : hot ? -1 : 0;
        const col = !this.enabled ? TEXT.off : this.opts.color ?? (hot ? TEXT.white : TEXT.cyanHi);
        this.text.setColor(col);
        if (this.icon) this.icon.setAlpha(this.enabled ? 1 : 0.4);
        this.drawRing(this.focused && this.enabled);
        return this;
    }

    /** Focus ring: pixel corner brackets 2px outside the frame (fillRect only, so it stays crisp). */
    drawRing(on) {
        const g = this.ring;
        g.clear();
        if (!on) return;
        const x0 = -(this.w >> 1) - 3, y0 = -(this.h >> 1) - 3;
        const x1 = x0 + this.w + 5, y1 = y0 + this.h + 5; // inclusive far edge
        const L = 4;
        g.fillStyle(COLORS.b, 1);
        for (const [cx, sx] of [[x0, 1], [x1, -1]]) {
            for (const [cy, sy] of [[y0, 1], [y1, -1]]) {
                g.fillRect(sx > 0 ? cx : cx - L + 1, cy, L, 1);
                g.fillRect(cx, sy > 0 ? cy : cy - L + 1, 1, L);
            }
        }
    }
}

/**
 * Keyboard navigation over a list of Buttons: UP/DOWN (W/S) or with opts.horizontal LEFT/RIGHT (A/D) move focus,
 * ENTER/SPACE activate. Hovering a button with the mouse moves focus to it. Disabled buttons are skipped.
 * opts { horizontal, initial = 0, wrap = true, onChange(i, button) }. Methods: focus(i), setEnabled(b), destroy().
 */
export class MenuNav {
    constructor(scene, buttons, opts = {}) {
        this.scene = scene;
        this.buttons = buttons;
        this.opts = opts;
        this.enabled = true;
        this.i = Math.min(opts.initial ?? 0, buttons.length - 1);
        if (buttons[this.i] && !buttons[this.i].enabled) this.i = this.next(this.i, 1);
        const k = scene.input.keyboard;
        const [prev, next] = opts.horizontal ? [['LEFT', 'A'], ['RIGHT', 'D']] : [['UP', 'W'], ['DOWN', 'S']];
        this.handlers = [];
        const on = (keys, fn) => keys.forEach((key) => {
            const h = (e) => { if (this.enabled) fn(e); };
            k.on(`keydown-${key}`, h);
            this.handlers.push([`keydown-${key}`, h]);
        });
        on(prev, () => this.move(-1));
        on(next, () => this.move(1));
        on(['ENTER', 'SPACE'], () => { const b = this.buttons[this.i]; b && b.activate(); });
        this.hoverHandlers = buttons.map((b, j) => {
            const h = () => { if (this.enabled && b.enabled && j !== this.i) this.focus(j, false); };
            b.on('hover', h);
            return h;
        });
        this.refresh();
    }

    next(from, d) {
        const n = this.buttons.length;
        for (let s = 1; s <= n; s++) {
            let j = from + d * s;
            if (this.opts.wrap === false) { if (j < 0 || j >= n) return from; } else j = (j + n * s) % n;
            if (this.buttons[j].enabled) return j;
        }
        return from;
    }

    move(d) {
        const j = this.next(this.i, d);
        if (j !== this.i) this.focus(j, true);
    }

    focus(i, withSfx = true) {
        this.i = i;
        if (withSfx) sfx(this.scene, 'button-sound', { vol: 0.25, rate: 1.5 });
        this.refresh();
        this.opts.onChange && this.opts.onChange(i, this.buttons[i]);
    }

    setEnabled(b) { this.enabled = b; this.refresh(); return this; }

    refresh() { this.buttons.forEach((b, j) => b.setFocused(this.enabled && j === this.i)); }

    destroy() {
        const k = this.scene.input && this.scene.input.keyboard;
        if (k) this.handlers.forEach(([ev, h]) => k.off(ev, h));
        this.buttons.forEach((b, j) => b.off('hover', this.hoverHandlers[j]));
        this.handlers = [];
    }
}

const rampOf = (r) => (Array.isArray(r) ? r : RAMPS[r] ?? RAMPS.cyan);

/**
 * Horizontal bar: ui_bar_frame nine-slice with a pixel fill (highlight row on top, shade row at the bottom).
 * opts { ramp = 'cyan' | [4 colours], color (legacy: single fill colour), inset = 2 }.
 * Methods: setValue(0..1), setRamp(ramp). Container origin = centre.
 */
export function createBar(scene, x, y, w, h, opts = {}) {
    const c = scene.add.container(Math.round(x), Math.round(y));
    const frame = scene.add.nineslice(-(w >> 1), -(h >> 1), 'ui_bar_frame', undefined, w, h, SLICE, SLICE, 3, 3).setOrigin(0, 0);
    const g = scene.add.graphics();
    c.add([frame, g]);
    const inset = opts.inset ?? 2;
    const ix = -(w >> 1) + inset, iy = -(h >> 1) + 1, iw = w - inset * 2, ih = h - 2;
    let ramp = opts.color !== undefined ? [opts.color, opts.color, opts.color, opts.color] : rampOf(opts.ramp);
    let value = -1;
    const draw = () => {
        g.clear();
        const fw = Math.round(iw * value);
        if (fw <= 0) return;
        g.fillStyle(ramp[2], 1).fillRect(ix, iy, fw, ih);
        if (ih >= 3) {
            g.fillStyle(ramp[3], 1).fillRect(ix, iy, fw, 1);
            g.fillStyle(ramp[1], 1).fillRect(ix, iy + ih - 1, fw, 1);
        }
    };
    c.setValue = (v) => {
        v = Phaser.Math.Clamp(v, 0, 1);
        if (v !== value) { value = v; draw(); }
        return c;
    };
    c.setRamp = (r) => { ramp = rampOf(r); draw(); return c; };
    c.frame = frame;
    c.w = w; c.h = h;
    return c;
}

/**
 * Slider 0..1: bar + ui_knob, drag/click with the mouse. opts { w = 100, steps = 20, ramp }.
 * Calls onChange(v). Methods: setValue(v, silent), nudge(dir) for keyboard (one step), .value.
 */
export function createSlider(scene, x, y, value, onChange, opts = {}) {
    const w = opts.w ?? 100, steps = opts.steps ?? 20;
    const c = scene.add.container(Math.round(x), Math.round(y));
    const bar = createBar(scene, 0, 0, w, 8, { ramp: opts.ramp });
    const knob = scene.add.image(0, 0, 'ui_knob').setOrigin(0, 0);
    const hit = scene.add.zone(0, 0, w + 12, 18).setInteractive({ useHandCursor: true });
    c.add([bar, knob, hit]);
    const span = w - 8; // knob travel inside the frame end caps
    c.setValue = (v, silent) => {
        v = Math.round(Phaser.Math.Clamp(v, 0, 1) * steps) / steps;
        const changed = v !== c.value;
        c.value = v;
        bar.setValue(v);
        knob.setPosition(Math.round(-(w >> 1) + 4 + v * span - knob.width / 2), -(knob.height >> 1));
        if (changed && !silent && onChange) onChange(v);
        return c;
    };
    c.nudge = (d) => { c.setValue(c.value + d / steps); sfx(scene, 'button-sound', { vol: 0.25, rate: 1.2 + c.value * 0.6 }); return c; };
    const fromPointer = (p) => {
        const local = c.getWorldTransformMatrix().applyInverse(p.x, p.y);
        c.setValue((local.x + (w >> 1) - 4) / span);
    };
    let dragging = false;
    hit.on('pointerdown', (p) => { dragging = true; fromPointer(p); });
    hit.on('pointermove', (p) => { if (dragging && p.isDown) fromPointer(p); });
    scene.input.on('pointerup', () => {
        if (dragging) sfx(scene, 'button-sound', { vol: 0.4 });
        dragging = false;
    });
    c.value = -1;
    c.setValue(value, true);
    c.w = w;
    return c;
}

/**
 * On/off toggle (ui_check_off / ui_check_on). opts { label, color }: optional label to the right, clickable too.
 * Calls onChange(bool). Methods: setValue(b, silent), toggle(), .value. Container origin = the box centre.
 */
export function createToggle(scene, x, y, value, onChange, opts = {}) {
    const c = scene.add.container(Math.round(x), Math.round(y));
    const box = scene.add.image(-5, -5, value ? 'ui_check_on' : 'ui_check_off').setOrigin(0, 0);
    c.add(box);
    let hitW = 14;
    if (opts.label) {
        c.label = pxText(scene, 10, -4, opts.label, { color: opts.color ?? TEXT.light });
        c.add(c.label);
        hitW = 14 + 6 + c.label.width;
    }
    const hit = scene.add.zone(-7 + (hitW >> 1), 0, hitW, 14).setInteractive({ useHandCursor: true });
    c.add(hit);
    c.value = !!value;
    c.setValue = (b, silent) => {
        c.value = !!b;
        box.setTexture(c.value ? 'ui_check_on' : 'ui_check_off');
        if (!silent && onChange) onChange(c.value);
        return c;
    };
    c.toggle = () => { sfx(scene, 'button-sound', { vol: 0.6 }); return c.setValue(!c.value); };
    hit.on('pointerdown', () => c.toggle());
    return c;
}

/**
 * Left-aligned label + right-aligned value across width w (e.g. stats tables). Container origin = left/top.
 * opts { size = 8, labelColor, valueColor, valueFont = 'TITLE', divider (1px line under the row) }.
 * Methods: setValue(str), setValueColor(css).
 */
export function createLabelValueRow(scene, x, y, w, label, value, opts = {}) {
    const c = scene.add.container(Math.round(x), Math.round(y));
    const l = pxText(scene, 0, 0, label, { size: opts.labelSize ?? 8, color: opts.labelColor ?? TEXT.dim });
    const v = pxText(scene, w, 0, value, { size: opts.size ?? 8, font: opts.valueFont ?? 'TITLE', color: opts.valueColor ?? TEXT.white });
    c.add([l, v]);
    const placeV = () => { v.x = w - Math.ceil(v.width); };
    placeV();
    // vertically align the smaller label with the value's cap height
    l.y = Math.round((v.height - l.height) / 2);
    if (opts.divider) {
        const line = scene.add.rectangle(0, Math.ceil(v.height) + 3, w, 1, COLORS.n).setOrigin(0, 0);
        c.add(line);
    }
    c.label = l; c.valueText = v;
    c.setValue = (s) => { v.setText(String(s)); placeV(); return c; };
    c.setValueColor = (col) => { v.setColor(col); return c; };
    return c;
}

/** Small panel with text, clamped on screen. new Tooltip(scene, { depth }); show(text, x, y); hide(). */
export class Tooltip {
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.c = scene.add.container(0, 0).setDepth(opts.depth ?? 300).setVisible(false);
        this.bg = nine(scene, 0, 0, 'ui_panel', 16, 16).setAlpha(0.95);
        this.text = pxText(scene, 6, 5, '', { color: TEXT.light, align: 'left' });
        this.c.add([this.bg, this.text]);
    }

    /** (x, y) is the anchor point; the tip appears above it, centred, kept inside the screen. */
    show(str, x, y) {
        this.text.setText(str);
        const w = Math.max(16, Math.ceil(this.text.width) + 12), h = Math.max(16, Math.ceil(this.text.height) + 10);
        this.bg.setSize(w, h);
        const { width, height } = this.scene.scale;
        const px = Phaser.Math.Clamp(Math.round(x - w / 2), 2, width - w - 2);
        const py = Phaser.Math.Clamp(Math.round(y - h - 4), 2, height - h - 2);
        this.c.setPosition(px, py).setVisible(true);
        return this;
    }

    hide() { this.c.setVisible(false); return this; }
    destroy() { this.c.destroy(); }
}
