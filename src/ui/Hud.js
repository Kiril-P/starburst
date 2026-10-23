// In-game HUD (layout from docs/concept-art/01): wave + sector top-left, score + combo top-right, segmented HP bar
// bottom-left, three ability slots with radial cooldown bottom-centre, optional quest tracker bottom-right, optional
// boss bar top-centre. Plus announce() banners and toast() notices.
//
// hud.update(state) is called every frame by the Game scene with:
// {
//   hp, maxHp,                 // numbers
//   score, combo,              // combo is the multiplier (1, 2, 3 ...), comboT01 = 0..1 time left before combo drops
//   comboT01,
//   wave, waveTimeLeft,        // seconds remaining in the wave (null for boss/no timer)
//   abilities: {               // each: { unlocked: bool, cooldown01: 0 (ready) .. 1 (just used), active: bool, key: 'SHIFT'|'Z'|'X' }
//     dash, forcefield, phase
//   },
//   // optional extras:
//   sector,                    // defaults to one sector per 5 waves
//   quest: { text, progress, goal } | null,   // bottom-right tracker
//   boss: { name, hp01, phase, phases, invuln, thresholds } | null   // top-centre boss bar (or hud.setBoss())
// }
// update() caches every value it shows and only touches game objects when something visible changed (no per-frame
// allocations in the steady state).
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { pxText, fmtNum, centerText } from './text.js';
import { createPanel, TEXT, RAMPS } from './widgets.js';
import AbilitySlot from './AbilitySlot.js';
import { Banner, Toasts } from './Banner.js';

const M = 4; // screen margin
const HP_SEGS = 26, SEG_W = 4, SEG_H = 6;
const BOSS_W = 216; // fits between the wave panel and the score panel
const TIERS = [[10, TEXT.magenta, RAMPS.magenta], [5, TEXT.amber, RAMPS.amber], [2, TEXT.cyan, RAMPS.cyan], [0, TEXT.dim, RAMPS.steel]];
const tierOf = (combo) => TIERS.find((t) => combo >= t[0]);
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

export default class Hud {
    constructor(scene) {
        this.scene = scene;
        this.root = scene.add.container(0, 0).setDepth(DEPTH.HUD).setScrollFactor(0);
        this.v = {}; // last shown values
        this.buildWave();
        this.buildScore();
        this.buildHp();
        this.buildAbilities();
        this.buildQuest();
        this.buildBoss();
        this.banner = new Banner(scene);
        this.toasts = new Toasts(scene, 44);
        this.lastT = 0;
        // lay everything out once so the HUD looks right even before the first update(); forget the HP so the
        // first real update doesn't play a heal/damage animation
        this.update({ hp: 1, maxHp: 1, score: 0, combo: 1, comboT01: 0, wave: 1, waveTimeLeft: null });
        this.v.lit = undefined;
        this.lastT = 0;
    }

    add(...objs) { this.root.add(objs); return objs[0]; }

    // --- top-left: WAVE 09 / SECTOR 03 -------------------------------------------------------------------------
    buildWave() {
        const s = this.scene;
        const lw = pxText(s, 0, 0, 'WAVE', { color: TEXT.dim });
        const ls = pxText(s, 0, 0, 'SECTOR', { color: TEXT.dim });
        const w = 10 + lw.width + 5 + 32 + 16 + ls.width + 5 + 32 + 10;
        const pw = Math.ceil(w), ph = 26;
        this.add(createPanel(s, M + (pw >> 1), M + (ph >> 1), pw, ph, { alpha: 0.85 }));
        let x = M + 10;
        lw.setPosition(x, M + 11); x += Math.ceil(lw.width) + 5;
        this.waveText = pxText(s, x, M + 6, '01', { size: 16, font: 'TITLE' }); x += 32 + 6;
        const g = s.add.graphics().fillStyle(COLORS.c, 1);
        for (let i = 0; i < 14; i++) g.fillRect(x + (i >> 1), M + 19 - i, 1, 1); // 1:2 stair-step slash
        x += 10;
        ls.setPosition(x, M + 11); x += Math.ceil(ls.width) + 5;
        this.sectorText = pxText(s, x, M + 6, '01', { size: 16, font: 'TITLE', color: TEXT.cyan });
        this.timeTab = createPanel(s, M + 40, M + ph + 2 + 9, 80, 18, { alpha: 0.85 }).setVisible(false);
        this.timeText = pxText(s, M + 10, M + ph + 7, '', { color: TEXT.dim });
        this.add(lw, ls, g, this.waveText, this.sectorText, this.timeTab, this.timeText);
    }

