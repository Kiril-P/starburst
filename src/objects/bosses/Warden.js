// THE WARDEN -- armoured dreadnought. Twin wing cannons + a core eye.
// P1: aimed needle fans from the pods, rotating orb rings from the core.
// P2: telegraphed broadside (two needle lanes rake down from the pods) + ring/aimed mix.
// P3: counter-rotating core spirals and telegraphed prow lances aimed at the player.
import { W, DEPTH } from '../../config.js';
import { aimed, fan, ring, lance, style, angleTo, DEG, TAU } from '../patterns.js';
import Boss from './Boss.js';

const ORB_M = style('orbM', 'magenta');
const ORB_S = style('orbS', 'magenta');
const RING = style('ring', 'magenta');
const NEEDLE = style('needle', 'amber');
const NEEDLE_M = style('needle', 'magenta');

const POD_X = 42, POD_Y = 20, CORE_Y = -5, PROW_Y = 32;

export const WARDEN = { name: 'THE WARDEN', title: 'DREADNOUGHT', hp: 1400, phases: [0.66, 0.33], homeY: 72, bonus: 15000 };

export default class Warden extends Boss {
    constructor(game, opts) {
        super(game, WARDEN, opts);
        this.hull = this.part('boss_warden', 0, 0, DEPTH.ENEMY);
        this.target(0, CORE_Y, 11, 1.25);       // the eye: weak point
        this.target(0, 16, 13);
        this.target(-POD_X, 6, 12, 0.8);
        this.target(POD_X, 6, 12, 0.8);
        this.spin = 0;
        this.sync();
    }

    move(dt) {
        const t = this.age / 1000, fast = this.phase >= 2 ? 1.5 : 1;
        if (this.anchored > 0) { this.anchored -= dt; return; }   // holds still while a broadside rakes down
        this.x = W / 2 + Math.sin(t * 0.42 * fast) * 110;
        this.y = this.homeY + Math.sin(t * 0.9) * 6;
    }

    onPhase(p) { this.hull.anims.timeScale = 1 + p * 0.75; }

    attacks(p) {
        if (p === 0) return [this.podFans, this.coreRings, this.podFans, this.coreRings];
        if (p === 1) return [this.broadside, this.coreRings, this.podFans, this.prowBurst];
        return [this.spiral, this.lances, this.broadside, this.lances];
    }

    // --- attacks (each returns the pause before the next) -------------------------------------------------
    podFans() {
        const c = this.c, o = { speed: this.sp(0.95), style: NEEDLE, damage: this.dmg, count: this.n(this.phase ? 5 : 3), spread: this.phase ? 40 : 26 };
        this.repeat(240, this.phase ? 4 : 3, (i, x, y) => {
            for (const s of [-1, 1]) {
                const px = x + s * POD_X, py = y + POD_Y;
                fan(this.pool, px, py, angleTo(px, py, c.px, c.py), o);
            }
            this.sfx();
        });
        return 1500;
    }

    coreRings() {
        const k = this.n(this.phase ? 20 : 16);
        const off = Math.random() * TAU;
        this.repeat(360, 3, (i, x, y) => {
            ring(this.pool, x, y + CORE_Y, { speed: this.sp(0.6), style: i & 1 ? RING : ORB_M, damage: this.dmg, count: k, offset: off + (i * Math.PI) / k });
            this.sfx();
        });
        return 1700;
    }

    prowBurst() {
        const c = this.c;
        this.repeat(130, 5, (i, x, y) => {
            aimed(this.pool, x, y + PROW_Y, c.px, c.py, { speed: this.sp(1.15), style: ORB_S, damage: this.dmg, offset: (i - 2) * 4 * DEG });
            this.sfx();
        });
        return 1100;
    }

    /** two amber lanes under the pods, then a rake of needles down them */
    broadside() {
        const ms = 950;
        this.anchored = ms + 1700;
        for (const s of [-1, 1]) this.warn.lane(ms, { x: this.x + s * POD_X, y: this.y + POD_Y + 6, w: 22 });
        this.g.fx.flash(0xffb547, 0.08, 120);
        this.after(ms, () => {
            const n = this.n(24);
            this.repeat(65, n, (i, x, y) => {
                for (const s of [-1, 1]) {
                    const jit = (Math.random() - 0.5) * 6 * DEG;
                    this.pool.spawn(x + s * POD_X + (Math.random() - 0.5) * 8, y + POD_Y, Math.PI / 2 + jit, this.sp(1.5), NEEDLE, { damage: this.dmg });
                }
                if (i % 4 === 0) this.sfx();
            });
            this.g.fx.shake(1, 300);
        });
        return ms + 2000;
    }

    /** counter-rotating twin spiral from the eye */
    spiral() {
        const steps = this.n(34), dir = this.spin++ & 1 ? -1 : 1;
        this.repeat(85, steps, (i, x, y) => {
            const a = dir * i * 13 * DEG;
            ring(this.pool, x, y + CORE_Y, { speed: this.sp(0.62), style: RING, damage: this.dmg, count: 4, offset: a });
            if (i & 1) ring(this.pool, x, y + CORE_Y, { speed: this.sp(0.45), style: ORB_S, damage: this.dmg, count: 4, offset: -a + Math.PI / 4 });
            if (i % 3 === 0) this.sfx();
        });
        return steps * 85 + 900;
    }

    /** three telegraphed lances from the prow: the middle one is aimed at where the player is now */
    lances() {
        const ms = 820;
        const x0 = this.x, y0 = this.y + PROW_Y;
        const a = angleTo(x0, y0, this.c.px, this.c.py);
        const angles = [a - 24 * DEG, a, a + 24 * DEG];
        this.anchored = ms + 400;
        for (const an of angles) this.warn.line(ms, { x: x0, y: y0, a: an });
        this.after(ms, () => {
            for (const an of angles) lance(this.pool, x0, y0, an, { count: this.n(12), speed: this.sp(1.1), speedMax: this.sp(2.3), style: NEEDLE_M, damage: this.dmg });
            this.g.fx.shake(2, 160);
            this.sfx();
        });
        return ms + 1100;
    }
}
