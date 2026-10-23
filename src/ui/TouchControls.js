// On-screen controls for touch devices, drawn by the SysOverlay scene above the Game scene and only while a run is
// live (hidden when paused / picking an upgrade, so taps reach those menus). Everything becomes virtual key presses.
//   left 45% of the screen: floating stick (touch anywhere, drag)   right side: FIRE (hold) + DASH / SHIELD / PHASE
//   top-centre: pause
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { pxText, centerText } from './text.js';
import { setVirtualKey, releaseSource, tapVirtualKey } from '../systems/virtualKeys.js';

const SRC = 'touch';
const STICK_R = 22, KNOB_R = 8, DEAD = 6;
const BUTTONS = [
    { id: 'fire', action: 'fire', x: W - 52, y: H - 62, r: 22, label: 'FIRE', color: COLORS.C, hold: true },
    { id: 'dash', action: 'dash', x: W - 108, y: H - 30, r: 14, icon: 'icon_dash', color: COLORS.b, ability: 'dash' },
    { id: 'shield', action: 'shield', x: W - 112, y: H - 78, r: 14, icon: 'icon_forcefield', color: COLORS.C, ability: 'forcefield' },
    { id: 'phase', action: 'phase', x: W - 70, y: H - 116, r: 14, icon: 'icon_phase', color: COLORS.M, ability: 'phase' },
    { id: 'pause', action: 'back', x: W / 2, y: 14, r: 10, label: 'II', color: COLORS[5] }
];

export function touchWanted() {
    if (new URLSearchParams(location.search).get('touch') === '1') return true;   // force on for testing
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
}

export default class TouchControls {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.stickId = null;
        this.btnPointers = new Map();   // pointer id -> button
        scene.input.addPointer(3);       // stick + fire + an ability at once
        this.g = scene.add.graphics().setDepth(DEPTH.MODAL + 50).setScrollFactor(0);
        this.labels = BUTTONS.map((b) => (b.icon
            ? scene.add.image(b.x, b.y, b.icon)
            : centerText(pxText(scene, 0, 0, b.label, { size: 8, color: '#dbe6ff' }), b.x, b.y)).setDepth(DEPTH.MODAL + 51));
        this.base = { x: 0, y: 0 }; this.knob = { x: 0, y: 0 };
        this.unlocked = {};
        scene.input.on('pointerdown', this.down, this);
        scene.input.on('pointermove', this.move, this);
        scene.input.on('pointerup', this.up, this);
        scene.input.on('pointerupoutside', this.up, this);
        this.setVisible(false);
    }

    setVisible(v) {
        if (v === this.visible) return;
        this.visible = v;
        this.g.setVisible(v);
        this.labels.forEach((t) => t.setVisible(v));
        if (!v) { releaseSource(SRC); this.stickId = null; this.btnPointers.clear(); }
        this.dirty = true;
    }

    /** abilities: { dash: bool, forcefield: bool, phase: bool } unlocked flags from the player */
    setUnlocked(levels) {
        let changed = false;
        for (const b of BUTTONS) if (b.ability) {
            const u = !!levels[b.ability];
            if (this.unlocked[b.id] !== u) { this.unlocked[b.id] = u; changed = true; }
        }
        if (changed) this.dirty = true;
    }

    down(p) {
        if (!this.visible) return;
        const x = p.x, y = p.y;
        for (const b of BUTTONS) {
            if ((x - b.x) ** 2 + (y - b.y) ** 2 > (b.r + 6) ** 2) continue;
            if (b.ability && !this.unlocked[b.id]) return;
            if (b.hold) { this.btnPointers.set(p.id, b); setVirtualKey(b.action, `${SRC}-${b.id}`, true); }
            else tapVirtualKey(b.action, `${SRC}-${b.id}`);
            this.pressed = b.id; this.dirty = true;
            return;
        }
        if (x < W * 0.45 && this.stickId === null) {
            this.stickId = p.id;
            this.base.x = this.knob.x = Math.round(x); this.base.y = this.knob.y = Math.round(y);
            this.dirty = true;
        }
    }

    move(p) {
        if (!this.visible || p.id !== this.stickId) return;
        let dx = p.x - this.base.x, dy = p.y - this.base.y;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        this.knob.x = Math.round(this.base.x + dx); this.knob.y = Math.round(this.base.y + dy);
        // 8-way: an axis counts once it carries ~40% of the deflection
        const on = d > DEAD, ax = Math.abs(dx) / (d || 1), ay = Math.abs(dy) / (d || 1);
        setVirtualKey('left', SRC, on && dx < 0 && ax > 0.38);
        setVirtualKey('right', SRC, on && dx > 0 && ax > 0.38);
        setVirtualKey('up', SRC, on && dy < 0 && ay > 0.38);
        setVirtualKey('down', SRC, on && dy > 0 && ay > 0.38);
        this.dirty = true;
    }

    up(p) {
        if (p.id === this.stickId) {
            this.stickId = null;
            for (const a of ['left', 'right', 'up', 'down']) setVirtualKey(a, SRC, false);
            this.dirty = true;
        }
        const b = this.btnPointers.get(p.id);
        if (b) { this.btnPointers.delete(p.id); setVirtualKey(b.action, `${SRC}-${b.id}`, false); }
        if (this.pressed) { this.pressed = null; this.dirty = true; }
    }

    /** redraw only when something changed (Graphics rebuilds its whole path on every draw) */
    update() {
        if (!this.visible || !this.dirty) return;
        this.dirty = false;
        const g = this.g.clear();
        if (this.stickId !== null) {
            g.lineStyle(1, COLORS.C, 0.6).strokeCircle(this.base.x, this.base.y, STICK_R);
            g.fillStyle(COLORS.n, 0.35).fillCircle(this.base.x, this.base.y, STICK_R);
            g.fillStyle(COLORS.C, 0.75).fillCircle(this.knob.x, this.knob.y, KNOB_R);
        }
        BUTTONS.forEach((b, i) => {
            const locked = b.ability && !this.unlocked[b.id];
            const hot = this.pressed === b.id || [...this.btnPointers.values()].includes(b);
            g.fillStyle(COLORS.k, hot ? 0.7 : 0.45).fillCircle(b.x, b.y, b.r);
            g.lineStyle(1, locked ? COLORS[3] : b.color, hot ? 1 : 0.7).strokeCircle(b.x, b.y, b.r);
            this.labels[i].setAlpha(locked ? 0.35 : hot ? 1 : 0.8);
        });
    }

    destroy() {
        releaseSource(SRC);
        const i = this.scene.input;
        i.off('pointerdown', this.down, this); i.off('pointermove', this.move, this);
        i.off('pointerup', this.up, this); i.off('pointerupoutside', this.up, this);
        this.g.destroy(); this.labels.forEach((t) => t.destroy());
    }
}
