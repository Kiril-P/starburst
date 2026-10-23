// SETTINGS overlay: master / music / sfx volume, screen shake, flash effects, glow. Everything persists immediately via Save
// and music volume is applied live. Keyboard: UP/DOWN pick a row, LEFT/RIGHT adjust, ENTER/SPACE toggles.
import { COLORS, PALETTE } from '../../art/palette.js';
import { createSlider, createToggle, Button } from '../../ui/widgets.js';
import { save } from '../../systems/Save.js';
import { sfx, uiSfx, setMasterVolume } from '../../systems/sfx.js';
import OverlayScene from './OverlayScene.js';
import { setMusicVolume } from './music.js';
import { text, setTextKeep } from './helpers.js';

const STEP = 0.1;
const KEYMAP = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', Enter: 'ok', ' ': 'ok' };
const ROW_H = 22;
const pct = (v) => (v <= 0 ? 'OFF' : `${Math.round(v * 100)}%`);

// Row definitions: kind 'slider' (0..1) or 'toggle' (bool).
const ROWS = [
    { label: 'MASTER', kind: 'slider', get: () => save.masterVolume, set: (v, sc) => { setMasterVolume(sc, v); sc.previewSfx(); } },
    { label: 'MUSIC', kind: 'slider', get: () => save.musicVolume, set: (v, sc) => { save.musicVolume = v; setMusicVolume(sc, v); } },
    { label: 'SOUND FX', kind: 'slider', get: () => save.soundVolume, set: (v, sc) => { save.soundVolume = v; sc.previewSfx(); } },
    { label: 'SCREEN SHAKE', kind: 'slider', get: () => save.screenShake, set: (v) => { save.screenShake = v; } },
    { label: 'FLASH EFFECTS', kind: 'toggle', get: () => save.flashEffects, set: (v) => { save.flashEffects = v; } },
    { label: 'GLOW', kind: 'toggle', get: () => save.glow, set: (v) => { save.glow = v; } }
];

export default class SettingsPanel extends OverlayScene {
    constructor() { super('MenuSettings', 'SETTINGS', [300, 218]); }

    build(b) {
        this.rows = [];
        this.focus = 0;
        this.cursor = this.add.graphics();
        this.root.add(this.cursor);
        this.ctrlX = b.x + 132;
        this.sliderW = 96;
        ROWS.forEach((def, i) => {
            const y = b.y + 8 + i * ROW_H;
            const label = text(this, b.x + 8, y, def.label, { size: 8, origin: [0, 0.5], color: PALETTE[5] });
            const value = text(this, b.x + b.w - 8, y, '', { size: 8, origin: [1, 0.5], color: PALETTE.C });
            const hit = this.add.zone(b.x + b.w / 2, y, b.w, ROW_H).setInteractive();
            hit.on('pointerover', () => this.setFocus(i));
            this.root.add([label, value, hit]);
            const row = { def, y, label, value, ctrl: null };
            this.rows.push(row);
            this.buildControl(row);
        });
        const back = new Button(this, b.x + b.w / 2, b.y + b.h - 10, 'BACK', () => this.close(), { w: 80, h: 20 });
        this.root.add(back);
        this.back = back;
        this.setFocus(0);
    }

    /** Keyboard changes use the widget's setValue when it has one; otherwise the control is rebuilt at the new value. */
    buildControl(row) {
        if (row.ctrl) row.ctrl.destroy();
        const { def } = row;
        const v = def.get();
        if (def.kind === 'slider') {
            row.ctrl = createSlider(this, this.ctrlX + this.sliderW / 2, row.y, v, (nv) => this.change(row, Math.round(nv * 20) / 20, false), { w: this.sliderW });
        } else {
            row.ctrl = createToggle(this, this.ctrlX + 5, row.y, v, (nv) => this.change(row, nv, false));
        }
        this.root.add(row.ctrl);
        this.refreshValue(row);
    }

    refreshValue(row) {
        const v = row.def.get();
        setTextKeep(row.value, row.def.kind === 'slider' ? pct(v) : v ? 'ON' : 'OFF');
        row.value.setColor(row.def.kind === 'toggle' && !v ? PALETTE[3] : row.def.kind === 'slider' && v <= 0 ? PALETTE[3] : PALETTE.C);
    }

    change(row, v, fromKeyboard) {
        row.def.set(v, this);
        if (fromKeyboard) {
            if (row.ctrl.setValue) row.ctrl.setValue(v, true); else this.buildControl(row);
        }
        this.refreshValue(row);
    }

    previewSfx() {
        // throttle so dragging the slider doesn't machine-gun the click
        const now = this.time.now;
        if (now - (this.lastPreview ?? 0) < 120) return;
        this.lastPreview = now;
        sfx(this, 'button-sound');
    }

    setFocus(i) {
        this.focus = i;
        const onBack = i === this.rows.length;
        this.back.setFocused(onBack);
        const g = this.cursor;
        g.clear();
        this.rows.forEach((r, j) => r.label.setColor(j === i ? PALETTE.w : PALETTE[5]));
        if (onBack) return;
        const r = this.rows[i], b = this.body;
        // focus bar: dim fill + bright left notch
        g.fillStyle(COLORS.n, 0.55).fillRect(b.x, r.y - 9, b.w, 18);
        g.fillStyle(COLORS.C).fillRect(b.x, r.y - 9, 2, 18);
        g.fillStyle(COLORS.c).fillRect(b.x + 2, r.y - 9, 1, 18);
    }

    onKey(raw) {
        const key = KEYMAP[raw.length === 1 ? raw.toLowerCase() : raw];
        if (!key) return;
        const n = this.rows.length + 1;
        if (key === 'up' || key === 'down') {
            this.setFocus((this.focus + (key === 'up' ? n - 1 : 1)) % n);
            uiSfx(this, 'hover');
            return;
        }
        if (this.focus === this.rows.length) {
            if (key === 'ok') this.close();
            return;
        }
        const row = this.rows[this.focus], v = row.def.get();
        if (row.def.kind === 'slider') {
            const d = key === 'left' ? -STEP : key === 'right' ? STEP : 0;
            if (d) this.change(row, Math.round(Math.min(1, Math.max(0, v + d)) * 10) / 10, true);
        } else {
            this.change(row, !v, true);
            uiSfx(this, 'select');
        }
    }
}
