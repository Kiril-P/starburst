// ACHIEVEMENTS overlay: every achievement in a two-column grid. Unlocked = its badge, white title and the
// unlock date; locked = the steel "?" medal and a dimmed title, but the goal text is always shown so players
// know what to chase. Data: systems/achievements.js.
import { COLORS, PALETTE } from '../../art/palette.js';
import { save } from '../../systems/Save.js';
import { ACHIEVEMENTS } from '../../systems/achievements.js';
import OverlayScene from './OverlayScene.js';
import { text, setTextKeep } from './helpers.js';

const ROW_H = 24, COLS = 2;

export default class AchievementsPanel extends OverlayScene {
    constructor() { super('MenuAchievements', 'ACHIEVEMENTS', [600, 336]); }

    build(b) {
        const have = save.achievements;
        const done = ACHIEVEMENTS.filter((a) => a.id in have).length;
        setTextKeep(this.hint, `${done}/${ACHIEVEMENTS.length} UNLOCKED   ESC BACK`);
        this.hint.setColor(done === ACHIEVEMENTS.length ? PALETTE.L : PALETTE.C);
        const g = this.add.graphics();
        this.root.add(g);
        const perCol = Math.ceil(ACHIEVEMENTS.length / COLS);
        const colW = Math.floor((b.w - 8) / COLS);
        ACHIEVEMENTS.forEach((a, i) => {
            const col = Math.floor(i / perCol), row = i % perCol;
            const x = b.x + col * (colW + 8), y = b.y + row * ROW_H;
            const on = a.id in have;
            // zebra rows keep the long list scannable; unlocked rows get a faint cyan tint
            if (row % 2 === 0 || on) g.fillStyle(on ? COLORS.n : COLORS[1], on ? 0.45 : 0.35).fillRect(x, y, colW, ROW_H - 2);
            if (on) g.fillStyle(COLORS.c).fillRect(x, y, 1, ROW_H - 2);
            const icon = this.add.image(x + 4, y + 3, on ? `ach_${a.id}` : 'ach_locked').setOrigin(0, 0);
            const title = text(this, x + 26, y + 3, a.title, { font: 'TITLE', size: 8, color: on ? PALETTE.w : PALETTE[4] });
            const desc = text(this, x + 26, y + 13, a.desc, { size: 8, color: on ? PALETTE.b : PALETTE[3] });
            this.root.add([icon, title, desc]);
            if (on) {
                const d = new Date(have[a.id]);
                const date = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                this.root.add(text(this, x + colW - 6, y + 3, date, { size: 8, origin: [1, 0], color: PALETTE.c }));
            }
        });
        this.input.keyboard.on('keydown-ENTER', () => this.close());
        this.input.keyboard.on('keydown-SPACE', () => this.close());
    }
}
