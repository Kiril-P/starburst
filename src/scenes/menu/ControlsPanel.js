// CONTROLS overlay (opened from SETTINGS): rebind the eight gameplay actions, two keys each. Saved immediately via
// systems/bindings.js. UP/DOWN/LEFT/RIGHT move between slots, ENTER/SPACE or a click starts listening for a key,
// then: any key binds it (taken from its old action if it was used), ESC cancels, BACKSPACE/DELETE clears the slot.
// Menus, gamepad and touch keep their fixed layout, so a bad binding can always be fixed from here.
import { COLORS, PALETTE } from '../../art/palette.js';
import { Button } from '../../ui/widgets.js';
import { sfx, uiSfx } from '../../systems/sfx.js';
import { ACTIONS, ACTION_LABEL, RESERVED, getBindings, bindKey, clearKey, resetBindings, keyName } from '../../systems/bindings.js';
import OverlayScene from './OverlayScene.js';
import { text, setTextKeep } from './helpers.js';

const ROW_H = 17;
const SLOT_W = 66, SLOT_H = 13;
const NAV = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'ok', Space: 'ok' };
const HINT = 'ENTER  REBIND     ARROWS  MOVE';

export default class ControlsPanel extends OverlayScene {
    constructor() { super('MenuControls', 'CONTROLS', [330, 276]); }

    build(b) {
        this.bindings = getBindings();
        this.capturing = null;     // { row, col } while waiting for a key
        this.captureFrame = -1;
        this.focus = { row: 0, col: 0 };
        this.colX = [b.x + 150, b.x + 150 + SLOT_W + 10];
        this.g = this.add.graphics();
        this.root.add(this.g);
        const head = (x, s) => this.root.add(text(this, x, b.y + 2, s, { size: 8, origin: [0.5, 0], color: PALETTE[4] }));
        head(this.colX[0] + SLOT_W / 2, 'KEY');
        head(this.colX[1] + SLOT_W / 2, 'ALT');
        this.rows = ACTIONS.map((a, i) => {
            const y = b.y + 22 + i * ROW_H;
            const label = text(this, b.x + 8, y, ACTION_LABEL[a], { size: 8, origin: [0, 0.5], color: PALETTE[5] });
            const vals = this.colX.map((x, col) => {
                const t = text(this, x + SLOT_W / 2, y, '', { size: 8, origin: [0.5, 0.5], color: PALETTE.C });
                const z = this.add.zone(x, y - SLOT_H / 2, SLOT_W, SLOT_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
                z.on('pointerover', () => { if (!this.capturing) this.setFocus(i, col); });
                z.on('pointerdown', () => { this.setFocus(i, col); this.startCapture(); });
                this.root.add([t, z]);
                return t;
            });
            this.root.add(label);
            return { action: a, y, label, vals };
        });
        const note = text(this, b.x + b.w / 2, b.y + 22 + ACTIONS.length * ROW_H + 4, 'GAMEPAD, TOUCH AND MENUS KEEP THEIR LAYOUT', { size: 8, origin: [0.5, 0.5], color: PALETTE[3] });
        this.root.add(note);
        const by = b.y + b.h - 10;
        this.status = text(this, b.x + b.w / 2, by - 24, HINT, { size: 8, origin: [0.5, 0.5], color: PALETTE[4] });
        this.reset = new Button(this, b.x + 64, by, 'DEFAULTS', () => this.resetAll(), { w: 112, h: 20 });
        this.back = new Button(this, b.x + b.w - 64, by, 'BACK', () => this.close(), { w: 112, h: 20 });
        this.reset.on('hover', () => this.setFocus(ACTIONS.length, 0));
        this.back.on('hover', () => this.setFocus(ACTIONS.length, 1));
        this.root.add([this.status, this.reset, this.back]);
        // raw listener: rebinding needs KeyboardEvent.code (OverlayScene.onKey only passes e.key)
        this.input.keyboard.on('keydown', this.onRaw, this);
        this.refresh();
        this.setFocus(0, 0);
    }

    refresh() {
        for (const r of this.rows) r.vals.forEach((t, col) => {
            const c = this.bindings[r.action][col];
            setTextKeep(t, keyName(c));
            t.setColor(c ? PALETTE.C : PALETTE[3]);
        });
    }

    setFocus(row, col) {
        this.focus = { row, col };
        const onButtons = row === ACTIONS.length;
        this.reset.setFocused(onButtons && col === 0);
        this.back.setFocused(onButtons && col === 1);
        this.rows.forEach((r, i) => r.label.setColor(i === row ? PALETTE.w : PALETTE[5]));
        this.draw();
    }

    /** slot frames: dim cyan, focused bright, listening amber (amber = "heads-up, waiting for you") */
    draw() {
        const g = this.g.clear(), b = this.body, { row, col } = this.focus;
        if (row < ACTIONS.length) {
            const y = this.rows[row].y;
            g.fillStyle(COLORS.n, 0.55).fillRect(b.x, y - 8, b.w, 16);
            g.fillStyle(COLORS.C).fillRect(b.x, y - 8, 2, 16);
        }
        this.rows.forEach((r, i) => this.colX.forEach((x, c) => {
            const hot = i === row && c === col;
            const listening = this.capturing && this.capturing.row === i && this.capturing.col === c;
            const y = r.y - (SLOT_H >> 1);
            g.fillStyle(COLORS.k, 0.8).fillRect(x, y, SLOT_W, SLOT_H);
            g.lineStyle(1, listening ? COLORS.A : hot ? COLORS.b : COLORS.c, 1).strokeRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1);
        }));
    }

