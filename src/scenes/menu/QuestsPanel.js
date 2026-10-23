// QUESTS overlay: the quest list with progress bars. Data comes from systems/quests.js (evaluated from Save).
import { COLORS, PALETTE } from '../../art/palette.js';
import { createBar, Button } from '../../ui/widgets.js';
import { save } from '../../systems/Save.js';
import { evaluateQuests } from '../../systems/quests.js';
import OverlayScene from './OverlayScene.js';
import { text, fmt, setTextKeep } from './helpers.js';

const ROW_H = 24;

export default class QuestsPanel extends OverlayScene {
    constructor() { super('MenuQuests', 'QUESTS', [360, 236]); }

    build(b) {
        const quests = evaluateQuests(save);
        const done = quests.filter((q) => q.done).length;
        const fresh = new Set(this.data0.fresh ?? []);
        setTextKeep(this.hint, `${done}/${quests.length} COMPLETE`);
        this.hint.setColor(done === quests.length ? PALETTE.L : PALETTE.C);

        const g = this.add.graphics();
        this.root.add(g);
        this.blinkers = [];
        quests.forEach((q, i) => {
            const y = b.y + 4 + i * ROW_H;
            // alternating row tint keeps long lists scannable
            if (i % 2 === 0) g.fillStyle(COLORS.n, 0.3).fillRect(b.x, y - 2, b.w, ROW_H - 2);
            const icon = this.add.image(b.x + 4, y + 2, q.done ? 'icon_quest_done' : 'icon_quest').setOrigin(0, 0);
            const title = text(this, b.x + 26, y + 2, q.title.toUpperCase(), { size: 8, color: q.done ? PALETTE.j : PALETTE[6] });
            const sub = q.done ? 'COMPLETE' : `${fmt(q.value)} / ${fmt(q.target)}`;
            const subT = text(this, b.x + 26, y + 11, sub, { size: 8, color: q.done ? PALETTE.l : PALETTE[4] });
            this.root.add([icon, title, subT]);
            const barW = 72, bx = b.x + b.w - barW / 2 - 6;
            const bar = createBar(this, bx, y + 9, barW, 6, { color: q.done ? COLORS.L : COLORS.C }).setValue(q.progress);
            const pctT = text(this, bx - barW / 2 - 6, y + 9, q.done ? 'DONE' : `${Math.floor(q.progress * 100)}%`, { size: 8, origin: [1, 0.5], color: q.done ? PALETTE.L : PALETTE[5] });
            this.root.add([bar, pctT]);
            if (fresh.has(q.id)) {
                const tag = text(this, title.x + title.width + 6, y + 2, 'NEW!', { size: 8, color: PALETTE.A });
                this.root.add(tag);
                this.blinkers.push(tag);
            }
        });
        const back = new Button(this, b.x + b.w / 2, b.y + b.h - 10, 'BACK', () => this.close(), { w: 80, h: 20 });
        back.setFocused(true);
        this.root.add(back);
        this.input.keyboard.on('keydown-ENTER', () => this.close());
        this.input.keyboard.on('keydown-SPACE', () => this.close());
    }

    update(t) {
        const on = Math.floor(t / 300) % 2 === 0;
        for (const b of this.blinkers ?? []) b.setVisible(on);
    }
}