    // --- top-right: SCORE 128,450 + COMBO x8 with drain bar ----------------------------------------------------
    buildScore() {
        const s = this.scene;
        const pw = 204, ph = 26, x0 = W - M - pw;
        this.add(createPanel(s, x0 + (pw >> 1), M + (ph >> 1), pw, ph, { alpha: 0.85 }));
        this.add(pxText(s, x0 + 10, M + 11, 'SCORE', { color: TEXT.dim }));
        this.scoreRight = W - M - 10;
        this.scoreText = this.add(pxText(s, 0, M + 6, '0', { size: 16, font: 'TITLE' }));
        // combo lives on a small tab under the score panel so it reads over busy backgrounds
        this.comboTab = this.add(createPanel(s, 0, 0, 96, 26, { alpha: 0.85 }));
        this.comboRight = W - M - 10;
        this.comboY = M + ph + 6;
        this.comboLabel = this.add(pxText(s, 0, 0, 'COMBO', { color: TEXT.dim }));
        this.comboText = this.add(pxText(s, 0, this.comboY, 'x1', { size: 16, font: 'TITLE', color: TEXT.dim }));
        this.comboBarBack = this.add(s.add.rectangle(0, this.comboY + 19, 64, 2, COLORS.n).setOrigin(0, 0));
        this.comboBar = this.add(s.add.rectangle(0, this.comboY + 19, 64, 2, COLORS.C).setOrigin(0, 0));
        this.scoreShown = 0;
        this.comboBounce = 0;
        this.comboFlash = 0;
    }

    // --- bottom-left: HP segmented bar --------------------------------------------------------------------------
    buildHp() {
        const s = this.scene;
        const pw = 168, ph = 28, y0 = H - M - ph;
        this.add(createPanel(s, M + (pw >> 1), y0 + (ph >> 1), pw, ph, { alpha: 0.85 }));
        this.hpIcon = this.add(s.add.image(M + 7, y0 + 6, 'icon_heart').setOrigin(0, 0));
        this.add(pxText(s, M + 28, y0 + 5, 'HP', { color: TEXT.dim }));
        this.hpText = this.add(pxText(s, M + 44, y0 + 5, '', { font: 'TITLE', color: TEXT.white }));
        this.hpX = M + 28; this.hpY = y0 + 16;
        this.hpG = this.add(s.add.graphics());
        this.ghostSegs = 0; this.ghostHold = 0; this.healT = 0; this.healFrom = 0; this.blinkT = 0;
    }

    drawHp(lit, ramp, blinkOff) {
        const g = this.hpG.clear();
        const { hpX: x0, hpY: y0 } = this;
        for (let i = 0; i < HP_SEGS; i++) {
            const x = x0 + i * (SEG_W + 1);
            let r = null;
            if (i < lit) r = this.healT > 0 && i >= this.healFrom ? RAMPS.lime : blinkOff ? null : ramp;
            else if (i < this.ghostSegs) r = RAMPS.red;
            if (!r) {
                g.fillStyle(COLORS.n, 1).fillRect(x, y0, SEG_W, SEG_H);
                g.fillStyle(COLORS.k, 1).fillRect(x, y0 + 1, SEG_W, SEG_H - 2);
                continue;
            }
            const ghost = i >= lit;
            g.fillStyle(ghost ? COLORS.z : r[2], 1).fillRect(x, y0, SEG_W, SEG_H);
            g.fillStyle(ghost ? COLORS.w : r[3], 1).fillRect(x, y0, SEG_W, 1);
            g.fillStyle(ghost ? COLORS.R : r[1], 1).fillRect(x, y0 + SEG_H - 2, SEG_W, 2);
        }
    }

    // --- bottom-centre: abilities -------------------------------------------------------------------------------
    buildAbilities() {
        const s = this.scene, y = H - 27, gap = 44;
        const defs = [['dash', 'icon_dash', 'cyan', 'SHIFT'], ['forcefield', 'icon_forcefield', 'cyan', 'Z'], ['phase', 'icon_phase', 'magenta', 'X']];
        // connector lines between the rings, like the concept's hardware rail
        const g = this.add(s.add.graphics());
        g.fillStyle(COLORS.n, 1);
        g.fillRect(W / 2 - gap - 70, y, 50, 1); g.fillRect(W / 2 + gap + 20, y, 50, 1);
        g.fillRect(W / 2 - gap + 18, y, gap - 36, 1); g.fillRect(W / 2 + 18, y, gap - 36, 1);
        g.fillStyle(COLORS.c, 1);
        g.fillRect(W / 2 - gap - 70, y - 2, 1, 5); g.fillRect(W / 2 + gap + 69, y - 2, 1, 5);
        this.slots = defs.map(([name, icon, ramp, key], i) => {
            const slot = new AbilitySlot(s, W / 2 + (i - 1) * gap, y, i, { icon, ramp, key });
            this.add(...slot.objects);
            slot.name = name;
            return slot;
        });
    }

