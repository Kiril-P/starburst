// THE PRISM -- an armoured eye with four crystal shards in orbit. The eye only takes damage while open.
// P1: pinwheel streams from the orbiting shards, aimed orb fans from the eye.
// P2: the eye shuts, amber lines mark the shards' headings, then four rotating needle beams sweep the screen.
// P3: faster, wider orbit; beams + counter spirals; telegraphed NOVA (charge frame -> huge ring burst).
import { W, DEPTH } from '../../config.js';
import { fan, ring, style, angleTo, DEG, TAU } from '../patterns.js';
import Boss from './Boss.js';

const ORB_S = style('orbS', 'magenta');
const ORB_M = style('orbM', 'magenta');
const ORB_L = style('orbL', 'magenta');
const RING = style('ring', 'magenta');
const NEEDLE_M = style('needle', 'magenta');
const SHARDS = 4;
const F_OPEN = 0, F_PULSE = 1, F_CHARGE = 2, F_SHUT = 3;

export const PRISM = { id: 'prism', kind: 'main', name: 'THE PRISM', title: 'EYE OF THE VOID', hp: 1500, phases: [0.66, 0.33], homeY: 96, bonus: 18000 };

export default class Prism extends Boss {
    constructor(game, opts) {
        super(game, PRISM, opts);
        this.eye = this.part('boss_prism', 0, 0, DEPTH.ENEMY);
        this.shards = [];
        for (let i = 0; i < SHARDS; i++) this.shards.push(this.part('boss_prism_shard', 0, 0, DEPTH.ENEMY + 1));
        this.target(0, 0, 16, 1);
        this.orbA = 0;          // orbit angle of shard 0
        this.orbW = 0.9;        // rad/s
        this.orbR = 50;
        this.shut = false;
        this.charging = false;
        this.placeShards();
        this.sync();
    }

    shardAngle(k) { return this.orbA + (k * TAU) / SHARDS; }

    placeShards() {
        for (let k = 0; k < SHARDS; k++) {
            const a = this.shardAngle(k), s = this.shards[k];
            s.dx = Math.round(Math.cos(a) * this.orbR);
            s.dy = Math.round(Math.sin(a) * this.orbR);
        }
    }

    move(dt) {
        const t = this.age / 1000;
        this.x = W / 2 + Math.sin(t * 0.38) * 80;
        this.y = this.homeY + Math.sin(t * 0.76) * 12;
        this.orbA += (this.orbW * dt) / 1000;
    }

    animate(dt) {
        if (this.state === 'enter') this.orbA += (2.4 * dt) / 1000;      // shards spin up while it arrives
        if (this.phase >= 2) this.orbR = 56 + Math.sin(this.age / 300) * 4;
        this.placeShards();
        const f = this.shut ? F_SHUT : this.charging ? F_CHARGE : ((this.age / (this.phase >= 2 ? 160 : 260)) | 0) & 1 ? F_PULSE : F_OPEN;
        if (this.eye.frame.name !== f) this.eye.setFrame(f);
    }

    onPhase(p) {
        this.shut = false; this.charging = false;
        this.orbW = p >= 2 ? 1.35 : 1.1;
    }

    attacks(p) {
        if (p === 0) return [this.pinwheel, this.eyeFans, this.pinwheel, this.eyeRing];
        if (p === 1) return [this.beams, this.eyeFans, this.pinwheel, this.eyeRing];
        return [this.beams, this.nova, this.pinwheel, this.beams, this.eyeFans];
    }

    /** each shard streams orbs outward; the orbit turns the streams into a spiral */
    pinwheel() {
        const steps = this.n(26), every = 85;
        this.repeat(every, steps, (i, x, y) => {
            for (let k = 0; k < SHARDS; k++) {
                const a = this.shardAngle(k);
                this.pool.spawn(x + Math.cos(a) * this.orbR, y + Math.sin(a) * this.orbR, a + 0.35, this.sp(0.55), i & 1 ? ORB_S : RING, { damage: this.dmg });
            }
            if (i % 3 === 0) this.sfx();
        });
        return steps * every + 700;
    }

    eyeFans() {
        const c = this.c;
        this.repeat(260, 3, (i, x, y) => {
            fan(this.pool, x, y + 6, angleTo(x, y, c.px, c.py), { speed: this.sp(0.95), style: ORB_M, damage: this.dmg, count: this.n(this.phase ? 7 : 5), spread: this.phase ? 70 : 50 });
            this.sfx();
        });
        return 1400;
    }

    eyeRing() {
        const k = this.n(18), off = Math.random() * TAU;
        ring(this.pool, this.x, this.y, { speed: this.sp(0.5), style: ORB_M, damage: this.dmg, count: k, offset: off });
        ring(this.pool, this.x, this.y, { speed: this.sp(0.38), style: RING, damage: this.dmg, count: k, offset: off + Math.PI / k });
        this.sfx();
        return 1300;
    }

    /** eye shuts (armoured), amber headings, then four rotating needle beams */
    beams() {
        const warn = 1000, dur = this.phase >= 2 ? 2600 : 2200, every = 50;
        this.shut = true;
        this.orbW = 0.5;
        for (let k = 0; k < SHARDS; k++) {
            this.warn.line(warn, { follow: (it) => { const a = this.shardAngle(k); it.a = a; it.x = this.x + Math.cos(a) * (this.orbR + 10); it.y = this.y + Math.sin(a) * (this.orbR + 10); } });
        }
        this.g.audio.play('phase-shift', { vol: 0.5, rate: 0.6 });
        this.after(warn, () => {
            this.g.fx.shake(1, dur);
            this.repeat(every, Math.round(dur / every), (i, x, y) => {
                for (let k = 0; k < SHARDS; k++) {
                    const a = this.shardAngle(k);
                    this.pool.spawn(x + Math.cos(a) * (this.orbR + 6), y + Math.sin(a) * (this.orbR + 6), a, this.sp(1.6), NEEDLE_M, { damage: this.dmg });
                }
                // phase 3: a slow counter-spiral from the eye between the beams
                if (this.phase >= 2 && i % 6 === 0) ring(this.pool, x, y, { speed: this.sp(0.4), style: ORB_S, damage: this.dmg, count: 4, offset: -this.orbA * 1.5 + Math.PI / 4 });
                if (i % 5 === 0) this.sfx();
            });
        });
        this.after(warn + dur + 200, () => { this.shut = false; this.orbW = this.phase >= 2 ? 1.35 : 1.1; });
        return warn + dur + 1100;
    }

    /** the eye charges white-hot inside a shrinking amber ring, then bursts */
    nova() {
        const ms = 1100;
        this.charging = true;
        this.warn.ring(ms, { r: 70, follow: (it) => { it.x = this.x; it.y = this.y; } });
        this.g.fx.flash(0xffb547, 0.1, 160);
        this.after(ms, () => {
            this.charging = false;
            const k = this.n(22), off = Math.random() * TAU;
            ring(this.pool, this.x, this.y, { speed: this.sp(0.75), style: ORB_L, damage: this.dmg, count: k, offset: off });
            ring(this.pool, this.x, this.y, { speed: this.sp(0.55), style: ORB_M, damage: this.dmg, count: k, offset: off + Math.PI / k });
            ring(this.pool, this.x, this.y, { speed: this.sp(0.4), style: RING, damage: this.dmg, count: k, offset: off + 5 * DEG });
            this.g.fx.shockwave(this.x, this.y, 0xff43c8, 1.4);
            this.g.fx.shake(2, 220);
            this.g.bg.pulse(0.5);
            this.sfx();
        });
        return ms + 1500;
    }
}
