// Game over (concept-art 06). Receives data: { score, wave, stats: { graze, maxCombo, kills } } (+ optional biome).
// Quick but dramatic: title wipe with RGB ghosts and a flare, stats panel unfolds, score counts up, NEW BEST RUN
// highlight when save.recordRun reports a record, RETRY / MAIN MENU via MenuNav. ENTER/SPACE during the count-up
// skips straight to the final numbers.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import Background from '../fx/Background.js';
import { Button, MenuNav, TEXT, nine, uiTween, uiDelay, onUiStep } from '../ui/widgets.js';
import { pxText, centerText, fmtNum } from '../ui/text.js';
import { save } from '../systems/Save.js';
import { sfx } from '../systems/sfx.js';
import { playMusic, duck } from '../systems/music.js';

const PW = 248, ROW = 17, ROW_BIG = 26, PX = (W - PW) >> 1, PY = 100;
const rowsH = (n) => ROW_BIG + (n - 1) * ROW;

export default class GameOver extends Phaser.Scene {
    constructor() { super('GameOver'); }

    create(data = {}) {
        const score = Math.max(0, Math.floor(data.score || 0));
        const wave = Math.max(1, data.wave || 1);
        const stats = data.stats || {};
        const best = save.recordRun(score, wave);
        this.newBest = (best.newBestScore && score > 0) || best.newBestWave;
        this.skipped = false;
        this.leaving = false;   // scene instances are reused: a previous visit's leave() must not lock the buttons
        this.anims = [];

        this.musicDuck();
        this.bg = new Background(this, { biome: data.biome ?? 0 });
        this.add.rectangle(0, 0, W, H, COLORS.k, 0.45).setOrigin(0, 0).setDepth(DEPTH.OVERLAY - 1);

        this.buildTitle(wave);
        const rows = [
            ['SCORE', score, (n) => fmtNum(n), 16],
            ['WAVE', wave, (n) => String(n), 8],
            ['MAX COMBO', stats.maxCombo ?? 1, (n) => 'x' + n, 8],
            ['GRAZES', stats.graze ?? 0, (n) => fmtNum(n), 8],
            ['KILLS', stats.kills ?? 0, (n) => fmtNum(n), 8]
        ];
        this.buildPanel(rows);
        this.buildButtons();

        this.input.keyboard.on('keydown', this.skip, this);
        this.input.on('pointerdown', this.skip, this);
    }

    /** Duck the gameplay music instead of cutting it: the run is over, the mood drops. */
    musicDuck() { duck('gameover', true, 900); }

    buildTitle(wave) {
        const y = 52;
        const depth = DEPTH.OVERLAY;
        const glow = this.add.image(W / 2, y + 12, 'glow_l').setDisplaySize(300, 56).setTint(COLORS.m).setBlendMode('ADD').setAlpha(0).setDepth(depth);
        const ghosts = [TEXT.cyan, TEXT.magenta].map((c) => centerText(pxText(this, 0, 0, 'GAME OVER', { size: 24, font: 'TITLE', color: c, shadow: null }), W / 2, y + 12).setDepth(depth));
        const title = centerText(pxText(this, 0, 0, 'GAME OVER', { size: 24, font: 'TITLE', color: TEXT.white }), W / 2, y + 12).setDepth(depth);
        const tw = Math.ceil(title.width), th = Math.ceil(title.height) + 2;
        [title, ...ghosts].forEach((t) => t.setCrop(0, 0, 0, th));
        // flare: a pixel cross that flashes in the middle of the title when the wipe lands
        const flare = this.add.graphics().setDepth(depth + 1).setBlendMode('ADD').setVisible(false);
        const fx = W / 2, fy = y + 11;
        flare.fillStyle(COLORS.A, 1).fillRect(fx, fy - 22, 1, 45).fillRect(fx - 40, fy, 81, 1);
        flare.fillStyle(COLORS.z, 1).fillRect(fx, fy - 8, 1, 17).fillRect(fx - 14, fy, 29, 1).fillRect(fx - 1, fy - 1, 3, 3);
        const sub = centerText(pxText(this, 0, 0, `RUN COMPLETE / SECTOR ${String(Math.floor((wave - 1) / 5) + 1).padStart(2, '0')}`, { color: TEXT.dim, spacing: 2 }), W / 2, y + 36).setDepth(depth).setAlpha(0);
        const lines = this.add.graphics().setDepth(depth).setAlpha(0);
        lines.fillStyle(COLORS.m, 1).fillRect(sub.x - 66, y + 36, 56, 1).fillRect(sub.x + sub.width + 10, y + 36, 56, 1);

        this.anims.push(uiTween(this, {
            ms: 420, steps: 12, ease: 'linear', onUpdate: (v, k) => {
                const cw = Math.round(tw * v);
                title.setCrop(0, 0, cw, th);
                ghosts[0].setCrop(0, 0, Math.min(tw, cw + 6), th).x = title.x - (k < 1 ? 2 : 0);
                ghosts[1].setCrop(0, 0, Math.min(tw, cw + 12), th).x = title.x + (k < 1 ? 2 : 0);
            },
            onComplete: () => {
                ghosts.forEach((g) => g.setVisible(false));
                flare.setVisible(true);
                glow.setAlpha(0.5);
                this.cameras.main.shake(120, 0.004 * save.screenShake);
                this.anims.push(uiTween(this, { ms: 500, steps: 5, onUpdate: (v) => { flare.setAlpha(1 - v * 0.75); glow.setAlpha(0.5 - v * 0.3); } }));
            }
        }));
        this.anims.push(uiTween(this, { delay: 380, ms: 200, steps: 4, onUpdate: (v) => { sub.setAlpha(v); lines.setAlpha(v); } }));
        this.titleParts = { title, ghosts, flare, glow, sub, lines };
    }

