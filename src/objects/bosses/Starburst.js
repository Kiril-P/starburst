// THE STARBURST -- final boss at the end of sector 4 (wave 20). Four phases built from the other bosses' attacks,
// remixed around a star-shaped core, plus its own signature SUPERNOVA.
// P1 AWAKENING   (Warden): aimed needle fans from the ray tips, core rings, telegraphed lances.
// P2 BROOD STORM (Hive/Prism): four star nodes deploy and orbit: pinwheel streams, node beams, mortars.
// P3 TEMPEST     (Tempest/Colossus): beam walls with gaps, a gravity well, hammer lanes, pinwheels.
// P4 SUPERNOVA: the core charges inside a huge amber ring, then fills the screen with breathing spiral arms and
//    aimed-gap rings; between novas it recycles the rest of its arsenal.
import { W, H, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { ring } from '../patterns.js';
import Boss from './Boss.js';
import GravityWell from './GravityWell.js';
import { S, muzzleFans, rings, lances, mortars, hWall, vWall, hammer, gapNear } from './attacks.js';

const NODES = 4, TIPS = [[-48, 4], [48, 4], [0, 50]];
const F_IDLE = 0, F_PULSE = 1, F_NOVA = 2;

export const STARBURST = {
    id: 'starburst', kind: 'final', name: 'THE STARBURST', title: 'HEART OF THE SECTOR', hp: 3200, phases: [0.75, 0.5, 0.25], density: 1.5, damage: 1.65,
    homeY: 98, bonus: 50000, enterMs: 5200, phaseNames: ['AWAKENING', 'BROOD STORM', 'TEMPEST', 'SUPERNOVA']
};

export default class Starburst extends Boss {
    constructor(game, opts) {
        super(game, STARBURST, opts);
        this.core = this.part('boss_starburst', 0, 0, DEPTH.ENEMY);
        this.nodes = [];
        for (let i = 0; i < NODES; i++) this.nodes.push(this.part('boss_star_node', 0, 0, DEPTH.ENEMY + 1).setVisible(false));
        this.target(0, 0, 16, 1.25);
        this.target(0, 0, 28);
        this.orbA = 0; this.orbW = 0.8; this.orbR = 0;      // node orbit (radius grows when they deploy)
        this.charging = false;
        this.side = 1;
        this.sync();
    }

    nodeAngle(k) { return this.orbA + (k * Math.PI * 2) / NODES; }

    move(dt) {
        const t = this.age / 1000, k = this.phase >= 3 ? 0.5 : 1;    // it slows down while it goes nova
        if (this.charging) return;
        this.x = W / 2 + Math.sin(t * 0.3) * 110 * k;
        this.y = this.homeY + Math.sin(t * 0.7) * 8;
        this.orbA += (this.orbW * dt) / 1000;
    }

    animate(dt) {
        const want = this.phase >= 1 ? 70 : 0;
        this.orbR += (want - this.orbR) * Math.min(1, dt / 500);
        for (let k = 0; k < NODES; k++) {
            const a = this.nodeAngle(k), s = this.nodes[k];
            s.dx = Math.round(Math.cos(a) * this.orbR); s.dy = Math.round(Math.sin(a) * this.orbR);
            s.setVisible(this.orbR > 8 && this.state !== 'dead');
        }
        const f = this.charging ? F_NOVA : ((this.age / (this.phase >= 2 ? 170 : 300)) | 0) & 1 ? F_PULSE : F_IDLE;
        if (this.core.frame.name !== f) this.core.setFrame(f);
    }

    onPhase(p) {
        this.charging = false;
        this.clearProps();
        this.orbW = 0.8 + p * 0.2;
        if (p === 1) this.g.fx.shockwave(this.x, this.y, COLORS.M, 2);
    }

    attacks(p) {
        if (p === 0) return [this.tipFans, this.coreRings, this.lance3, this.tipFans, this.coreRings];
        if (p === 1) return [this.pinwheel, this.nodeBeams, this.shells, this.pinwheel, this.tipFans];
        if (p === 2) return [this.fallWall, this.well, this.pinwheel, this.slam, this.sweepWall, this.tipFans];
        return [this.supernova, this.nodeBeams, this.fallWall, this.tipFans, this.supernova, this.shells, this.pinwheel];
    }

    // --- remixed arsenal ------------------------------------------------------------------------------------
    tipFans() { return muzzleFans(this, TIPS, { volleys: 3, count: this.phase ? 5 : 3, spread: 30 }) + 900; }
    coreRings() { return rings(this, { times: 3, every: 380, count: 18, speed: 0.55 }) + 1000; }
    lance3() { return lances(this, { dy: 50, count: 3, spreadDeg: 22 }) + 1100; }
    shells() { return mortars(this, { shots: this.phase >= 3 ? 5 : 4, count: 10, from: this.nodeOffsets() }) + 1000; }
    slam() { return hammer(this, [this.x - 60, this.x + 60], { y: this.y + 40, count: 14 }) + 800; }

    fallWall() { return hWall(this, { y: this.y + 56, gapX: gapNear(this.c.px, 40, W - 40), gap: 62 }) + 1500; }
    sweepWall() {
        const y0 = this.y + 60;
        return vWall(this, { dir: (this.side = -this.side), y0, y1: H - 26, gapY: gapNear(this.c.py, y0 + 36, H - 56, 70), gap: 60 }) + 2000;
    }

    well() {
        const c = this.c, side = c.px < W / 2 ? 1 : -1;
        const x = Math.max(60, Math.min(W - 60, c.px + side * 110)), y = Math.max(150, Math.min(H - 90, c.py - 50));
        this.warn.ring(900, { x, y, r: 30 });
        this.after(900, () => { if (!this.props.length) this.prop(new GravityWell(this, x, y, { life: 6000, pull: 52, ringEvery: 1400 })); });
        return 2400;
    }

    nodeOffsets() { return Array.from({ length: NODES }, (_, k) => [Math.cos(this.nodeAngle(k)) * this.orbR, Math.sin(this.nodeAngle(k)) * this.orbR]); }

    /** each node streams orbs outward; the orbit turns them into a pinwheel (Prism) */
    pinwheel() {
        const steps = this.n(24), every = 90;
        this.repeat(every, steps, (i, x, y) => {
            for (let k = 0; k < NODES; k++) {
                const a = this.nodeAngle(k);
                this.pool.spawn(x + Math.cos(a) * this.orbR, y + Math.sin(a) * this.orbR, a + 0.4, this.sp(0.55), i & 1 ? S.orbS : S.ring, { damage: this.dmg });
            }
            if (i % 3 === 0) this.sfx();
        });
        return steps * every + 800;
    }

    /** amber headings from the nodes, then needle beams along them while the orbit slows (Prism) */
    nodeBeams() {
        const warn = 1000, dur = 2000, every = 55;
        const w0 = this.orbW;
        this.orbW = 0.45;
        for (let k = 0; k < NODES; k++) {
            this.warn.line(warn, { follow: (it) => { const a = this.nodeAngle(k); it.a = a; it.x = this.x + Math.cos(a) * (this.orbR + 8); it.y = this.y + Math.sin(a) * (this.orbR + 8); } });
        }
        this.after(warn, () => this.repeat(every, Math.round(dur / every), (i, x, y) => {
            for (let k = 0; k < NODES; k++) {
                const a = this.nodeAngle(k);
                this.pool.spawn(x + Math.cos(a) * (this.orbR + 6), y + Math.sin(a) * (this.orbR + 6), a, this.sp(1.6), S.needleM, { damage: this.dmg });
            }
            if (i % 5 === 0) this.sfx();
        }));
        this.after(warn + dur + 100, () => { this.orbW = w0; });
        return warn + dur + 1000;
    }

    // --- signature ---------------------------------------------------------------------------------------------
    /** charge (white-hot core inside a closing amber ring), then breathing spiral arms + rings with an aimed gap */
    supernova() {
        const charge = 1500, dur = 6400, every = 95, arms = 10;
        this.charging = true;
        this.warn.ring(charge, { r: 110, follow: (it) => { it.x = this.x; it.y = this.y; } });
        this.g.fx.flash(COLORS.A, 0.12, 200);
        this.g.fx.shake(1, charge);
        this.g.audio.play('boss-stinger', { vol: 0.8 });
        this.after(charge, () => {
            this.charging = false;
            const g = this.g;
            g.fx.flash(COLORS.w, 0.4, 260);
            g.fx.shockwave(this.x, this.y, COLORS.w, 3);
            g.fx.shockwave(this.x, this.y, COLORS.M, 2);
            g.bg.pulse(1);
            g.audio.play('boss-explosion', { vol: 0.6 });
            let a = Math.random() * Math.PI * 2;
            const steps = Math.round(dur / every), k = this.n(arms);
            this.repeat(every, steps, (i, x, y) => {
                // arm rotation speed swings back and forth, so the arms bend into S-curves instead of a plain spiral
                a += Math.sin(i * 0.09) * 0.16;
                ring(this.pool, x, y, { speed: this.sp(0.68), style: i & 1 ? S.orbM : S.orbS, damage: this.dmg, count: k, offset: a });
                if (i % 10 === 5) this.gapRing(x, y);
                if (i % 3 === 0) this.sfx();
            });
        });
        return charge + dur + 1400;
    }

    /** a ring of hollow bullets with a 5-bullet hole facing the player */
    gapRing(x, y) {
        const n = 36, aim = Math.atan2(this.c.py - y, this.c.px - x), step = (Math.PI * 2) / n;
        for (let i = 3; i <= n - 3; i++) this.pool.spawn(x, y, aim + i * step, this.sp(0.5), S.ring, { damage: this.dmg });
    }
}
