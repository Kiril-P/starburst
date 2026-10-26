// Victory screen after THE STARBURST (wave 20). Launched by BossDirector.victory() on top of the paused Game scene
// with data { score, wave, stats, game }: "SECTOR CLEARED / YOU WIN" title wipe, run stats, a short credits roll and
// pixel fireworks. CONTINUE resumes the same run in endless mode (BossDirector.continueEndless); MAIN MENU ends the
// run here (recorded like a game over) and returns to the title.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { Button, MenuNav, TEXT, nine, uiTween, uiDelay } from '../ui/widgets.js';
import { pxText, centerText, fmtNum } from '../ui/text.js';
import { save } from '../systems/Save.js';
import { sfx } from '../systems/sfx.js';
import { playMusic, playSting } from '../systems/music.js';
import { submitRun } from '../systems/telemetry.js';

const PW = 232, PX = 40, PY = 112, ROW = 17;
const ROLL = { x: 470, top: 112, bottom: 262, speed: 22 };      // credits column (px/s)
const CREDITS = [
    ['STARBURST', TEXT.cyanHi], ['BULLET HELL MAYHEM', TEXT.dim], '',
    ['A GAME BY', TEXT.muted], ['KIRIL PETROVSKI', TEXT.white], '',
    ['MADE FOR', TEXT.muted], ['BULLET HELL JAM 6', TEXT.white], '',
    ['BUILT WITH', TEXT.muted], ['PHASER 3  +  VITE', TEXT.white], '',
    ['BOSSES', TEXT.muted], ['LANCER  GYRE  BASTION  MANTA', TEXT.dim], ['WARDEN  HIVE  PRISM', TEXT.dim], ['TEMPEST  COLOSSUS', TEXT.dim],
    ['THE STARBURST', TEXT.magenta], '', '',
    ['THANKS FOR PLAYING', TEXT.amber], '', ['THE VOID IS ENDLESS...', TEXT.dim]
];
const CYCLE_GAP = 60;    // px of empty space before the roll repeats

export default class Victory extends Phaser.Scene {
    constructor() { super('Victory'); }

    create(data = {}) {
        this.data0 = data;
        this.leaving = false;
        this.input.keyboard.enabled = true;
        this.input.enabled = true;
        this.add.rectangle(0, 0, W, H, COLORS.k, 0.78).setOrigin(0, 0).setDepth(DEPTH.OVERLAY - 2);
        this.buildTitle(data.wave ?? 20);
        this.buildStats(data);
        this.buildCredits();
        this.buildButtons();
        this.fireT = 300;
        playSting('sting-victory', { vol: 0.95 });
        sfx(this, 'level-up', { vol: 0.6 });
        uiDelay(this, 450, () => sfx(this, 'upgrade', { vol: 0.7 }));
    }

