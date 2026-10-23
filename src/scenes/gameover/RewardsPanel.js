// GameOver's meta column (right of the stats panel): itemised credits that count into the bank, the run's
// leaderboard rank for its mode, and the badges of achievements unlocked this run. Built from settleRun()'s
// result. Animated on the game clock like the rest of GameOver; finish() jumps to the end state (skip).
import { W, DEPTH } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { nine, uiTween, uiDelay } from '../../ui/widgets.js';
import { pxText, fmtNum } from '../../ui/text.js';
import { sfx } from '../../systems/sfx.js';

const PW = 168, MAX_BADGES = 7;

export default class RewardsPanel {
    /** (x, y) top-left; res = settleRun() result; delay before it unfolds (ms) */
    constructor(scene, x, y, res, delay = 900) {
        this.scene = scene;
        this.res = res;
        this.anims = [];
        const c = (this.c = scene.add.container(0, 0).setDepth(DEPTH.OVERLAY));
        const lines = res.credits.lines.filter(([, v]) => v > 0);
        const ach = res.achievements;
        let h = 22 + lines.length * 11 + (res.credits.mult !== 1 ? 11 : 0) + 30 + (res.rank ? 22 : 0) + (ach.length ? 40 : 0);
        this.h = h;
        this.bg = nine(scene, x, y, 'ui_panel', PW, 16).setAlpha(0.92);
        c.add(this.bg);
        const body = (this.body = scene.add.container(0, 0).setVisible(false));
        c.add(body);
        const L = x + 10, R = x + PW - 10;
        let cy = y + 8;
        const add = (o) => { body.add(o); return o; };
        const right = (t) => { t.x = Math.round(R - t.width); return t; };
        add(pxText(scene, L, cy, res.mode === 'daily' ? `DAILY ${res.date ?? ''}` : 'REWARDS', { color: res.mode === 'daily' ? PALETTE.A : PALETTE.C, spacing: 1 }));
        add(scene.add.image(R - 16, cy - 3, 'icon_credit').setOrigin(0, 0));
        cy += 14;
        for (const [label, v] of lines) {
            add(pxText(scene, L, cy, label, { color: PALETTE[4] }));
            add(right(pxText(scene, 0, cy, `+${fmtNum(v)}`, { color: PALETTE[6] })));
            cy += 11;
        }
        if (res.credits.mult !== 1) {
            add(pxText(scene, L, cy, res.mode === 'daily' ? 'DAILY BONUS' : 'MULTIPLIER', { color: PALETTE[4] }));
            add(right(pxText(scene, 0, cy, `x${res.credits.mult.toFixed(2).replace(/0$/, '')}`, { color: PALETTE.z })));
            cy += 11;
        }
        const g = add(scene.add.graphics());
        g.fillStyle(COLORS.a).fillRect(L, cy + 1, PW - 20, 1);
        cy += 6;
        add(pxText(scene, L, cy + 1, 'CREDITS', { color: PALETTE.A }));
        this.total = add(pxText(scene, 0, cy, '+0', { font: 'TITLE', color: PALETTE.A }));
        this.totalR = R;
        right(this.total);
        cy += 12;
        this.bank = add(pxText(scene, L, cy, '', { color: PALETTE[3] }));
        this.setTotal(0);
        cy += 12;
        if (res.rank) {
            g.fillStyle(COLORS.n).fillRect(L, cy + 2, PW - 20, 1);
            cy += 7;
            add(pxText(scene, L, cy, `${res.mode === 'daily' ? 'DAILY' : 'LOCAL'} RANK`, { color: PALETTE[4] }));
            add(right(pxText(scene, 0, cy, `#${res.rank}`, { font: 'TITLE', color: res.rank === 1 ? PALETTE.A : PALETTE.b })));
            cy += 15;
        }
        this.badges = [];
        if (ach.length) {
            g.fillStyle(COLORS.n).fillRect(L, cy + 2, PW - 20, 1);
            cy += 7;
            add(pxText(scene, L, cy, ach.length === 1 ? 'ACHIEVEMENT' : `${ach.length} ACHIEVEMENTS`, { color: PALETTE.L }));
            cy += 11;
            ach.slice(0, MAX_BADGES).forEach((a, i) => {
                const b = add(scene.add.image(L + i * 21, cy, `ach_${a.id}`).setOrigin(0, 0).setVisible(false));
                this.badges.push(b);
            });
            if (ach.length > MAX_BADGES) add(pxText(scene, L + MAX_BADGES * 21, cy + 4, `+${ach.length - MAX_BADGES}`, { color: PALETTE.L }));
            this.achTitle = ach[0].title;
        }
        this.anims.push(uiTween(scene, {
            delay, ms: 200, steps: 6, onUpdate: (v) => this.bg.setSize(PW, Math.max(16, Math.round(h * v))),
            onComplete: () => this.countUp()
        }));
    }

    setTotal(n) {
        this.total.setText(`+${fmtNum(n)}`);
        this.total.x = Math.round(this.totalR - this.total.width);
        // the bank ticks up with the total so the player sees the credits land
        this.bank.setText(`BANK ${fmtNum(this.res.bank - this.res.credits.total + n)} CR`);
    }

    countUp() {
        const s = this.scene, tot = this.res.credits.total;
        this.body.setVisible(true);
        this.anims.push(uiTween(s, { ms: Math.min(1200, 300 + tot * 3), ease: 'out', onUpdate: (v) => this.setTotal(Math.round(tot * v)) }));
        if (tot > 0) sfx(s, 'pickup', { vol: 0.5 });
        this.badges.forEach((b, i) => this.anims.push(uiDelay(s, 400 + i * 160, () => { b.setVisible(true); sfx(s, 'level-up', { vol: 0.35, rate: 1 + i * 0.06 }); })));
    }

    /** skip: final state now */
    finish() {
        this.anims.forEach((a) => a.stop());
        this.anims = [];
        this.bg.setSize(PW, this.h);
        this.body.setVisible(true);
        this.setTotal(this.res.credits.total);
        this.badges.forEach((b) => b.setVisible(true));
    }
}

export const REWARDS_X = W - PW - 12;
