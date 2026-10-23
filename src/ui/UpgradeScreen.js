// Between-wave pick screen (concept-art 04): dimmed playfield, 2-4 cards that deal in staggered, LEFT/RIGHT (A/D) or
// 1-4 + ENTER/SPACE or mouse to choose. onPick(option) fires exactly once, then the cards fly out and the screen
// destroys itself.
// options: [{ id, title, desc, icon: 'card_dash'|'card_forcefield'|'card_phase'|'card_speed'|'card_heal', tag?: 'NEW'|'UPGRADE'|'HEAL' }]
// opts (optional 4th arg): { title = 'WAVE COMPLETE', subtitle = 'CHOOSE YOUR UPGRADE' }
// Everything animates on the game clock (uiTween), so the caller can freeze physics/time/tweens while it is open.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS, PALETTE } from '../art/palette.js';
import { pxText, centerText } from './text.js';
import { MenuNav, TEXT, RAMPS, SLICE, nine, uiTween, uiDelay } from './widgets.js';
import { sfx } from '../systems/sfx.js';

const CW = 116, CH = 180, GAP = 12, CY = 198;
const HUE = { card_dash: 'cyan', card_forcefield: 'cyan', card_phase: 'magenta', card_speed: 'lime', card_heal: 'lime' };
const TAG_HUE = { NEW: 'cyan', UPGRADE: 'amber', HEAL: 'lime', WEAPON: 'cyan', SYNERGY: 'amber' };
const CSS = { cyan: [PALETTE.c, PALETTE.C, PALETTE.b], magenta: [PALETTE.m, PALETTE.M, PALETTE.q], lime: [PALETTE.l, PALETTE.L, PALETTE.j], amber: [PALETTE.a, PALETTE.A, PALETTE.z] };

