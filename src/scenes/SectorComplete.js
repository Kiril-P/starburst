// Sector-complete recap, shown over the paused Game scene after each boss (launched by scenes/run/RunMeta.js).
// Brief on purpose: a title stamp, five stat rows that count up, then CONTINUE (any key / click, or it carries
// on by itself after AUTO_MS). data: { sector, boss, timeMs, score, kills, graze, maxCombo, hull, total, credits }
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS, PALETTE } from '../art/palette.js';
import { nine, uiTween, uiDelay } from '../ui/widgets.js';
import { pxText, centerText, fmtNum } from '../ui/text.js';
import { sfx } from '../systems/sfx.js';

const PW = 280, ROW = 15, AUTO_MS = 7000;
const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default class SectorComplete extends Phaser.Scene {
    constructor() { super('SectorComplete'); }

    create(d = {}) {
        this.closing = false;
        this.ready = false;
        this.anims = [];
        const rows = [
            ['SECTOR TIME', mmss(d.timeMs ?? 0), PALETTE.w],
            ['SCORE GAINED', '+' + fmtNum(d.score ?? 0), PALETTE.w],
            ['KILLS', fmtNum(d.kills ?? 0), PALETTE.b],
            ['GRAZES', fmtNum(d.graze ?? 0), PALETTE.b],
            ['HULL', `${d.hull ?? 0}%`, (d.hull ?? 0) <= 30 ? PALETTE.R : PALETTE.L],
            ['CREDITS SO FAR', fmtNum(d.credits ?? 0), PALETTE.A]
        ];
        const ph = 58 + rows.length * ROW + 30;
        const px = (W - PW) >> 1, py = Math.round((H - ph) / 2);
        this.dim = this.add.rectangle(0, 0, W, H, COLORS.k, 0).setOrigin(0).setDepth(DEPTH.OVERLAY);
        this.anims.push(uiTween(this, { ms: 200, steps: 4, onUpdate: (v) => this.dim.setFillStyle(COLORS.k, 0.55 * v) }));

        const root = (this.root = this.add.container(0, 0).setDepth(DEPTH.MODAL));
        const bg = nine(this, px, py, 'ui_panel_active', PW, 16).setAlpha(0.94);
        root.add(bg);
        const content = this.add.container(0, 0).setVisible(false);
        root.add(content);
        this.bg = bg; this.ph = ph; this.content = content;
        const sec = String(d.sector ?? 1).padStart(2, '0');
        const title = centerText(pxText(this, 0, 0, `SECTOR ${sec} CLEAR`, { font: 'TITLE', size: 16, color: PALETTE.C }), W / 2, py + 18);
        const sub = centerText(pxText(this, 0, 0, d.boss ? `${d.boss} NEUTRALISED` : 'BOSS NEUTRALISED', { color: PALETTE.A, spacing: 1 }), W / 2, py + 34);
        const g = this.add.graphics();
        g.fillStyle(COLORS.c).fillRect(px + 14, py + 44, PW - 28, 1);
        g.fillStyle(COLORS.C).fillRect(px + 14, py + 44, 24, 1).fillRect(px + PW - 38, py + 44, 24, 1);
        content.add([g, title, sub]);
        this.rows = rows.map(([label, value, col], i) => {
            const y = py + 52 + i * ROW;
            const l = pxText(this, px + 20, y, label, { color: PALETTE[5], spacing: 1 });
            const v = pxText(this, 0, y, value, { font: 'TITLE', color: col });
            v.x = px + PW - 20 - Math.ceil(v.width);
            l.setVisible(false); v.setVisible(false);
            content.add([l, v]);
            return [l, v];
        });
        // auto-continue meter + hint
        const my = py + ph - 22;
        this.hint = centerText(pxText(this, 0, 0, 'ENTER  CONTINUE', { color: PALETTE.b, spacing: 1 }), W / 2, my);
        this.meter = this.add.graphics();
        this.meterBox = { x: px + 40, y: my + 9, w: PW - 80 };
        content.add([this.hint, this.meter]);
        this.hint.setVisible(false);

        // unfold the frame, then stamp the rows in one by one
        this.anims.push(uiTween(this, {
            ms: 220, steps: 6, onUpdate: (v) => bg.setSize(PW, Math.max(16, Math.round(ph * v))),
            onComplete: () => {
                content.setVisible(true);
                sfx(this, 'wave-complete', { vol: 0.6, rate: 1.1 });
                this.rows.forEach((r, i) => this.anims.push(uiDelay(this, 120 + i * 90, () => {
                    r.forEach((o) => o.setVisible(true));
                    sfx(this, 'button-sound', { vol: 0.3, rate: 1.1 + i * 0.08 });
                })));
                this.anims.push(uiDelay(this, 160 + rows.length * 90, () => { this.ready = true; this.hint.setVisible(true); }));
            }
        }));
        this.t = 0;
        this.input.keyboard.enabled = true;
        this.input.enabled = true;
        this.input.keyboard.on('keydown', (e) => { if (!e.repeat) this.next(); });   // held fire auto-repeats: ignore
        this.input.on('pointerdown', () => this.next());
    }

    /** first press during the unfold just shows everything; afterwards it continues */
    next() {
        if (this.closing) return;
        if (!this.ready) {
            this.anims.forEach((a) => a.stop());
            this.bg.setSize(PW, this.ph);
            this.content.setVisible(true);
            this.rows.forEach((r) => r.forEach((o) => o.setVisible(true)));
            this.dim.setFillStyle(COLORS.k, 0.55);
            this.hint.setVisible(true);
            uiDelay(this, 150, () => { this.ready = true; });
            return;
        }
        this.close();
    }

    close() {
        if (this.closing) return;
        this.closing = true;
        sfx(this, 'button-sound', { vol: 0.5, rate: 1.3 });
        this.anims.push(uiTween(this, {
            ms: 160, steps: 4, ease: 'in', onUpdate: (v) => { this.root.setAlpha(1 - v); this.dim.setFillStyle(COLORS.k, 0.55 * (1 - v)); },
            onComplete: () => {
                const game = this.scene.get('Game');
                // keys pressed or released while the run was paused would otherwise stay stuck down
                game?.input?.keyboard?.resetKeys();
                this.scene.resume('Game');
                this.scene.stop();
            }
        }));
    }

    update(t, dt) {
        if (!this.ready || this.closing) return;
        this.t += dt;
        const k = Math.min(1, this.t / AUTO_MS);
        const { x, y, w } = this.meterBox;
        const fill = Math.round(w * (1 - k));
        this.meter.clear().fillStyle(COLORS.n).fillRect(x, y, w, 2).fillStyle(COLORS.C).fillRect(x, y, fill, 2);
        if (k >= 1) this.close();
    }
}
