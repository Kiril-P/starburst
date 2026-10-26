// RECORDS overlay: the top-10 boards. LEFT/RIGHT (or click a tab) switches LOCAL / DAILY (this device) and, in builds with an
// online API, WORLD / W.DAILY (everyone, loaded from the server). The daily boards only list today's seed. C changes the
// callsign shown on the world boards. data { mode, highlight (entry.at) } lets GameOver-style callers open a board with a
// run highlighted.
import { COLORS, PALETTE } from '../../art/palette.js';
import { topRuns, BOARD_SIZE, fetchWorld } from '../../systems/leaderboard.js';
import { dateKey } from '../../systems/rng.js';
import { uiSfx } from '../../systems/sfx.js';
import { save } from '../../systems/Save.js';
import { online } from '../../systems/net.js';
import OverlayScene from './OverlayScene.js';
import { SHIP_INFO } from './data.js';
import { text, fmt } from './helpers.js';
import { openSubPanel } from './accessRows.js';

const ROW_H = 17;
const TABS = [
    { id: 'normal', label: 'LOCAL', color: COLORS.C, note: () => 'TOP 10 / THIS DEVICE' },
    { id: 'daily', label: 'DAILY', color: COLORS.A, note: () => `SEED ${dateKey()}` },
    { id: 'world', label: 'WORLD', color: COLORS.L, note: () => 'TOP 10 / ALL TIME', world: true },
    { id: 'today', label: 'W.DAILY', color: COLORS.A, note: () => `SEED ${dateKey()}`, world: true }
];

export default class RecordsPanel extends OverlayScene {
    constructor() { super('MenuRecords', 'RECORDS', [420, 274]); }