/** Greedy word wrap using a scratch text object for measuring. */
function wrap(scratch, str, maxW) {
    const lines = [];
    let line = '';
    for (const word of String(str).split(/\s+/)) {
        const test = line ? line + ' ' + word : word;
        if (scratch.setText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
}

/** One card. Implements the Button-like interface MenuNav expects (enabled, setFocused, activate, 'hover' event). */
class Card extends Phaser.GameObjects.Container {
    constructor(scene, x, y, option, onActivate) {
        super(scene, x, y);
        this.option = option;
        this.enabled = true;
        this.focused = false;
        this.onActivate = onActivate;
        const hue = option.hue ?? HUE[option.icon] ?? 'cyan';   // weapon cards pass hue (amber = rare synergy)
        this.ramp = RAMPS[hue];
        this.css = CSS[hue];
        // art-ui may provide hue variants of the card frame (ui_card_magenta ...); fall back to the cyan contract keys
        const variant = (k) => (hue !== 'cyan' && scene.textures.exists(`${k}_${hue}`) ? `${k}_${hue}` : k);
        this.keys = [variant('ui_card'), variant('ui_card_hover')];
        const x0 = -(CW >> 1), y0 = -(CH >> 1);

        this.face = scene.add.container(0, 0);
        this.bg = nine(scene, x0, y0, this.keys[0], CW, CH).setAlpha(0.95);
        this.face.add(this.bg);
        // emblem: pixel ring around the card icon
        const ring = scene.add.graphics();
        this.drawRing(ring, 0, y0 + 38, 21, false);
        this.ring = ring;
        const icon = scene.add.image(-16, y0 + 22, option.icon).setOrigin(0, 0);
        const title = centerText(pxText(scene, 0, 0, option.title.toUpperCase(), { font: 'TITLE', color: this.css[1] }), 0, y0 + 72);
        this.face.add([ring, icon, title]);
        const scratch = pxText(scene, 0, 0, '', {});
        wrap(scratch, option.desc ?? '', CW - 16).slice(0, 4).forEach((l, i) => {
            this.face.add(centerText(pxText(scene, 0, 0, l, { color: TEXT.light }), 0, y0 + 92 + i * 10));
        });
        scratch.destroy();
        const divider = scene.add.rectangle(x0 + 12, y0 + CH - 44, CW - 24, 1, this.ramp[0]).setOrigin(0, 0);
        this.face.add(divider);
        if (option.tag) {
            const th = TAG_HUE[option.tag] ?? 'cyan';
            const tag = pxText(scene, 0, 0, option.tag, { color: CSS[th][1], spacing: 1 });
            centerText(tag, 0, y0 + CH - 34);
            this.face.add(tag);
        }
        // SELECT pill shown on the focused card
        this.pill = scene.add.container(0, y0 + CH - 16);
        const pw = CW - 28;
        // drawn in the card's hue (the button frames are cyan-only): chamfered 2px corners, highlight top row
        const pg = scene.add.graphics(), px = -(pw >> 1), py = -8, r = this.ramp;
        pg.fillStyle(r[2], 1).fillRect(px + 2, py, pw - 4, 16).fillRect(px + 1, py + 1, pw - 2, 14).fillRect(px, py + 2, pw, 12);
        pg.fillStyle(r[0], 1).fillRect(px + 2, py + 2, pw - 4, 12);
        pg.fillStyle(r[1], 1).fillRect(px + 2, py + 2, pw - 4, 1);
        pg.fillStyle(r[3], 1).fillRect(px + 3, py, pw - 6, 1);
        this.pill.add(pg);
        this.pill.add(centerText(pxText(scene, 0, 0, 'SELECT', { font: 'TITLE', color: TEXT.white }), 0, 0));
        this.pill.setVisible(false);
        this.face.add(this.pill);
        // pointer arrow under the focused card (pixel triangle)
        this.arrow = scene.add.graphics().fillStyle(this.ramp[2], 1);
        for (let i = 0; i < 4; i++) this.arrow.fillRect(-4 + i, CH / 2 + 5 + i, 8 - i * 2, 1);
        this.arrow.setVisible(false);
        this.add([this.face, this.arrow]);

        this.setSize(CW, CH).setInteractive({ useHandCursor: true });
        this.on('pointerover', () => this.emit('hover', this));
        this.on('pointerup', () => this.activate());
        scene.add.existing(this);
    }

    /** Pixel ring (2px) drawn from per-pixel tests: crisp at any radius. */
    drawRing(g, cx, cy, r, hot) {
        g.clear();
        for (let y = -r - 1; y <= r + 1; y++) {
            for (let x = -r - 1; x <= r + 1; x++) {
                const d = Math.hypot(x + 0.5, y + 0.5);
                if (d >= r - 2 && d < r) g.fillStyle(d < r - 1 ? this.ramp[1] : hot ? this.ramp[3] : this.ramp[2], 1).fillRect(cx + x, cy + y, 1, 1);
                else if (d < r - 2) g.fillStyle(COLORS.k, 1).fillRect(cx + x, cy + y, 1, 1);
                else if (hot && d >= r + 1 && d < r + 2 && ((x + y) & 1)) g.fillStyle(this.ramp[2], 1).fillRect(cx + x, cy + y, 1, 1);
            }
        }
        this.ringCY = cy; this.ringR = r;
    }

    setFocused(b) {
        if (b === this.focused) return this;
        this.focused = b;
        this.bg.setTexture(this.keys[b ? 1 : 0]);
        this.bg.setSlices(CW, CH, SLICE, SLICE, SLICE, SLICE);
        this.face.y = b ? -3 : 0;
        this.pill.setVisible(b);
        this.arrow.setVisible(b);
        this.drawRing(this.ring, 0, this.ringCY, this.ringR, b);
        return this;
    }

    activate() { if (this.enabled) this.onActivate(this); }
}

export default class UpgradeScreen {
    constructor(scene, options, onPick, opts = {}) {
        this.scene = scene;
        this.onPick = onPick;
        this.picked = false;
        this.anims = [];
        const n = Math.max(1, Math.min(4, options.length));
        options = options.slice(0, n);

        // dim sits under the HUD so score/HP stay readable (as in the concept); cards sit above everything
        this.dim = scene.add.rectangle(0, 0, W, H, COLORS.k, 0).setOrigin(0, 0).setDepth(DEPTH.HUD - 1).setScrollFactor(0).setInteractive();
        this.root = scene.add.container(0, 0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
        const title = pxText(scene, 0, 0, opts.title ?? 'WAVE COMPLETE', { size: 16, font: 'TITLE', color: TEXT.white });
        centerText(title, W / 2, 66);
        const sub = pxText(scene, 0, 0, opts.subtitle ?? 'CHOOSE YOUR UPGRADE', { color: TEXT.cyan, spacing: 2 });
        centerText(sub, W / 2, 90);
        // rule with progress-dot ornament under the title
        const rule = scene.add.graphics();
        rule.fillStyle(COLORS.c, 1).fillRect(W / 2 - 150, 80, 120, 1).fillRect(W / 2 + 30, 80, 120, 1);
        for (let i = 0; i < 5; i++) rule.fillStyle(i === 2 ? COLORS.b : COLORS.C, 1).fillRect(W / 2 - 22 + i * 10, 79, 3, 3);
        const hint = pxText(scene, 0, 0, '< > CHOOSE     ENTER SELECT', { color: TEXT.muted });
        centerText(hint, W / 2, 306);
        this.header = [title, sub, rule, hint];
        this.root.add(this.header);
        this.header.forEach((o) => o.setAlpha(0));

        const total = n * CW + (n - 1) * GAP;
        this.cards = options.map((o, i) => {
            const x = Math.round(W / 2 - total / 2 + CW / 2 + i * (CW + GAP));
            const c = new Card(scene, x, CY, o, (card) => this.pick(card));
            this.root.add(c);
            c.homeY = CY;
            c.setVisible(false);
            return c;
        });
        this.nav = new MenuNav(scene, this.cards, { horizontal: true });
        this.numKeys = ['ONE', 'TWO', 'THREE', 'FOUR'].slice(0, n).map((k, i) => {
            const h = () => this.pick(this.cards[i]);
            scene.input.keyboard.on(`keydown-${k}`, h);
            return [`keydown-${k}`, h];
        });
        this.nav.setEnabled(false);
        this.intro();
    }

    intro() {
        const { scene } = this;
        this.anims.push(uiTween(scene, { ms: 200, steps: 5, onUpdate: (v) => this.dim.setFillStyle(COLORS.k, 0.62 * v) }));
        this.anims.push(uiTween(scene, { delay: 80, ms: 160, steps: 4, onUpdate: (v) => this.header.forEach((o) => o.setAlpha(v)) }));
        this.cards.forEach((c, i) => {
            this.anims.push(uiTween(scene, {
                delay: 140 + i * 80, ms: 220, steps: 6, ease: 'back',
                onUpdate: (v) => { c.setVisible(true); c.y = Math.round(c.homeY + 40 * (1 - v)); c.setAlpha(Math.min(1, v * 2)); },
                onComplete: () => { if (i === 0) sfx(scene, 'button-sound', { vol: 0.5, rate: 0.8 }); }
            }));
        });
        // input opens once the deal has landed, so a held key from gameplay can't insta-pick
        this.anims.push(uiDelay(scene, 140 + this.cards.length * 80 + 120, () => { if (!this.picked) this.nav.setEnabled(true); }));
    }

    pick(card) {
        if (this.picked || !this.nav.enabled) return;
        this.picked = true;
        this.nav.setEnabled(false);
        this.cards.forEach((c) => { c.enabled = false; c.disableInteractive(); });
        card.setFocused(true);
        sfx(this.scene, 'upgrade', { vol: 0.7 });
        this.onPick && this.onPick(card.option);

        const { scene } = this;
        // chosen card blinks its frame, the others drop away; then the chosen one shoots up and the dim lifts
        this.anims.push(uiTween(scene, {
            ms: 260, ease: 'linear', onUpdate: (v) => {
                const on = (((v * 6) | 0) & 1) === 0;
                card.bg.setTexture(card.keys[on ? 1 : 0]).setSlices(CW, CH, SLICE, SLICE, SLICE, SLICE);
            }
        }));
        this.cards.forEach((c) => {
            if (c === card) return;
            this.anims.push(uiTween(scene, { ms: 200, steps: 5, ease: 'in', onUpdate: (v) => { c.y = Math.round(c.homeY + 60 * v); c.setAlpha(1 - v); } }));
        });
        this.anims.push(uiTween(scene, {
            delay: 300, ms: 220, steps: 6, ease: 'in',
            onUpdate: (v) => { card.y = Math.round(card.homeY - 3 - 260 * v); this.header.forEach((o) => o.setAlpha(1 - v)); this.dim.setFillStyle(COLORS.k, 0.62 * (1 - v)); },
            onComplete: () => this.destroy()
        }));
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.anims.forEach((a) => a.stop());
        this.nav.destroy();
        const k = this.scene.input && this.scene.input.keyboard;
        if (k) this.numKeys.forEach(([ev, h]) => k.off(ev, h));
        this.root.destroy();
        this.dim.destroy();
    }
}
