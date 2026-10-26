// CALLSIGN overlay: the 3-character arcade name shown on the world boards. Opened by GameOver the first time a run could
// reach the boards, and from RECORDS (C). Keyboard / gamepad: LEFT/RIGHT pick a slot, UP/DOWN cycle the character, letters and
// digits type directly, BACKSPACE steps back, ENTER / SPACE saves, ESC skips. Touch / mouse: the arrows above and below each
// slot, then OK. Saves to Save.callsign and emits 'done' (name) on the scene's events when it closes with a name.
import { PALETTE, COLORS } from '../../art/palette.js';
import { Button } from '../../ui/widgets.js';
import { uiSfx } from '../../systems/sfx.js';
import { save } from '../../systems/Save.js';
import OverlayScene from './OverlayScene.js';
import { text } from './helpers.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SLOT_W = 44;

export default class CallsignPanel extends OverlayScene {
    constructor() { super('MenuCallsign', 'CALLSIGN', [250, 176]); }

    build(b) {
        const start = (save.callsign || 'AAA').split('');
        this.idx = start.map((c) => Math.max(0, CHARS.indexOf(c)));
        this.slot = 0;
        this.saved = false;
        this.hint.setText('ESC  SKIP');
        const cx = b.x + b.w / 2, y = b.y + 38;
        this.cursor = this.add.graphics();
        this.root.add(this.cursor);
        this.letters = [0, 1, 2].map((i) => {
            const x = cx + (i - 1) * SLOT_W;
            const t = text(this, x, y, CHARS[this.idx[i]], { font: 'TITLE', size: 24, origin: [0.5, 0.5], color: PALETTE.w });
            const up = this.arrow(x, y - 28, -1, i), down = this.arrow(x, y + 28, 1, i);
            const hit = this.add.zone(x, y, SLOT_W - 6, 36).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => { this.slot = i; this.refresh(); uiSfx(this, 'hover'); });
            this.root.add([t, hit]);
            return t;
        });
        this.root.add(text(this, cx, b.y + 76, 'SHOWN ON THE WORLD BOARDS', { size: 8, origin: [0.5, 0], color: PALETTE[3] }));
        const ok = new Button(this, cx, b.y + b.h - 8, 'OK', () => this.confirm(), { w: 96, h: 20 });
        this.root.add(ok);
        this.refresh();
        const k = this.input.keyboard;
        k.off('keydown-BACKSPACE');   // OverlayScene would close on it; here it steps back one slot
        k.on('keydown-BACKSPACE', () => { if (this.slot > 0) { this.slot--; this.refresh(); uiSfx(this, 'back'); } });
        k.on('keydown-LEFT', () => this.move(-1));
        k.on('keydown-RIGHT', () => this.move(1));
        k.on('keydown-UP', () => this.cycle(this.slot, -1));
        k.on('keydown-DOWN', () => this.cycle(this.slot, 1));
        k.on('keydown-ENTER', () => this.confirm());
        k.on('keydown-SPACE', () => this.confirm());
    }

    /** a clickable pixel triangle above (dir -1) or below (dir 1) a slot */
    arrow(x, y, dir, slot) {
        const g = this.add.graphics();
        g.fillStyle(COLORS.C, 1);
        for (let r = 0; r < 4; r++) g.fillRect(x - (dir < 0 ? r : 3 - r), y - 2 + r, (dir < 0 ? r : 3 - r) * 2 + 1, 1);
        const hit = this.add.zone(x, y, 28, 18).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => { this.slot = slot; this.cycle(slot, dir); });
        this.root.add([g, hit]);
        return g;
    }

    /** letters / digits type into the current slot (called by OverlayScene's keydown hook) */
    onKey(key) {
        if (key.length !== 1) return;
        const c = key.toUpperCase();
        if (!CHARS.includes(c)) return;
        this.idx[this.slot] = CHARS.indexOf(c);
        this.slot = Math.min(2, this.slot + 1);
        this.refresh();
        uiSfx(this, 'hover');
    }

    move(d) { this.slot = (this.slot + d + 3) % 3; this.refresh(); uiSfx(this, 'hover'); }

    cycle(i, d) { this.idx[i] = (this.idx[i] + d + CHARS.length) % CHARS.length; this.refresh(); uiSfx(this, 'hover'); }

    refresh() {
        this.letters.forEach((t, i) => t.setText(CHARS[this.idx[i]]).setColor(i === this.slot ? PALETTE.A : PALETTE.w));
        const b = this.body, cx = b.x + b.w / 2, y = b.y + 38;
        const x = cx + (this.slot - 1) * SLOT_W;
        this.cursor.clear().fillStyle(COLORS.A, 1).fillRect(x - 14, y + 16, 28, 2);
    }

    confirm() {
        if (this.closing) return;
        const name = this.idx.map((i) => CHARS[i]).join('');
        save.callsign = name;
        this.saved = true;
        this.events.emit('done', name);
        this.close();
    }
}
