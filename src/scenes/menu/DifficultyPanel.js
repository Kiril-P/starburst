// DIFFICULTY overlay: EASY / NORMAL / HARD. LEFT/RIGHT previews (description + modifiers), ENTER/click confirms
// and saves save.difficulty.
import { DIFFICULTIES } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { Button, MenuNav } from '../../ui/widgets.js';
import { save } from '../../systems/Save.js';
import OverlayScene from './OverlayScene.js';
import { DIFFICULTY_INFO, MOD_LABELS } from './data.js';
import { text, setTextKeep } from './helpers.js';

const BTN_W = 84;

export default class DifficultyPanel extends OverlayScene {
    constructor() { super('MenuDifficulty', 'DIFFICULTY', [320, 204]); }

    build(b) {
        const current = Math.max(0, DIFFICULTIES.indexOf(save.difficulty));
        const gap = Math.floor((b.w - BTN_W * 3) / 2);
        this.buttons = DIFFICULTIES.map((id, i) => {
            const x = b.x + BTN_W / 2 + i * (BTN_W + gap);
            const btn = new Button(this, x, b.y + 12, DIFFICULTY_INFO[id].name, () => this.pick(i), { w: BTN_W, h: 22 });
            const orig = btn.setFocused.bind(btn);
            btn.setFocused = (f) => { orig(f); if (f) this.preview(i); return btn; };
            btn.on('pointerover', () => this.preview(i));
            this.root.add(btn);
            return btn;
        });
        // "selected" marker under the saved choice
        this.mark = this.add.graphics();
        this.root.add(this.mark);
        this.drawMark(current);

        this.desc = text(this, b.x + b.w / 2, b.y + 38, '', { size: 8, origin: [0.5, 0], color: PALETTE[6] });
        this.root.add(this.desc);
        this.modG = this.add.graphics();
        this.root.add(this.modG);
        this.modRows = MOD_LABELS.map(([label], i) => {
            const y = b.y + 58 + i * 16;
            const l = text(this, b.x + 8, y, label, { size: 8, color: PALETTE[5] });
            const v = text(this, b.x + b.w - 8, y, '', { font: 'TITLE', size: 8, origin: [1, 0], color: PALETTE.w });
            this.root.add([l, v]);
            return { l, v, y };
        });
        const foot = text(this, b.x + b.w / 2, b.y + b.h - 6, 'LEFT / RIGHT  CHOOSE     ENTER  CONFIRM', { size: 8, origin: [0.5, 1], color: PALETTE[4] });
        this.root.add(foot);
        this.nav = new MenuNav(this, this.buttons, { horizontal: true, initial: current });
        if (this.nav.i !== current) this.nav.focus?.(current, false);
        this.preview(current);
    }

    drawMark(i) {
        const g = this.mark, b = this.body;
        const gap = Math.floor((b.w - BTN_W * 3) / 2);
        const x = b.x + i * (BTN_W + gap), y = b.y + 25;
        const col = DIFFICULTY_INFO[DIFFICULTIES[i]].color;
        g.clear().fillStyle(col).fillRect(x + 8, y, BTN_W - 16, 1).fillRect(x + BTN_W / 2 - 1, y + 1, 3, 1);
    }

    preview(i) {
        if (this.shown === i || !this.modRows) return;
        this.shown = i;
        const info = DIFFICULTY_INFO[DIFFICULTIES[i]];
        setTextKeep(this.desc, info.desc);
        this.desc.setColor(info.css);
        const g = this.modG, b = this.body;
        g.clear();
        MOD_LABELS.forEach(([, get], r) => {
            const v = Math.round(get(info.mods) * 10) / 10, row = this.modRows[r];
            setTextKeep(row.v, `x${v.toFixed(1)}`);
            const harder = v > 1, easier = v < 1;
            row.v.setColor(harder ? PALETTE.R : easier ? PALETTE.L : PALETTE.w);
            // pip gauge 0.5..1.5 -> 10 pips, centre pip = x1.0
            const pips = Math.round((v - 0.5) * 10);
            const gx = b.x + 108, gy = row.y + 2;
            for (let p = 0; p < 10; p++) {
                g.fillStyle(p < pips ? (harder ? COLORS.R : easier ? COLORS.L : COLORS.C) : COLORS[1]).fillRect(gx + p * 9, gy, 7, 4);
            }
            g.fillStyle(COLORS[4]).fillRect(gx + 5 * 9 - 2, gy - 2, 1, 8);
        });
    }

    pick(i) {
        save.difficulty = DIFFICULTIES[i];
        this.drawMark(i);
        this.time.delayedCall(120, () => this.close());
    }
}