    startCapture() {
        const { row, col } = this.focus;
        if (row >= ACTIONS.length) return;
        this.capturing = { row, col };
        const t = this.rows[row].vals[col];
        setTextKeep(t, 'PRESS KEY');
        t.setColor(PALETTE.A);
        this.say('ESC  CANCEL     BACKSPACE  CLEAR', PALETTE.A);
        uiSfx(this, 'select');
        this.draw();
    }

    endCapture(msg, color) {
        this.capturing = null;
        this.captureFrame = this.game.loop.frame;   // the same ESC must not also close the panel
        this.refresh();
        this.say(msg || HINT, color);
        this.draw();
    }

    say(s, color = PALETTE[4]) { setTextKeep(this.status, s); this.status.setColor(color); }

    onRaw(e) {
        if (e.repeat) return;
        if (this.capturing) { this.capture(e); return; }
        if (this.game.loop.frame === this.captureFrame) return;
        const k = NAV[e.code];
        if (!k) return;
        const n = ACTIONS.length + 1;
        let { row, col } = this.focus;
        if (k === 'up' || k === 'down') { row = (row + (k === 'up' ? n - 1 : 1)) % n; uiSfx(this, 'hover'); }
        else if (k === 'left' || k === 'right') { col = col ? 0 : 1; uiSfx(this, 'hover'); }
        else if (row === ACTIONS.length) { (col ? this.back : this.reset).activate(); return; }
        else { this.startCapture(); return; }
        this.setFocus(row, col);
    }

    capture(e) {
        const { row, col } = this.capturing;
        const action = ACTIONS[row];
        if (e.virtualAction) { if (e.virtualAction === 'back') this.endCapture(); return; }   // pads can't bind keys
        if (e.code === 'Escape') { this.endCapture(); return; }
        if (e.code === 'Backspace' || e.code === 'Delete') {
            this.bindings = clearKey(action, col);
            this.endCapture(`${ACTION_LABEL[action]} ${col ? 'ALT ' : ''}CLEARED`, PALETTE[5]);
            return;
        }
        if (RESERVED.has(e.code) || !e.code) { this.say(`${keyName(e.code)} IS RESERVED`, PALETTE.R); return; }
        const was = ACTIONS.find((a) => a !== action && this.bindings[a].includes(e.code));
        this.bindings = bindKey(action, col, e.code);
        sfx(this, 'button-sound', { vol: 0.5 });
        // a key does one thing: say where it was taken from so an emptied action doesn't go unnoticed
        this.endCapture(was ? `${keyName(e.code)} MOVED FROM ${ACTION_LABEL[was]}` : null, was ? PALETTE.A : undefined);
    }

    resetAll() {
        resetBindings();
        this.bindings = getBindings();
        this.refresh();
        this.say('DEFAULT KEYS RESTORED', PALETTE.L);
    }

    close() {
        if (this.capturing || this.game.loop.frame === this.captureFrame) return;
        this.input.keyboard.off('keydown', this.onRaw, this);
        super.close();
    }
}