    buildPanel(rows) {
        const ph = (this.panelH = 14 + rowsH(rows.length) + (this.newBest ? 26 : 8));
        const depth = DEPTH.OVERLAY;
        const c = (this.panel = this.add.container(0, 0).setDepth(depth));
        const bg = nine(this, PX, PY, 'ui_panel', PW, 16).setAlpha(0.92);
        c.add(bg);
        const content = this.add.container(0, 0).setVisible(false);
        c.add(content);
        this.panelBg = bg; this.panelContent = content;
        const colX = PX + 104;
        const g = this.add.graphics();
        content.add(g);
        g.fillStyle(COLORS.n, 1).fillRect(colX - 8, PY + 9, 1, rowsH(rows.length) - 2);
        let y = PY + 8;
        this.counters = rows.map(([label, value, fmt, size], i) => {
            const rh = i === 0 ? ROW_BIG : ROW, cy = y + (rh >> 1);
            const l = pxText(this, PX + 14, 0, label, { color: TEXT.dim, spacing: 1 });
            const v = pxText(this, colX, 0, fmt(0), { size, font: 'TITLE', color: i === 0 ? TEXT.white : TEXT.cyanHi });
            l.y = Math.round(cy - l.height / 2);
            v.y = Math.round(cy - v.height / 2);
            y += rh;
            if (i < rows.length - 1) g.fillRect(PX + 12, y - 1, PW - 24, 1);
            content.add([l, v]);
            l.setAlpha(0); v.setAlpha(0);
            return { l, v, value, fmt, shown: 0 };
        });
        if (this.newBest) this.buildBest(content, PY + 12 + rowsH(rows.length));

        // unfold: frame grows downwards in steps, then rows pop in one by one and count up
        this.anims.push(uiTween(this, {
            delay: 300, ms: 200, steps: 6, onUpdate: (v) => bg.setSize(PW, Math.max(16, Math.round(ph * v))),
            onComplete: () => {
                content.setVisible(true);
                this.counters.forEach((r, i) => this.anims.push(uiDelay(this, i * 90, () => { r.l.setAlpha(1); r.v.setAlpha(1); sfx(this, 'button-sound', { vol: 0.3, rate: 1.2 + i * 0.1 }); })));
                this.counters.forEach((r, i) => this.anims.push(uiTween(this, {
                    delay: i * 90, ms: i === 0 ? 1100 : 500, ease: 'out',
                    onUpdate: (v) => this.setCounter(r, Math.round(r.value * v))
                })));
                if (this.newBest) this.anims.push(uiDelay(this, 1200, () => this.revealBest()));
            }
        }));
    }

    setCounter(r, n) {
        if (n === r.shown) return;
        r.shown = n;
        r.v.setText(r.fmt(n));
    }