    // --- bottom-right: quest tracker ----------------------------------------------------------------------------
    buildQuest() {
        const s = this.scene;
        const pw = 168, ph = 28, x0 = W - M - pw, y0 = H - M - ph;
        this.quest = s.add.container(0, 0);
        this.quest.add(createPanel(s, x0 + (pw >> 1), y0 + (ph >> 1), pw, ph, { alpha: 0.85 }));
        this.quest.add(s.add.image(x0 + 7, y0 + 6, 'icon_quest').setOrigin(0, 0));
        this.questText = pxText(s, x0 + 28, y0 + 5, '', { color: TEXT.light });
        this.questCount = pxText(s, 0, y0 + 5, '', { color: TEXT.cyan });
        this.questRight = x0 + pw - 9;
        this.questG = s.add.graphics();
        this.questBar = { x: x0 + 28, y: y0 + 17, w: pw - 28 - 9 };
        this.quest.add([this.questText, this.questCount, this.questG]);
        this.quest.setVisible(false);
        this.add(this.quest);
    }

    // --- top-centre: boss bar (fills the gap between the wave and score panels) --------------------------------
    buildBoss() {
        const s = this.scene;
        const pw = BOSS_W, ph = 28, x0 = (W - pw) >> 1;
        this.boss = s.add.container(0, 0).setVisible(false);
        this.boss.add(createPanel(s, x0 + (pw >> 1), M + (ph >> 1), pw, ph, { alpha: 0.85 }));
        this.bossName = pxText(s, x0 + 9, M + 5, '', { font: 'TITLE', color: TEXT.magenta });
        this.bossG = s.add.graphics();
        this.boss.add([this.bossName, this.bossG]);
        this.bossBar = { x: x0 + 9, y: M + 16, w: pw - 18 };
        this.bossPips = x0 + pw - 9;
        this.bossInfo = null;
        this.add(this.boss);
    }

    /** show / update the boss bar: { name, hp01, phase, phases, invuln, thresholds } (or null to hide). The object
     * may be kept and mutated by the caller every frame; the bar animates toward it (fills up on first show). */
    setBoss(info) { this.bossInfo = info || null; }

    // -----------------------------------------------------------------------------------------------------------
    update(st) {
        if (!st) return;
        const now = this.scene.game.loop.time;
        const dt = this.lastT ? Math.min(50, now - this.lastT) : 16;
        this.lastT = now;
        const v = this.v;

        // wave / sector / timer
        const wave = st.wave ?? 1;
        if (wave !== v.wave) {
            v.wave = wave;
            this.waveText.setText(pad2(wave));
            this.sectorText.setText(pad2(st.sector ?? Math.floor((wave - 1) / 5) + 1));
        }
        const tl = st.waveTimeLeft == null ? -1 : Math.max(0, Math.ceil(st.waveTimeLeft));
        const tBlink = tl >= 0 && tl <= 5 && ((now / 250) | 0) & 1;
        if (tl !== v.tl || tBlink !== v.tBlink) {
            v.tl = tl; v.tBlink = tBlink;
            this.timeText.setText(tl < 0 ? '' : `TIME ${Math.floor(tl / 60)}:${pad2(tl % 60)}`);
            this.timeTab.setVisible(tl >= 0);
            this.timeText.setColor(tl <= 10 ? (tBlink ? TEXT.red : TEXT.amber) : TEXT.dim);
        }

        this.updateScore(st, dt);
        this.updateHp(st, dt);
        const ab = st.abilities || {};
        for (const slot of this.slots) slot.update(ab[slot.name], dt);
        this.updateQuest(st.quest);
        this.updateBoss(st.boss ?? this.bossInfo, dt);
    }

