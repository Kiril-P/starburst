// The three player ships on the title screen. The selected one sits higher, burns its engine and is circled by a
// rotating ring of pixel dashes; the others are dimmed and sit a few pixels lower. All motion is in whole pixels.
import Phaser from 'phaser';
import { DEPTH, SHIPS } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { SHIP_INFO } from './data.js';
import { text, bob } from './helpers.js';

const RING_R = 42;
const DIM_TINT = COLORS[4];
const DROP = 6;                 // unselected ships sit this many px lower

/** Pixels of a 1px circle (midpoint algorithm), sorted by angle so index runs around the circle. */
function circlePixels(r) {
    const pts = new Map();
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
        for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) pts.set(`${px},${py}`, [px, py]);
        y++;
        if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
    return [...pts.values()].sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
}
const RING = circlePixels(RING_R);
const RING_IN = circlePixels(RING_R - 4);

export default class ShipShowcase {
    /** @param xs centre x of each ship, @param y baseline centre y, @param onPick(i) when a ship is clicked */
    constructor(scene, xs, y, index, onPick) {
        this.scene = scene;
        this.y = y;
        this.index = index;
        this.t = 0;
        this.ring = scene.add.graphics().setDepth(DEPTH.PLAYER - 1);
        this.ringGlow = scene.add.image(0, 0, 'glow_l').setDepth(DEPTH.PLAYER - 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
        this.slots = SHIPS.map((id, i) => this.makeSlot(id, xs[i], i, onPick));
        this.select(index, true);
    }

    makeSlot(id, x, i, onPick) {
        const s = this.scene, info = SHIP_INFO[id];
        const ship = s.add.image(0, 0, `ship_${id}_big`).setOrigin(0, 0).setDepth(DEPTH.PLAYER);
        const flame = s.add.sprite(0, 0, `flame_${id}`, 0).setOrigin(0, 0).setDepth(DEPTH.PLAYER - 1);
        if (s.anims.exists(`flame_${id}`)) flame.play(`flame_${id}`);
        const glow = s.add.image(0, 0, 'glow_m').setDepth(DEPTH.PLAYER - 2).setBlendMode(Phaser.BlendModes.ADD).setTint(info.accent);
        const label = text(s, x, this.y + RING_R + 12, info.cls, { font: 'TITLE', size: 8, origin: [0.5, 0], color: PALETTE[4] });
        label.setDepth(DEPTH.HUD);
        const under = s.add.graphics().setDepth(DEPTH.HUD);
        // generous click target: the ring's square
        const hit = s.add.zone(x, this.y, RING_R * 2, RING_R * 2 + 24).setInteractive({ useHandCursor: true });
        // locked ships (systems/meta.js) show as dark silhouettes with a padlock
        const lock = s.add.image(0, 0, 'icon_lock').setOrigin(0, 0).setDepth(DEPTH.PLAYER + 1).setVisible(false);
        const slot = { id, info, x, ship, flame, glow, label, under, hit, lock, locked: false, y: this.y + DROP, hover: false, phase: i * 1.7 };
        hit.on('pointerover', () => { slot.hover = true; });
        hit.on('pointerout', () => { slot.hover = false; });
        hit.on('pointerdown', () => onPick && onPick(i));
        return slot;
    }

    select(i, instant = false) {
        this.index = i;
        this.slots.forEach((sl, j) => {
            const on = j === i;
            sl.label.setColor(on ? sl.info.accentCss : PALETTE[4]);
            sl.flame.setVisible(on && !sl.locked);
            sl.glow.setVisible(on && !sl.locked);
            sl.under.clear();
            if (on) {
                // little underline with a centre pip, like the concept
                const lw = sl.label.width + 16, lx = Math.round(sl.x - lw / 2), ly = sl.label.y + sl.label.height + 3;
                sl.under.fillStyle(sl.info.accentDark).fillRect(lx, ly, lw, 1);
                sl.under.fillStyle(sl.info.accent).fillRect(Math.round(sl.x) - 1, ly - 1, 3, 3);
            }
            if (instant) sl.y = this.y + (on ? 0 : DROP);
        });
        this.ringGlow.setTint(this.slots[i].info.accentDark);
        this.ringT = 0;   // ring "snaps" open on a new selection
    }

    get current() { return this.slots[this.index]; }

    /** mark ships as locked: flags[i] true = silhouette + padlock, no engine */
    setLocked(flags) {
        this.slots.forEach((sl, i) => { sl.locked = !!flags[i]; sl.lock.setVisible(sl.locked); });
        this.select(this.index, true);
    }

    update(dt) {
        this.t += dt;
        for (const [j, sl] of this.slots.entries()) {
            const on = j === this.index;
            // ease toward the target height, but only ever in whole pixels
            const target = this.y + (on ? 0 : DROP);
            if (sl.y !== target) sl.y += Math.sign(target - sl.y) * Math.max(1, Math.round(Math.abs(target - sl.y) * 0.25));
            if (this.launching) continue;   // launch() owns positions/alpha from here on
            const by = sl.y + bob(this.t, on ? 1600 : 2200, on ? 2 : 1, sl.phase);
            this.placeShip(sl, by);
            sl.ship.setTint(sl.locked ? COLORS[2] : on || sl.hover ? 0xffffff : DIM_TINT);
            sl.ship.setAlpha(sl.locked ? 1 : on ? 1 : sl.hover ? 0.95 : 0.8);
            if (sl.locked) sl.lock.setPosition(Math.round(sl.x - sl.lock.width / 2), Math.round(by - sl.lock.height / 2));
        }
        this.drawRing(dt);
    }

    placeShip(sl, cy) {
        const w = sl.ship.width, h = sl.ship.height;
        sl.ship.setPosition(Math.round(sl.x - w / 2), Math.round(cy - h / 2));
        // flame tucked just under the hull, centred (origin 0.5,0 per contract)
        sl.flame.setPosition(Math.round(sl.x - sl.flame.width / 2), sl.ship.y + h - 6);
        sl.glow.setPosition(Math.round(sl.x), sl.flame.y + 6).setAlpha(0.45 + 0.15 * Math.sin(this.t / 90));
        sl.cy = cy;
    }

    drawRing(dt) {
        const g = this.ring, sl = this.current;
        g.clear();
        if (this.launching) { this.drawTrail(g, sl); return; }
        this.ringT = Math.min(1, (this.ringT ?? 1) + dt / 220);
        const cx = Math.round(sl.x), cy = this.y;
        const n = RING.length;
        const rot = Math.floor(this.t / 40);              // one pixel step every 40ms
        const open = this.ringT * 0.34;                   // dash length grows in on selection
        const acc = sl.info.accent, accDark = sl.info.accentDark;
        // outer ring: 6 dashes rotating clockwise
        for (let k = 0; k < n; k++) {
            const f = ((((k + rot) % n) * 6) / n) % 1;
            if (f < open) g.fillStyle(f < 0.05 || f > open - 0.05 ? accDark : acc).fillRect(cx + RING[k][0], cy + RING[k][1], 1, 1);
        }
        // inner ring: sparse dots rotating the other way
        const n2 = RING_IN.length;
        g.fillStyle(accDark);
        for (let k = 0; k < n2; k++) if ((k + n2 - (rot % n2)) % 8 === 0) g.fillRect(cx + RING_IN[k][0], cy + RING_IN[k][1], 1, 1);
        // fixed sight ticks at N/S/E/W
        g.fillStyle(acc);
        const R = RING_R + 4;
        g.fillRect(cx - 2, cy - R, 5, 1); g.fillRect(cx - 1, cy - R + 1, 3, 1); g.fillRect(cx, cy - R + 2, 1, 1);
        g.fillRect(cx - 2, cy + R, 5, 1); g.fillRect(cx - 1, cy + R - 1, 3, 1); g.fillRect(cx, cy + R - 2, 1, 1);
        g.fillStyle(accDark);
        g.fillRect(cx - R - 3, cy, 5, 1); g.fillRect(cx + R - 1, cy, 5, 1);
        this.ringGlow.setPosition(cx, cy).setDisplaySize(RING_R * 2 + 24, RING_R * 2 + 24).setAlpha(0.18 + 0.06 * Math.sin(this.t / 500));
    }

    /** Engine trail while launching: a 3px column from the tail back to the launch point, hot core + accent edges. */
    drawTrail(g, sl) {
        if (sl.cy === undefined || sl.cy >= this.launchY) return;
        const x = Math.round(sl.x), top = sl.flame.y + sl.flame.height - 4, bottom = this.launchY + 32;
        const len = bottom - top;
        if (len <= 0) return;
        const ramp = [COLORS.w, sl.info.accent, sl.info.accent, sl.info.accentDark, sl.info.accentDark];
        const seg = Math.ceil(len / ramp.length);
        ramp.forEach((col, i) => {
            const y = top + i * seg, h = Math.min(seg, bottom - y);
            if (h <= 0) return;
            g.fillStyle(col).fillRect(x - (i < 2 ? 1 : 0), y, i < 2 ? 3 : 1, h);
            if (i === 0) g.fillStyle(sl.info.accent).fillRect(x - 2, y, 1, h).fillRect(x + 2, y, 1, h);
        });
    }

    /** START transition: selected ship dips, then blasts off the top. Others fade. Calls done() once gone. */
    launch(done) {
        const s = this.scene, sl = this.current;
        this.launching = true;
        this.ringGlow.setVisible(false);
        this.slots.forEach((o) => { if (o !== sl) s.tweens.add({ targets: [o.ship, o.label], alpha: 0, duration: 300 }); o.under.clear(); o.hit.disableInteractive(); });
        s.tweens.add({ targets: sl.label, alpha: 0, duration: 200 });
        this.launchY = sl.cy;
        const p = { y: sl.cy };
        const place = () => this.placeShip(sl, Math.round(p.y));
        s.tweens.add({
            targets: p, y: sl.cy + 5, duration: 220, ease: 'Quad.easeOut', onUpdate: place,
            onComplete: () => s.tweens.add({ targets: p, y: -80, duration: 520, ease: 'Cubic.easeIn', onUpdate: place, onComplete: () => done && done() })
        });
        // engine flares up: show the glow bigger
        s.tweens.add({ targets: sl.glow, scale: 2.2, duration: 400, delay: 200 });
        return sl;
    }

    destroy() {
        this.ring.destroy(); this.ringGlow.destroy();
        this.slots.forEach((sl) => [sl.ship, sl.flame, sl.glow, sl.label, sl.under, sl.hit, sl.lock].forEach((o) => o.destroy()));
    }
}