    buildBest(content, y) {
        const w = PW - 28, h = 18, x = PX + 14;
        const g = this.add.graphics();
        // amber chamfered frame (2px stair-step corners), drawn with rects so it stays crisp
        g.fillStyle(COLORS.k, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle(COLORS.A, 1).fillRect(x + 2, y, w - 4, 1).fillRect(x + 2, y + h - 1, w - 4, 1).fillRect(x, y + 2, 1, h - 4).fillRect(x + w - 1, y + 2, 1, h - 4);
        g.fillRect(x + 1, y + 1, 1, 1).fillRect(x + w - 2, y + 1, 1, 1).fillRect(x + 1, y + h - 2, 1, 1).fillRect(x + w - 2, y + h - 2, 1, 1);
        g.fillStyle(COLORS.y, 1).fillRect(x + 2, y + 1, w - 4, 1);
        const star = this.add.image(x + 6, y + 1, 'icon_star').setOrigin(0, 0);
        const t = centerText(pxText(this, 0, 0, 'NEW BEST RUN!', { font: 'TITLE', color: TEXT.amber, spacing: 1 }), x + w / 2 + 6, y + h / 2);
        this.best = this.add.container(0, 0, [g, star, t]).setVisible(false);
        this.bestText = t;
        content.add(this.best);
    }

    revealBest() {
        if (!this.best || this.best.visible) return;
        this.best.setVisible(true);
        sfx(this, 'wave-complete', { vol: 0.7 });
        // blink in, then a slow white/amber shimmer on the text
        this.anims.push(uiTween(this, { ms: 300, ease: 'linear', onUpdate: (v) => this.best.setVisible((((v * 6) | 0) & 1) === 0 || v >= 1) }));
        let t = 0;
        onUiStep(this, (dt) => {
            t += dt;
            this.bestText.setColor(((t / 400) | 0) % 3 === 0 ? TEXT.white : TEXT.amber);
        });
    }

    buildButtons() {
        const y = PY + this.panelH + 18;
        const retry = new Button(this, W / 2, y, 'RETRY', () => this.leave('Game'), { w: 160, h: 22 });
        const menu = new Button(this, W / 2, y + 28, 'MAIN MENU', () => this.leave('MainMenu'), { w: 160, h: 22 });
        const best = save.highScore;
        const hint = centerText(pxText(this, 0, 0, `BEST ${fmtNum(best)}  /  WAVE ${save.highWave}`, { color: TEXT.muted, spacing: 1 }), W / 2, y + 52);
        this.buttons = [retry, menu];
        this.buttonY = y; this.hint = hint;
        [retry, menu, hint].forEach((o) => o.setDepth(DEPTH.OVERLAY).setAlpha(0));
        this.nav = new MenuNav(this, this.buttons);
        this.nav.setEnabled(false);
        this.anims.push(uiTween(this, {
            delay: 650, ms: 200, steps: 4, onUpdate: (v) => [retry, menu, hint].forEach((o, i) => { o.setAlpha(v); if (i < 2) o.y = Math.round(y + i * 28 + 8 * (1 - v)); }),
            onComplete: () => this.nav.setEnabled(true)
        }));
    }

    /** First input during the intro jumps to the final state instead of activating a button. */
    skip() {
        if (this.skipped || this.nav.enabled) return;
        this.skipped = true;
        this.anims.forEach((a) => a.stop());
        this.anims.length = 0;
        const { title, ghosts, flare, glow, sub, lines } = this.titleParts;
        title.setCrop();
        ghosts.forEach((g) => g.setVisible(false));
        flare.setVisible(true).setAlpha(0.25);
        glow.setAlpha(0.2);
        sub.setAlpha(1); lines.setAlpha(1);
        this.panelBg.setSize(PW, this.panelH);
        this.panelContent.setVisible(true);
        this.counters.forEach((r) => { r.l.setAlpha(1); r.v.setAlpha(1); this.setCounter(r, r.value); });
        this.buttons.forEach((b, i) => b.setAlpha(1).setY(this.buttonY + i * 28));
        this.hint.setAlpha(1);
        if (this.newBest) this.revealBest();
        // the key that skipped shouldn't also press a button
        uiDelay(this, 120, () => this.nav.setEnabled(true));
    }

    leave(target) {
        if (this.leaving) return;
        this.leaving = true;
        // to the menu: crossfade into the title theme now (MainMenu keeps it); a retry restarts the main track itself
        if (target === 'MainMenu') playMusic('title-music', { fadeIn: 900, fadeOut: 900 });
        this.cameras.main.fadeOut(180, 7, 11, 26);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(target));
    }

    update(t, dt) { this.bg.update(dt, 0.6); }
}