    updateScore(st, dt) {
        const v = this.v;
        const target = Math.max(0, st.score | 0);
        if (target < this.scoreShown) this.scoreShown = target;
        else if (target > this.scoreShown) this.scoreShown = Math.min(target, this.scoreShown + Math.ceil((target - this.scoreShown) * Math.min(1, dt / 90)));
        if (this.scoreShown !== v.score) {
            v.score = this.scoreShown;
            this.scoreText.setText(fmtNum(this.scoreShown));
            this.scoreText.x = this.scoreRight - Math.ceil(this.scoreText.width);
        }

        const combo = Math.max(1, st.combo | 0);
        if (combo !== v.combo) {
            if (combo > (v.combo || 1)) { this.comboBounce = 4; this.comboFlash = 120; }
            v.combo = combo;
            const [, col, ramp] = tierOf(combo);
            this.comboCol = col;
            this.comboText.setText('x' + combo).setColor(combo > 1 && this.comboFlash > 0 ? TEXT.white : col);
            this.comboText.x = this.comboRight - Math.ceil(this.comboText.width);
            this.comboLabel.setPosition(this.comboText.x - Math.ceil(this.comboLabel.width) - 4, this.comboY + 5);
            this.comboBar.setFillStyle(ramp[2]);
            const bw = this.comboRight - this.comboLabel.x;
            this.comboBarBack.setPosition(this.comboLabel.x, this.comboY + 19).setSize(bw, 2);
            this.comboBar.x = this.comboLabel.x;
            this.comboBarW = bw;
            const tw = bw + 20;
            if (tw !== v.tabW) {
                v.tabW = tw;
                this.comboTab.bg.setSize(tw, 28);
                this.comboTab.setPosition(W - M - tw, this.comboY - 5);
                this.comboTab.bg.setPosition(0, 0);
            }
            v.cw = -1;
        }
        // 1-frame-per-step "bounce": shift up 2px, 1px, 1px, back (no scaling)
        if (this.comboBounce > 0) this.comboBounce--;
        const dy = this.comboBounce >= 3 ? -2 : this.comboBounce > 0 ? -1 : 0;
        if (dy !== v.cdy) { v.cdy = dy; this.comboText.y = this.comboY + dy; }
        if (this.comboFlash > 0) {
            this.comboFlash -= dt;
            if (this.comboFlash <= 0) this.comboText.setColor(this.comboCol);
        }
        const show = combo > 1;
        const cw = show ? Math.round(this.comboBarW * Math.min(1, Math.max(0, st.comboT01 ?? 0))) : 0;
        if (cw !== v.cw) {
            v.cw = cw;
            this.comboBar.setVisible(cw > 0).setSize(Math.max(1, cw), 2);
            this.comboBarBack.setVisible(show);
        }
    }

    updateHp(st, dt) {
        const v = this.v;
        const max = Math.max(1, st.maxHp ?? 100), hp = Math.max(0, Math.min(max, st.hp ?? max));
        const r = hp / max;
        const lit = hp <= 0 ? 0 : Math.max(1, Math.ceil(r * HP_SEGS));
        if (v.lit !== undefined && lit < v.lit) { this.ghostSegs = Math.max(this.ghostSegs, v.lit); this.ghostHold = 380; }
        if (v.lit !== undefined && lit > v.lit) { this.healFrom = v.lit; this.healT = 300; }
        if (this.ghostHold > 0) this.ghostHold -= dt;
        else if (this.ghostSegs > lit) { this.ghostSegs -= 1; this.ghostHold = 28; }
        if (this.healT > 0) this.healT -= dt;
        const low = r <= 0.25;
        const blinkOff = low && hp > 0 && ((this.scene.game.loop.time / 160) | 0) % 3 === 0;
        const ramp = low ? RAMPS.red : r <= 0.5 ? RAMPS.amber : RAMPS.cyan;
        const key = lit * 1000 + this.ghostSegs * 10 + (blinkOff ? 1 : 0) + (this.healT > 0 ? 2 : 0) + (low ? 4 : r <= 0.5 ? 6 : 0);
        if (key !== v.hpKey) { v.hpKey = key; v.lit = lit; this.drawHp(lit, ramp, blinkOff); }
        const hpi = Math.ceil(hp);
        if (hpi !== v.hp || max !== v.max) {
            v.hp = hpi; v.max = max;
            this.hpText.setText(`${hpi}/${max}`).setColor(low ? TEXT.red : r <= 0.5 ? TEXT.amber : TEXT.white);
            if (low) this.hpIcon.setTint(COLORS.R); else this.hpIcon.clearTint();
        }
    }

