// RECORDS overlay: the local top-10 leaderboards. LEFT/RIGHT (or click a tab) switches NORMAL / DAILY; the
// daily board only lists today's seed. data { mode, highlight (entry.at) } lets GameOver-style callers open
// a board with a run highlighted.
import { COLORS, PALETTE } from '../../art/palette.js';
import { MODES, topRuns, BOARD_SIZE } from '../../systems/leaderboard.js';
import { dateKey } from '../../systems/rng.js';
import { uiSfx } from '../../systems/sfx.js';
import OverlayScene from './OverlayScene.js';
import { SHIP_INFO } from './data.js';
import { text, fmt } from './helpers.js';

const ROW_H = 17;
const TAB = { normal: 'NORMAL', daily: 'DAILY' };

export default class RecordsPanel extends OverlayScene {
    constructor() { super('MenuRecords', 'RECORDS', [420, 260]); }

    build(b) {
        this.b = b;
        this.mode = MODES.includes(this.data0.mode) ? this.data0.mode : 'normal';
        this.tabs = MODES.map((m, i) => {
            const t = text(this, b.x + 4 + i * 84, b.y, TAB[m], { font: 'TITLE', size: 8, color: PALETTE[4] });
            t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.show(m));
            this.root.add(t);
            return t;
        });
        this.tabG = this.add.graphics();
        this.note = text(this, b.x + b.w - 4, b.y, '', { size: 8, origin: [1, 0], color: PALETTE[4] });
        this.list = this.add.container(0, 0);
        this.root.add([this.tabG, this.note, this.list]);
        for (const k of ['LEFT', 'A']) this.input.keyboard.on(`keydown-${k}`, () => this.show('normal'));
        for (const k of ['RIGHT', 'D']) this.input.keyboard.on(`keydown-${k}`, () => this.show('daily'));
        this.input.keyboard.on('keydown-ENTER', () => this.close());
        this.input.keyboard.on('keydown-SPACE', () => this.close());
        this.show(this.mode, true);
    }

    show(mode, silent) {
        const b = this.b;
        this.mode = mode;
        this.tabs.forEach((t, i) => t.setColor(MODES[i] === mode ? PALETTE.w : PALETTE[4]));
        const ti = MODES.indexOf(mode), tab = this.tabs[ti];
        this.tabG.clear().fillStyle(COLORS.n).fillRect(b.x, b.y + 12, b.w, 1);
        this.tabG.fillStyle(mode === 'daily' ? COLORS.A : COLORS.C).fillRect(tab.x - 2, b.y + 11, tab.width + 4, 2);
        this.note.setText(mode === 'daily' ? `SEED ${dateKey()}` : 'TOP 10 / ALL TIME');
        this.note.x = Math.round(b.x + b.w - 4 - this.note.width);
        this.list.removeAll(true);
        const rows = topRuns(mode);
        const y0 = b.y + 20;
        const head = [['#', 4], ['SCORE', 28], ['WAVE', 160], ['SHIP', 214], ['DATE', 314]];
        head.forEach(([h, dx]) => this.list.add(text(this, b.x + dx, y0, h, { size: 8, color: PALETTE[3] })));
        if (!rows.length) {
            this.list.add(text(this, b.x + b.w / 2, y0 + 70, mode === 'daily' ? 'NO DAILY RUN FLOWN TODAY' : 'NO RUNS YET', { font: 'TITLE', size: 8, origin: [0.5, 0], color: PALETTE[4] }));
            this.list.add(text(this, b.x + b.w / 2, y0 + 86, mode === 'daily' ? 'SAME SEED FOR EVERYONE, NEW ONE EVERY DAY' : 'FINISH A RUN TO SET A RECORD', { size: 8, origin: [0.5, 0], color: PALETTE[3] }));
        }
        const g = this.add.graphics();
        this.list.add(g);
        rows.slice(0, BOARD_SIZE).forEach((e, i) => {
            const y = y0 + 12 + i * ROW_H;
            const hot = this.data0.highlight && e.at === this.data0.highlight;
            if (hot) g.fillStyle(COLORS.n, 0.8).fillRect(b.x, y - 3, b.w, ROW_H - 2);
            else if (i % 2 === 0) g.fillStyle(COLORS[1], 0.35).fillRect(b.x, y - 3, b.w, ROW_H - 2);
            const rankCol = i === 0 ? PALETTE.A : i < 3 ? PALETTE.z : PALETTE[5];
            const info = SHIP_INFO[e.ship] ?? SHIP_INFO.normal;
            this.list.add([
                text(this, b.x + 4, y, String(i + 1), { font: 'TITLE', size: 8, color: rankCol }),
                text(this, b.x + 28, y, fmt(e.score), { font: 'TITLE', size: 8, color: hot ? PALETTE.b : PALETTE.w }),
                text(this, b.x + 160, y, String(e.wave), { font: 'TITLE', size: 8, color: PALETTE[6] }),
                text(this, b.x + 214, y, info.cls, { size: 8, color: info.accentCss }),
                text(this, b.x + 314, y, (e.date ?? '').slice(5).replace('-', '.'), { size: 8, color: PALETTE[4] })
            ]);
        });
        if (!silent) uiSfx(this, 'hover');
    }
}
