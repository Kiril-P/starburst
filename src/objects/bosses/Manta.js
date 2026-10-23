// MID-BOSS: THE MANTA -- a wraith ray that blinks around the screen. Two phases.
// P1: blink (fades out, an amber ring marks where it will appear, arrival ring burst), curving wing streams,
//     aimed fans from the mouth.
// P2: blinks chain, and a "wake" pass that seeds slow mines which drift down and speed up.
import { W } from '../../config.js';
import Boss from './Boss.js';
import { S, muzzleFans, rings } from './attacks.js';

const WING_X = 34, WING_Y = 6, MOUTH_Y = 18;
const OUT_MS = 260, WAIT_MS = 760;

export const MANTA = { id: 'manta', kind: 'mini', name: 'MANTA', title: 'VOID WRAITH', hp: 850, phases: [0.5], homeY: 70, bonus: 6500, enterMs: 1800 };

export default class Manta extends Boss {
    constructor(game, opts) {
        super(game, MANTA, opts);
        this.hull = this.part('boss_manta');
        this.target(0, 2, 9, 1.25);
        this.target(-22, 2, 10, 0.8);
        this.target(22, 2, 10, 0.8);
        this.blink = null;
        this.pass = null;
        this.sync();
    }

    move(dt) {
        if (this.blink) return this.updateBlink(dt);
        if (this.pass) {
            const p = this.pass;
            p.t += dt;
            const k = Math.min(1, p.t / p.ms);
            this.x = p.x0 + (p.x1 - p.x0) * k;
            this.y = this.homeY + Math.sin(k * Math.PI) * 18;
            if (k >= 1) { this.pass = null; this.homeX = this.x; }
            return;
        }
        const t = this.age / 1000, hx = this.homeX ?? W / 2;
        this.x = hx + Math.sin(t * 0.7) * 40;
        this.y = this.homeY + Math.sin(t * 1.4) * 8;
    }

    /** the ray is gone (and can't be hit) between fading out and reappearing at the marked spot */
    updateBlink(dt) {
        const b = this.blink;
        b.t += dt;
        const gone = b.t > OUT_MS && b.t < OUT_MS + WAIT_MS;
        // stepped dissolve: flicker while leaving / arriving instead of an alpha fade
        const flick = (b.t < OUT_MS || (b.t > OUT_MS + WAIT_MS && b.t < OUT_MS * 2 + WAIT_MS)) && ((b.t / 50) | 0) & 1;
        this.hull.setVisible(!gone && !flick);
        for (const t of this.targets) t.alive = !gone;   // nothing to shoot (or ram) while it's away
        this.shut = b.t > OUT_MS * 0.5;
        if (b.t > OUT_MS && !b.moved) { b.moved = true; this.x = b.x; this.y = b.y; this.homeX = b.x - Math.sin(this.age / 1000 * 0.7) * 40; }
        if (b.t > OUT_MS + WAIT_MS && !b.burst) { b.burst = true; this.arrive(); }
        if (b.t > OUT_MS * 2 + WAIT_MS) this.endBlink();
    }

    arrive() {
        this.g.fx.shockwave(this.x, this.y, 0xff43c8, 1);
        rings(this, { times: this.phase ? 2 : 1, every: 300, count: 18, speed: 0.5 });
    }

    endBlink() {
        this.blink = null; this.shut = false;
        this.hull.setVisible(true);
        for (const t of this.targets) t.alive = true;
    }

    onPhase() { this.hull.anims.timeScale = 1.6; if (this.blink) this.endBlink(); }

    attacks(p) {
        if (p === 0) return [this.blinkTo, this.wings, this.mouth, this.blinkTo, this.wings];
        return [this.blinkTo, this.wake, this.blinkTo, this.wings, this.mouth];
    }

    blinkTo() {
        // never reappear on top of the player: pick a spot in the upper band, away from their column
        const px = this.c.px;
        let x = 80 + Math.random() * (W - 160);
        if (Math.abs(x - px) < 90) x = px < W / 2 ? Math.min(W - 70, px + 140) : Math.max(70, px - 140);
        const y = 56 + Math.random() * 50;
        this.blink = { t: 0, x, y, moved: false, burst: false };
        this.warn.ring(OUT_MS + WAIT_MS, { x, y, r: 34 });
        this.g.audio.play('phase-shift', { vol: 0.5, rate: 1.3 });
        return OUT_MS * 2 + WAIT_MS + (this.phase ? 500 : 900);
    }

    /** streams from both wingtips that curl inward (turn), crossing under the ray */
    wings() {
        const steps = this.n(this.phase ? 24 : 18);
        this.repeat(90, steps, (i, x, y) => {
            for (const s of [-1, 1]) {
                const a = Math.PI / 2 + s * (0.9 - i * 0.012);
                this.pool.spawn(x + s * WING_X, y + WING_Y, a, this.sp(0.75), i & 1 ? S.orbS : S.ring, { damage: this.dmg, turn: -s * 0.55 });
            }
            if (i % 3 === 0) this.sfx();
        });
        return steps * 90 + 900;
    }

    mouth() { return muzzleFans(this, [[0, MOUTH_Y]], { volleys: 3, count: this.phase ? 7 : 5, spread: 50, speed: 0.9, style: S.orbM }) + 1000; }

    /** fly a pass across the top seeding mines that hang, then drift down and accelerate */
    wake() {
        const ms = 2000, x1 = this.x < W / 2 ? W - 80 : 80;
        this.pass = { t: 0, ms, x0: this.x, x1 };
        this.repeat(150, Math.round(ms / 150), (i, x, y) => {
            this.pool.spawn(x, y + 10, Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, S.orbL, { damage: this.dmg, accel: this.sp(0.35), maxSpeed: this.sp(1.0) });
            if (i % 3 === 0) this.sfx();
        });
        return ms + 1000;
    }
}