    buildTitle(wave) {
        const d = DEPTH.OVERLAY, sector = String(Math.ceil(wave / 5)).padStart(2, '0');
        const glow = this.add.image(W / 2, 66, 'glow_l').setDisplaySize(320, 60).setTint(COLORS.c).setBlendMode('ADD').setAlpha(0).setDepth(d);
        const top = centerText(pxText(this, 0, 0, `SECTOR ${sector} CLEARED`, { font: 'TITLE', color: TEXT.amber, spacing: 1 }), W / 2, 34).setDepth(d).setAlpha(0);
        const lines = this.add.graphics().setDepth(d).setAlpha(0);
        lines.fillStyle(COLORS.a, 1).fillRect(top.x - 66, 37, 56, 1).fillRect(top.x + top.width + 10, 37, 56, 1);
        const ghosts = [TEXT.cyan, TEXT.magenta].map((c) => centerText(pxText(this, 0, 0, 'YOU WIN', { size: 24, font: 'TITLE', color: c, shadow: null }), W / 2, 66).setDepth(d));
        const title = centerText(pxText(this, 0, 0, 'YOU WIN', { size: 24, font: 'TITLE', color: TEXT.white }), W / 2, 66).setDepth(d);
        const tw = Math.ceil(title.width), th = Math.ceil(title.height) + 2;
        [title, ...ghosts].forEach((t) => t.setCrop(0, 0, 0, th));
        const sub = centerText(pxText(this, 0, 0, 'THE HEART OF THE SECTOR IS DARK', { color: TEXT.dim, spacing: 1 }), W / 2, 90).setDepth(d).setAlpha(0);
        uiTween(this, { ms: 200, steps: 4, onUpdate: (v) => { top.setAlpha(v); lines.setAlpha(v); } });
        uiTween(this, {
            delay: 250, ms: 480, steps: 12, ease: 'linear', onUpdate: (v, k) => {
                const cw = Math.round(tw * v);
                title.setCrop(0, 0, cw, th);
                ghosts[0].setCrop(0, 0, Math.min(tw, cw + 6), th).x = title.x - (k < 1 ? 2 : 0);
                ghosts[1].setCrop(0, 0, Math.min(tw, cw + 12), th).x = title.x + (k < 1 ? 2 : 0);
            },
            onComplete: () => {
                ghosts.forEach((g) => g.setVisible(false));
                glow.setAlpha(0.45);
                this.cameras.main.shake(140, 0.004 * save.screenShake);
                uiTween(this, { ms: 240, steps: 4, onUpdate: (v) => sub.setAlpha(v) });
            }
        });
        this.titleGlow = glow;
    }

    buildStats({ score = 0, wave = 20, stats = {} }) {
        const rows = [
            ['SCORE', fmtNum(score), 16, TEXT.white], ['WAVE', String(wave), 8, TEXT.cyanHi], ['BOSSES DOWN', String(stats.bosses ?? 0), 8, TEXT.magenta],
            ['MAX COMBO', 'x' + (stats.maxCombo ?? 1), 8, TEXT.cyanHi], ['GRAZES', fmtNum(stats.graze ?? 0), 8, TEXT.cyanHi], ['KILLS', fmtNum(stats.kills ?? 0), 8, TEXT.cyanHi]
        ];
        const ph = 18 + 26 + (rows.length - 1) * ROW;
        const c = this.add.container(0, 0).setDepth(DEPTH.OVERLAY).setAlpha(0);
        c.add(nine(this, PX, PY - 8, 'ui_panel', PW, ph).setAlpha(0.92));
        const g = this.add.graphics();
        c.add(g);
        let y = PY;
        rows.forEach(([label, value, size, color], i) => {
            const rh = i === 0 ? 26 : ROW, cy = y + (rh >> 1);
            const l = pxText(this, PX + 14, 0, label, { color: TEXT.dim, spacing: 1 });
            const v = pxText(this, PX + PW - 14, 0, value, { size, font: 'TITLE', color, origin: [1, 0] });
            l.y = Math.round(cy - l.height / 2); v.y = Math.round(cy - v.height / 2);
            c.add([l, v]);
            y += rh;
            if (i < rows.length - 1) g.fillStyle(COLORS.n, 1).fillRect(PX + 12, y - 1, PW - 24, 1);
        });
        uiTween(this, { delay: 700, ms: 240, steps: 4, onUpdate: (v) => { c.setAlpha(v); c.y = Math.round(6 * (1 - v)); } });
    }

    buildCredits() {
        // lines scroll up in whole pixels and are simply hidden outside the window (no masks, no alpha ramps)
        this.roll = [];
        let y = 0;
        for (const ln of CREDITS) {
            if (ln) {
                const [str, color] = ln;
                const t = centerText(pxText(this, 0, 0, str, { color, spacing: 1 }), ROLL.x, 0).setDepth(DEPTH.OVERLAY);
                this.roll.push({ t, y });
            }
            y += 14;
        }
        this.rollH = y + CYCLE_GAP;
        this.rollY = ROLL.bottom - ROLL.top - 10;
        const frame = this.add.graphics().setDepth(DEPTH.OVERLAY);
        frame.fillStyle(COLORS.c, 1).fillRect(ROLL.x - 90, ROLL.top - 6, 180, 1).fillRect(ROLL.x - 90, ROLL.bottom + 4, 180, 1);
        frame.fillStyle(COLORS.C, 1).fillRect(ROLL.x - 90, ROLL.top - 6, 20, 1).fillRect(ROLL.x + 70, ROLL.bottom + 4, 20, 1);
        this.placeRoll();
    }

