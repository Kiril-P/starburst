// BOSS GALLERY overlay: every mid-boss / boss / the final boss, with what this player has seen and beaten
// (Save.bossLog via objects/bosses/roster.js). Unseen bosses show as a dark silhouette named "???".
// Also exports addBossGalleryEntry(menu): the one call MainMenu makes to get a BOSSES button + [B] hotkey.
import { DEPTH } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { Button } from '../../ui/widgets.js';
import { uiSfx } from '../../systems/sfx.js';
import { GALLERY, bossLog } from '../../objects/bosses/roster.js';
import { COLOSSUS_PLATES } from '../../art/sprites/bosses2.js';
import OverlayScene from './OverlayScene.js';
import { text, setTextKeep, navButton } from './helpers.js';

const ROW_H = 18, LIST_W = 148;
const KIND = { mini: ['MID-BOSS', 'A'], main: ['BOSS', 'M'], final: ['FINAL BOSS', 'q'] };   // label, palette char
const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function galleryCounts() {
    const log = bossLog();
    return { seen: GALLERY.filter((e) => log[e.def.id]?.seen).length, down: GALLERY.filter((e) => log[e.def.id]?.kills).length, total: GALLERY.length };
}

/** MainMenu hook: a BOSSES nav button under BEST RUN (joins the menu's keyboard nav) and a [B] shortcut. */
export function addBossGalleryEntry(menu) {
    const open = () => menu.press(() => menu.openOverlay('MenuBossGallery'));
    const { down, total } = galleryCounts();
    const b = navButton(menu, 16 + 80, 312, 160, 20, 'BOSSES', open, { value: `${down}/${total}`, valueColor: PALETTE[4] });
    b.setDepth(DEPTH.HUD);
    b.homeX = b.x;
    menu.buttons.push(b);
    menu.input.keyboard.on('keydown-B', open);
    return b;
}

export default class BossGallery extends OverlayScene {
    constructor() { super('MenuBossGallery', 'BOSSES', [440, 288]); }

    build(b) {
        this.log = bossLog();
        const { seen, down, total } = galleryCounts();
        setTextKeep(this.hint, `SEEN ${seen}/${total}   DOWN ${down}/${total}`);
        this.hint.setColor(down === total ? PALETTE.L : PALETTE.C);
        const g = this.add.graphics();
        this.root.add(g);
        this.rows = GALLERY.map((e, i) => {
            const y = b.y + i * ROW_H, s = this.log[e.def.id] ?? {};
            if (i % 2 === 0) g.fillStyle(COLORS.n, 0.3).fillRect(b.x, y, LIST_W, ROW_H - 2);
            const name = text(this, b.x + 18, y + 4, s.seen ? e.def.name.replace('THE ', '') : '???', { size: 8, color: s.seen ? PALETTE[6] : PALETTE[3] });
            const icon = this.add.image(b.x + 3, y, s.kills ? 'icon_skull' : 'icon_quest').setOrigin(0, 0).setVisible(!!s.seen);
            if (!s.kills) icon.setTint(COLORS[3]);
            const tag = this.add.rectangle(b.x + LIST_W - 6, y + 4, 3, 8, COLORS[KIND[e.def.kind][1]]).setOrigin(0, 0);
            this.root.add([name, icon, tag]);
            const hit = this.add.zone(b.x, y, LIST_W, ROW_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => this.select(i));
            this.root.add(hit);
            return { name, y };
        });
        this.cursor = this.add.graphics();
        this.root.add(this.cursor);
        // preview pane
        const px = b.x + LIST_W + 10, pw = b.w - LIST_W - 10;
        this.pane = { x: px, y: b.y, w: pw, cx: Math.round(px + pw / 2), cy: b.y + 70 };
        g.fillStyle(COLORS.k, 0.6).fillRect(px, b.y, pw, 140);
        g.fillStyle(COLORS.c, 1).fillRect(px, b.y, pw, 1).fillRect(px, b.y + 139, pw, 1);
        this.preview = this.add.container(0, 0);
        this.root.add(this.preview);
        this.title = text(this, px, b.y + 148, '', { font: 'TITLE', size: 8, color: PALETTE.w });
        this.kind = text(this, px + pw, b.y + 148, '', { size: 8, origin: [1, 0] });
        this.sub = text(this, px, b.y + 162, '', { size: 8, color: PALETTE[5] });
        this.stats = text(this, px, b.y + 178, '', { size: 8, color: PALETTE.C });
        this.blurb = text(this, px, b.y + 194, '', { size: 8, color: PALETTE[4] });
        this.root.add([this.title, this.kind, this.sub, this.stats, this.blurb]);
        const back = new Button(this, px + pw / 2, b.y + b.h - 8, 'BACK', () => this.close(), { w: 80, h: 20 });
        back.setFocused(true);
        this.root.add(back);
        const k = this.input.keyboard;
        for (const key of ['UP', 'W']) k.on(`keydown-${key}`, () => this.select((this.i + GALLERY.length - 1) % GALLERY.length));
        for (const key of ['DOWN', 'S']) k.on(`keydown-${key}`, () => this.select((this.i + 1) % GALLERY.length));
        k.on('keydown-ENTER', () => this.close());
        k.on('keydown-SPACE', () => this.close());
        this.i = -1;
        this.select(Math.max(0, GALLERY.findIndex((e) => this.log[e.def.id]?.seen && !this.log[e.def.id]?.kills)), false);
    }

    select(i, withSfx = true) {
        if (i === this.i) return;
        this.i = i;
        const e = GALLERY[i], s = this.log[e.def.id] ?? {}, b = this.body;
        const r = this.rows[i];
        this.cursor.clear().fillStyle(COLORS.C, 1).fillRect(b.x, r.y, 1, ROW_H - 2).fillRect(b.x + LIST_W - 1, r.y, 1, ROW_H - 2);
        this.rows.forEach((row, j) => row.name.setColor(j === i ? PALETTE.w : (this.log[GALLERY[j].def.id]?.seen ? PALETTE[6] : PALETTE[3])));
        this.showSprite(e, !!s.seen);
        const [kind, kcol] = KIND[e.def.kind];
        setTextKeep(this.title, s.seen ? e.def.name : '???');
        setTextKeep(this.kind, kind); this.kind.setColor(PALETTE[kcol]);
        setTextKeep(this.sub, s.seen ? e.def.title : 'NOT YET ENCOUNTERED');
        setTextKeep(this.stats, s.seen ? `MET ${s.seen}   DOWN ${s.kills || 0}${s.best ? '   BEST ' + fmtTime(s.best) : ''}` : '');
        setTextKeep(this.blurb, s.seen ? e.blurb : '');
        if (withSfx) uiSfx(this, 'hover');
    }

    showSprite(e, seen) {
        this.preview.removeAll(true);
        const { cx, cy } = this.pane;
        const add = (key, dx, dy, frame = 0) => {
            const s = this.add.sprite(cx + dx, cy + dy, key, frame);
            if (seen && this.anims.exists(key)) s.play(key);
            if (!seen) s.setTintFill(COLORS[2]);       // silhouette: shape only
            this.preview.add(s);
            return s;
        };
        add(e.key, 0, 0);
        if (e.def.id === 'colossus') { add('boss_colossus_core', 0, 0, seen ? 1 : 0); for (const [dx, dy] of COLOSSUS_PLATES) add('boss_colossus_plate', dx, dy); }
        if (e.def.id === 'prism') for (const [dx, dy] of [[-36, -36], [36, -36], [-36, 36], [36, 36]]) add('boss_prism_shard', dx, dy);
    }
}