    build(b) {
        this.b = b;
        this.tabDefs = TABS.filter((t) => !t.world || online());
        this.mode = this.tabDefs.some((t) => t.id === this.data0.mode) ? this.data0.mode : 'normal';
        let x = b.x + 4;
        this.tabs = this.tabDefs.map((d) => {
            const t = text(this, x, b.y, d.label, { font: 'TITLE', size: 8, color: PALETTE[4] });
            x += t.width + 18;
            t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.show(d.id));
            this.root.add(t);
            return t;
        });
        this.tabG = this.add.graphics();
        this.note = text(this, b.x + b.w - 4, b.y, '', { size: 8, origin: [1, 0], color: PALETTE[4] });
        this.list = this.add.container(0, 0);
        this.root.add([this.tabG, this.note, this.list]);
        if (online()) {
            this.sign = text(this, b.x + 4, b.y + b.h - 8, '', { size: 8, color: PALETTE[4] });
            this.sign.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.editCallsign());
            this.root.add(this.sign);
            this.refreshSign();
        }
        for (const k of ['LEFT', 'A']) this.input.keyboard.on(`keydown-${k}`, () => this.step(-1));
        for (const k of ['RIGHT', 'D']) this.input.keyboard.on(`keydown-${k}`, () => this.step(1));
        this.input.keyboard.on('keydown-ENTER', () => this.close());
        this.input.keyboard.on('keydown-SPACE', () => this.close());
        this.token = 0;
        this.show(this.mode, true);
    }

    onKey(key) { if (online() && key.toLowerCase() === 'c') this.editCallsign(); }

    refreshSign() { this.sign.setText(`CALLSIGN ${save.callsign || '---'}   [C] CHANGE`); }

    editCallsign() {
        openSubPanel(this, 'MenuCallsign');
        this.scene.get('MenuCallsign').events.once('shutdown', () => { this.refreshSign(); if (this.mode === 'world' || this.mode === 'today') this.show(this.mode, true); });
    }

    step(d) {
        const i = this.tabDefs.findIndex((t) => t.id === this.mode);
        this.show(this.tabDefs[(i + d + this.tabDefs.length) % this.tabDefs.length].id);
    }

    show(mode, silent) {
        const b = this.b;
        this.mode = mode;
        const ti = this.tabDefs.findIndex((t) => t.id === mode), def = this.tabDefs[ti], tab = this.tabs[ti];
        this.tabs.forEach((t, i) => t.setColor(i === ti ? PALETTE.w : PALETTE[4]));
        this.tabG.clear().fillStyle(COLORS.n).fillRect(b.x, b.y + 12, b.w, 1);
        this.tabG.fillStyle(def.color).fillRect(tab.x - 2, b.y + 11, tab.width + 4, 2);
        this.note.setText(def.note());
        this.note.x = Math.round(b.x + b.w - 4 - this.note.width);
        this.list.removeAll(true);
        if (!silent) uiSfx(this, 'hover');
        const y0 = b.y + 20;
        if (def.world) {
            this.centered(y0 + 70, 'LOADING...', 'REACHING THE WORLD BOARD');
            const token = ++this.token;
            fetchWorld(mode).then((rows) => {
                if (token !== this.token || !this.sys.isActive()) return;   // the player moved on to another tab
                this.list.removeAll(true);
                if (!rows) this.centered(y0 + 70, 'WORLD BOARD UNREACHABLE', 'CHECK YOUR CONNECTION AND TRY AGAIN');
                else this.rows(mode, rows, y0);
            });
            return;
        }
        this.token++;
        this.rows(mode, topRuns(mode), y0);
    }

    centered(y, big, small) {
        const b = this.b;
        this.list.add(text(this, b.x + b.w / 2, y, big, { font: 'TITLE', size: 8, origin: [0.5, 0], color: PALETTE[4] }));
        this.list.add(text(this, b.x + b.w / 2, y + 16, small, { size: 8, origin: [0.5, 0], color: PALETTE[3] }));
    }

    rows(mode, rows, y0) {
        const b = this.b, world = mode === 'world' || mode === 'today';
        const head = world ? [['#', 4], ['NAME', 28], ['SCORE', 76], ['WAVE', 172], ['SHIP', 222], ['DATE', 322]] : [['#', 4], ['SCORE', 28], ['WAVE', 160], ['SHIP', 214], ['DATE', 314]];
        head.forEach(([h, dx]) => this.list.add(text(this, b.x + dx, y0, h, { size: 8, color: PALETTE[3] })));
        if (!rows.length) {
            const daily = mode === 'daily' || mode === 'today';
            this.centered(y0 + 70, daily ? (world ? 'NOBODY HAS FLOWN TODAY' : 'NO DAILY RUN FLOWN TODAY') : 'NO RUNS YET', daily ? 'SAME SEED FOR EVERYONE, NEW ONE EVERY DAY' : (world ? 'BE THE FIRST ON THE BOARD' : 'FINISH A RUN TO SET A RECORD'));
        }
        const g = this.add.graphics();
        this.list.add(g);
        const mine = new Set(save.worldRuns);
        rows.slice(0, BOARD_SIZE).forEach((e, i) => {
            const y = y0 + 12 + i * ROW_H;
            const hot = world ? mine.has(e.id) : this.data0.highlight && e.at === this.data0.highlight;
            if (hot) g.fillStyle(COLORS.n, 0.8).fillRect(b.x, y - 3, b.w, ROW_H - 2);
            else if (i % 2 === 0) g.fillStyle(COLORS[1], 0.35).fillRect(b.x, y - 3, b.w, ROW_H - 2);
            const rankCol = i === 0 ? PALETTE.A : i < 3 ? PALETTE.z : PALETTE[5];
            const info = SHIP_INFO[e.ship] ?? SHIP_INFO.normal;
            const date = (e.date ?? '').slice(5).replace('-', '.');
            const cells = world
                ? [text(this, b.x + 28, y, e.name || '---', { font: 'TITLE', size: 8, color: PALETTE.C }),
                    text(this, b.x + 76, y, fmt(e.score), { font: 'TITLE', size: 8, color: hot ? PALETTE.b : PALETTE.w }),
                    text(this, b.x + 172, y, `${e.wave}${e.won ? '*' : ''}`, { font: 'TITLE', size: 8, color: e.won ? PALETTE.A : PALETTE[6] })]
                : [text(this, b.x + 28, y, fmt(e.score), { font: 'TITLE', size: 8, color: hot ? PALETTE.b : PALETTE.w }),
                    text(this, b.x + 160, y, String(e.wave), { font: 'TITLE', size: 8, color: PALETTE[6] })];
            this.list.add([
                text(this, b.x + 4, y, String(i + 1), { font: 'TITLE', size: 8, color: rankCol }),
                ...cells,
                text(this, b.x + (world ? 222 : 214), y, info.cls, { size: 8, color: info.accentCss }),
                text(this, b.x + (world ? 322 : 314), y, date, { size: 8, color: PALETTE[4] })
            ]);
        });
        if (world && rows.some((e) => e.won)) this.list.add(text(this, b.x + b.w - 4, b.y + b.h - 8, '* BEAT THE FINAL BOSS', { size: 8, origin: [1, 0], color: PALETTE[3] }));
    }
}