    updateQuest(q) {
        const v = this.v;
        const on = !!q;
        if (on !== v.qOn) { v.qOn = on; this.quest.setVisible(on); v.qKey = null; }
        if (!on) return;
        const key = q.text + '|' + q.progress + '|' + q.goal; // only strings when a quest is shown; cheap
        if (key === v.qKey) return;
        v.qKey = key;
        const done = q.progress >= q.goal;
        this.questText.setText(q.text).setColor(done ? TEXT.lime : TEXT.light);
        this.questCount.setText(`${Math.min(q.progress, q.goal)}/${q.goal}`).setColor(done ? TEXT.lime : TEXT.cyan);
        this.questCount.x = this.questRight - Math.ceil(this.questCount.width);
        const { x, y, w } = this.questBar;
        const fw = Math.round(w * Math.min(1, q.goal ? q.progress / q.goal : 0));
        const ramp = done ? RAMPS.lime : RAMPS.cyan;
        this.questG.clear().fillStyle(COLORS.n, 1).fillRect(x, y, w, 3).fillStyle(ramp[2], 1).fillRect(x, y, fw, 3).fillStyle(ramp[3], 1).fillRect(x, y, fw, 1);
    }

    updateBoss(b, dt) {
        const v = this.v;
        const on = !!b;
        if (on !== v.bOn) { v.bOn = on; this.boss.setVisible(on); v.bName = null; v.bKey = -1; this.bossShown = 0; this.bossGhost = 0; this.bossHold = 0; }
        if (!on) return;
        if (b.name !== v.bName) { v.bName = b.name; this.bossName.setText(b.name || 'WARNING'); }
        // shown value chases the real one: fast fill-up on intro, a white-hot ghost trails damage
        const target = Math.min(1, Math.max(0, b.hp01 ?? 0));
        if (target < this.bossShown) { this.bossShown = target; this.bossHold = 350; }
        else if (this.bossShown < target) this.bossShown = Math.min(target, this.bossShown + dt / 1100);
        if (this.bossGhost < this.bossShown) this.bossGhost = this.bossShown;
        else if (this.bossHold > 0) this.bossHold -= dt;
        else this.bossGhost = Math.max(this.bossShown, this.bossGhost - dt / 900);
        const { x, y, w } = this.bossBar;
        const fw = Math.round(w * this.bossShown), gw = Math.round(w * this.bossGhost);
        const blink = b.invuln && ((this.scene.game.loop.time / 180) | 0) & 1;
        const key = fw * 4096 + gw * 8 + (b.invuln ? 2 : 0) + (blink ? 1 : 0) + (b.phase || 0) * 4096 * 1024;
        if (key === v.bKey) return;
        v.bKey = key;
        const ramp = b.invuln ? RAMPS.steel : RAMPS.magenta;
        const g = this.bossG.clear();
        g.fillStyle(COLORS.k, 1).fillRect(x - 1, y - 1, w + 2, 8);
        g.fillStyle(COLORS.p, 1).fillRect(x, y, w, 6);
        if (gw > fw) g.fillStyle(COLORS.z, 1).fillRect(x + fw, y, gw - fw, 6);
        g.fillStyle(ramp[2], 1).fillRect(x, y, fw, 6);
        g.fillStyle(blink ? COLORS.w : ramp[3], 1).fillRect(x, y, fw, 1);
        g.fillStyle(ramp[1], 1).fillRect(x, y + 4, fw, 2);
        // amber ticks where the next phases begin
        g.fillStyle(COLORS.A, 1);
        for (const t of b.thresholds || []) g.fillRect(x + Math.round(w * t), y - 2, 1, 10);
        // phase pips (right of the name): filled = phases reached
        const n = b.phases || 1;
        for (let i = 0; i < n; i++) {
            const px = this.bossPips - (n - 1 - i) * 8 - 5, lit = i <= (b.phase || 0);
            g.fillStyle(lit ? COLORS.M : COLORS.p, 1).fillRect(px + 1, M + 6, 3, 5).fillRect(px, M + 7, 5, 3);
            if (lit) g.fillStyle(COLORS.q, 1).fillRect(px + 1, M + 7, 1, 1);
        }
    }

    /** big centred banner, e.g. announce('WAVE 3', 'GET READY') */
    announce(title, sub = '', ms = 1800) { this.banner.show(title, sub, ms); }

    /** small toast at top centre */
    toast(text, color = '#f4faff', ms = 1500) { this.toasts.show(text, color, ms); }

    setVisible(v) { this.root.setVisible(v); this.banner.setVisible(v); this.toasts.setVisible(v); }

    destroy() { this.banner.destroy(); this.toasts.destroy(); this.root.destroy(); }
}
