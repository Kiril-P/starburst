// Pooled pickup sprites: spawn burst -> drag -> slow drift toward the ship's side of the screen (stopping above
// the HUD strip so nothing becomes unreachable) -> magnet pull -> collect. Blink before expiring.
// Only motion and pooling live here; what a pickup DOES is Loot.collect (passed in as onCollect).
// Runs on simulation dt, so pause / hit-stop / slow-mo freeze pickups with everything else.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { PICKUPS, PICKUP_MOTION as M } from '../../systems/loot.js';

const GLOWS = 10;

export default class Pickups {
    constructor(scene, size, onCollect) {
        this.scene = scene;
        this.onCollect = onCollect;
        this.free = [];
        this.live = [];
        this.magnetAll = false;      // MAGNET power-up: everything on screen flies in
        for (let i = 0; i < size; i++) {
            const s = scene.add.sprite(-99, -99, 'gem_s', 0).setDepth(DEPTH.PICKUP).setVisible(false).setActive(false);
            s.alive = false;
            this.free.push(s);
        }
        // dithered halo under capsules (few at a time): makes power-ups pop out of the bullet soup
        this.glows = [];
        for (let i = 0; i < GLOWS; i++) {
            this.glows.push(scene.add.image(-99, -99, 'glow_s').setDepth(DEPTH.PICKUP - 1).setTint(COLORS.L).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
        }
    }

    get count() { return this.live.length; }

    countKind(kind) {
        let n = 0;
        for (const p of this.live) if (p.alive && p.def.kind === kind) n++;
        return n;
    }

    /** type: key of PICKUPS. Returns the pickup or null when the pool is dry. */
    spawn(type, x, y, vx = 0, vy = 0) {
        const p = this.free.pop();
        if (!p) return null;
        const def = PICKUPS[type];
        p.def = def; p.type = type; p.alive = true;
        p.px = x; p.py = y; p.vx = vx; p.vy = vy;
        p.mag = false; p.ms = 0;
        p.life = M.lifeMs[def.kind];
        p.setTexture(def.key, 0).setPosition(Math.round(x), Math.round(y)).setVisible(true).setActive(true).setAlpha(1);
        if (this.scene.anims.exists(def.key)) p.play({ key: def.key, startFrame: (Math.random() * 2) | 0 });
        p.glow = def.kind === 'gem' ? null : this.glows.find((g) => !g.used) || null;   // `used`, not visible: blinking hides it
        if (p.glow) { p.glow.used = true; p.glow.setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(0.35); }
        this.live.push(p);
        return p;
    }

    /** wave clear: pull every gem / repair to the ship so nothing is lost behind the upgrade screen */
    vacuum() {
        for (const p of this.live) if (p.alive && (p.def.kind === 'gem' || p.def.kind === 'repair')) p.mag = true;
    }

    update(dt, player) {
        const s = dt / 1000;
        const live = this.live;
        const canTake = player.alive;
        const floor = H - M.floorY;
        const blinkMs = M.blinkMs;
        for (let i = live.length - 1; i >= 0; i--) {
            const p = live[i];
            if (p.alive) this.step(p, s, dt, player, canTake, floor, blinkMs);
            if (!p.alive) {
                live[i] = live[live.length - 1];
                live.pop();
                this.free.push(p);
            }
        }
    }

    step(p, s, dt, pl, canTake, floor, blinkMs) {
        const dx = pl.x - p.px, dy = pl.y - p.py, d2 = dx * dx + dy * dy;
        if (canTake && !p.mag) {
            const R = this.magnetAll ? 9999 : p.def.kind === 'gem' || p.def.kind === 'repair' ? M.magnetR : M.capsuleMagnetR;
            if (d2 < R * R) p.mag = true;
        }
        if (p.mag && canTake) {
            // accelerating homing pull: starts gentle so the pickup visibly "notices" the ship, then snaps in
            p.ms = Math.min(M.magnetSpeed, p.ms + 900 * s);
            const d = Math.sqrt(d2) || 1;
            p.vx = (dx / d) * (p.ms + 40); p.vy = (dy / d) * (p.ms + 40);
        } else {
            const k = Math.exp(-M.drag * s);
            p.vx *= k;
            p.vy = M.fall + (p.vy - M.fall) * k;
            if (p.py >= floor && p.vy > 0) p.vy = 0;
        }
        p.px += p.vx * s; p.py += p.vy * s;
        if (p.px < 6) p.px = 6; else if (p.px > W - 6) p.px = W - 6;
        if (p.py < -20) p.py = -20;
        const r = M.collectR + p.def.r;
        if (canTake && d2 < r * r) { this.onCollect(p); this.kill(p); return; }
        p.life -= p.mag ? 0 : dt;
        if (p.life <= 0) { this.kill(p); return; }
        const x = Math.round(p.px), y = Math.round(p.py);
        p.setPosition(x, y);
        p.setVisible(p.life > blinkMs || ((p.life / 90) | 0) % 2 === 0);
        if (p.glow) p.glow.setPosition(x, y).setVisible(p.visible);
    }

    kill(p) {
        if (!p.alive) return;
        p.alive = false;
        p.stop();
        p.setVisible(false).setActive(false);
        if (p.glow) { p.glow.used = false; p.glow.setVisible(false); p.glow = null; }
    }

    clear() { for (const p of this.live) this.kill(p); }

    destroy() {
        for (const p of this.free) p.destroy();
        for (const p of this.live) p.destroy();
        for (const g of this.glows) g.destroy();
        this.free.length = this.live.length = 0;
    }
}
