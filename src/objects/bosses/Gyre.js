// MID-BOSS: THE GYRE -- a spinning saw disc. Two phases.
// P1: twin spirals, curving "saw" rings, and a telegraphed plunge down an amber lane (contact hurts).
// P2: spins faster; triple spirals, double plunges that burst on the turn, saw rings with an aimed fan.
import { W, H } from '../../config.js';
import { fan, angleTo } from '../patterns.js';
import Boss from './Boss.js';
import { S, spiral, rings } from './attacks.js';

// the lane must cover the whole contact zone: rim radius 22 + player hitbox 3 + ram slack 2 = 27 px each side
const LANE_W = 58;
const DIVE_MS = 520, RISE_MS = 760;

export const GYRE = { id: 'gyre', kind: 'mini', name: 'GYRE', title: 'SAWBLADE', hp: 850, phases: [0.5], homeY: 78, bonus: 5500, enterMs: 1800 };

export default class Gyre extends Boss {
    constructor(game, opts) {
        super(game, GYRE, opts);
        this.hull = this.part('boss_gyre');
        this.target(0, 0, 10, 1.25);      // the eye
        this.target(0, 0, 22);            // the rim (outer ring of the disc; inner circle is checked first)
        this.dive = null;
        this.spin = 0;
        this.sync();
    }

    move(dt) {
        const d = this.dive;
        if (d) {
            d.t += dt;
            if (d.t < d.wait) return;                                   // hovering over the lane, telegraph running
            const t = d.t - d.wait;
            if (t < DIVE_MS) this.y = d.y0 + (d.y1 - d.y0) * (t / DIVE_MS) ** 2;    // accelerate down
            else if (t < DIVE_MS + RISE_MS) {
                if (!d.hit) { d.hit = true; this.bottomBurst(); }
                const k = (t - DIVE_MS) / RISE_MS;
                this.y = d.y1 + (d.y0 - d.y1) * (1 - (1 - k) ** 2);
            } else { this.y = d.y0; this.dive = null; }
            return;
        }
        const t = this.age / 1000;
        const tx = W / 2 + Math.sin(t * 0.5) * 150;
        this.x += (tx - this.x) * Math.min(1, dt / 500);
        this.y += (this.homeY + Math.sin(t * 1.7) * 6 - this.y) * Math.min(1, dt / 400);
    }

    onPhase() { this.hull.anims.timeScale = 1.8; }

    attacks(p) {
        if (p === 0) return [this.twin, this.saw, this.plunge, this.twin, this.saw];
        return [this.plunge, this.triple, this.saw, this.plunge, this.sawFan];
    }

    twin() { return spiral(this, { arms: 2, steps: 30, every: 80, rot: 13, speed: 0.6, dir: this.spin++ & 1 ? -1 : 1 }) + 900; }
    triple() { return spiral(this, { arms: 3, steps: 34, every: 75, rot: 12, speed: 0.62, style: S.ring, dir: this.spin++ & 1 ? -1 : 1 }) + 800; }

    /** rings whose bullets curve as they fly: the screen reads as a turning saw blade */
    saw() { return rings(this, { times: 3, every: 420, count: 14, speed: 0.5, turn: 0.55 }) + 900; }

    sawFan() {
        const c = this.c;
        this.repeat(300, 3, (i, x, y) => fan(this.pool, x, y + 18, angleTo(x, y, c.px, c.py), { speed: this.sp(1.0), style: S.orbM, damage: this.dmg, count: this.n(5), spread: 40 }));
        return this.saw();
    }

    /** lock onto the player's column, amber lane, then drop down it and rise back; phase 2 does two in a row */
    plunge() {
        const x = Math.max(40, Math.min(W - 40, this.c.px)), wait = 950;
        this.dive = { t: 0, wait, y0: this.y, y1: H - 30, hit: false };
        this.glideTo = x;   // the lane is drawn where it will drop; animate() glides over it first
        this.warn.lane(wait, { x, y: this.y + 24, w: LANE_W });
        this.after(wait * 0.4, () => this.g.audio.play('dash-alt', { vol: 0.5, rate: 0.6 }));
        if (this.phase) this.after(wait + DIVE_MS + RISE_MS + 150, () => { if (this.state === 'fight' && !this.dive) this.plungeAgain(); });
        return wait + DIVE_MS + RISE_MS + (this.phase ? 2600 : 900);
    }

    plungeAgain() {
        const x = Math.max(40, Math.min(W - 40, this.c.px)), wait = 750;
        this.dive = { t: 0, wait, y0: this.y, y1: H - 30, hit: false };
        this.glideTo = x;
        this.warn.lane(wait, { x, y: this.y + 24, w: LANE_W });
    }

    animate(dt) {
        // slide over the lane while the telegraph runs (fast, so the drop happens where the lane says)
        if (this.dive && this.dive.t < this.dive.wait && this.glideTo !== undefined) this.x += (this.glideTo - this.x) * Math.min(1, dt / 120);
    }

    bottomBurst() {
        this.g.fx.shake(2, 220);
        this.g.fx.explosion(this.x, this.y + 20, 's', 'magenta');
        const n = this.n(this.phase ? 14 : 10);
        for (let i = 0; i < n; i++) {
            const a = Math.PI + (i / (n - 1)) * Math.PI;           // upward half ring: never straight at a player below
            this.pool.spawn(this.x, this.y - 8, a, this.sp(0.55), S.orbS, { damage: this.dmg });
        }
        this.sfx();
    }
}