    placeRoll() {
        const base = Math.round(this.rollY);
        for (const r of this.roll) {
            let y = ROLL.top + ((((r.y + base) % this.rollH) + this.rollH) % this.rollH);
            r.t.y = y;
            r.t.setVisible(y >= ROLL.top && y + 8 <= ROLL.bottom);
        }
    }

    buildButtons() {
        const y = 300;
        const go = new Button(this, W / 2 - 88, y, 'CONTINUE', () => this.continueRun(), { w: 160, h: 22 });
        const menu = new Button(this, W / 2 + 88, y, 'MAIN MENU', () => this.toMenu(), { w: 160, h: 22 });
        const hint = centerText(pxText(this, 0, 0, 'CONTINUE  =  ENDLESS MODE, HARDER EVERY SECTOR', { color: TEXT.muted, spacing: 1 }), W / 2, y + 22);
        [go, menu, hint].forEach((o) => o.setDepth(DEPTH.OVERLAY).setAlpha(0));
        this.nav = new MenuNav(this, [go, menu], { horizontal: true });
        this.nav.setEnabled(false);
        uiTween(this, { delay: 1100, ms: 200, steps: 4, onUpdate: (v) => [go, menu, hint].forEach((o) => o.setAlpha(v)), onComplete: () => this.nav.setEnabled(true) });
    }

    continueRun() {
        if (this.leaving) return;
        this.leaving = true;
        const g = this.data0.game;
        this.scene.stop();
        g?.bosses?.continueEndless();
    }

    toMenu() {
        if (this.leaving) return;
        this.leaving = true;
        const d = this.data0;
        save.recordRun(Math.floor(d.score || 0), d.wave || 20);
        const log = d.game?.runlog;
        if (log && !log.done) submitRun(log.finish('win', { score: d.score, wave: d.wave || 20, stats: d.stats }));
        playMusic('title-music', { fadeIn: 900, fadeOut: 900 });
        this.cameras.main.fadeOut(220, 7, 11, 26);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop('Game');
            this.scene.start('MainMenu');
        });
    }

    /** pixel fireworks: cyan/amber/lime rings popping behind the text */
    firework() {
        const x = Phaser.Math.Between(40, W - 40), y = Phaser.Math.Between(24, 140);
        const tint = [COLORS.C, COLORS.A, COLORS.L, COLORS.b][Phaser.Math.Between(0, 3)];
        const s = this.add.sprite(x, y, 'shockwave').setTint(tint).setBlendMode('ADD').setDepth(DEPTH.OVERLAY - 1);
        if (this.anims.exists('shockwave')) { s.play('shockwave'); s.once('animationcomplete', () => s.destroy()); } else this.time.delayedCall(500, () => s.destroy());
        for (let i = 0; i < 10; i++) {
            const p = this.add.image(x, y, 'px2').setTint(tint).setBlendMode('ADD').setDepth(DEPTH.OVERLAY - 1);
            const a = (i / 10) * Math.PI * 2, r = Phaser.Math.Between(18, 34);
            this.tweens.add({ targets: p, x: Math.round(x + Math.cos(a) * r), y: Math.round(y + Math.sin(a) * r + 6), duration: 600, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
        }
    }

    update(t, dt) {
        this.rollY -= (ROLL.speed * Math.min(dt, 50)) / 1000;
        this.placeRoll();
        if ((this.fireT -= dt) <= 0) { this.fireT = 520 + Math.random() * 500; this.firework(); }
        this.titleGlow.setAlpha(this.titleGlow.alpha > 0 ? 0.35 + 0.1 * Math.sin(t / 300) : 0);
    }
}
