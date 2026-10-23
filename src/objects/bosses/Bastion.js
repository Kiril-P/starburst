// MID-BOSS: THE BASTION -- siege platform. Two phases.
// P1: mortar shells from the three tubes (amber target rings), a telegraphed beam that sweeps a wedge around the
//     player (with regular breaks), and a falling needle grid with an opening near the player.
// P2: more shells, a double sweep, grids of two offset rows.
import { W } from '../../config.js';
import { DEG, angleTo } from '../patterns.js';
import Boss from './Boss.js';
import { S, mortars, hWall, gapNear } from './attacks.js';

const LENS_Y = 13;
const TUBES = [[-9, -22], [0, -24], [9, -22]];
const SWEEP = 34 * DEG;   // half-width of the beam's wedge

export const BASTION = { id: 'bastion', kind: 'mini', name: 'BASTION', title: 'SIEGE PLATFORM', hp: 950, phases: [0.5], homeY: 62, bonus: 6000, enterMs: 1800 };

export default class Bastion extends Boss {
    constructor(game, opts) {
        super(game, BASTION, opts);
        this.hull = this.part('boss_bastion');
        this.target(0, LENS_Y, 8, 1.25);      // the beam lens
        this.target(0, -6, 14);
        this.target(-30, 3, 10, 0.8);
        this.target(30, 3, 10, 0.8);
        this.sync();
    }

    move(dt) {
        if (this.anchored > 0) { this.anchored -= dt; return; }   // braced while the beam fires
        const t = this.age / 1000;
        this.x = W / 2 + Math.sin(t * 0.3) * 140;
        this.y = this.homeY + Math.sin(t * 0.8) * 3;
    }

    onPhase() { this.hull.anims.timeScale = 1.7; }

    attacks(p) {
        if (p === 0) return [this.shells, this.sweep, this.grid, this.shells, this.sweep];
        return [this.sweep, this.shells, this.grid, this.sweep, this.shells];
    }

    shells() { return mortars(this, { shots: this.phase ? 5 : 3, ms: 1000, count: 10, from: TUBES }) + 1100; }

    grid() {
        const y = this.y + 30, c = this.c;
        let ms = hWall(this, { y, gapX: gapNear(c.px, 50, W - 50, 90), gap: 70, spacing: 12 });
        if (this.phase) this.after(900, () => hWall(this, { y, gapX: gapNear(c.px, 50, W - 50, 110), gap: 66, spacing: 12, warnMs: 800 }));
        return ms + (this.phase ? 2600 : 1600);
    }

    /**
     * Beam: amber lines mark both edges of a wedge centred on the player, then a needle stream sweeps across it.
     * Every 7th beat is skipped so the beam has slots you can cut through; stepping out of the wedge also works.
     */
    sweep() {
        const warn = 1000, steps = 36, every = 48;
        const x0 = this.x, y0 = this.y + LENS_Y;
        const mid = angleTo(x0, y0, this.c.px, this.c.py);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const a0 = mid - dir * SWEEP, a1 = mid + dir * SWEEP;
        this.anchored = warn + steps * every + 300;
        this.warn.line(warn, { x: x0, y: y0, a: a0 });
        this.warn.line(warn, { x: x0, y: y0, a: a1 });
        this.g.audio.play('forcefield', { vol: 0.35, rate: 1.6 });
        const fire = (from, to) => this.repeat(every, steps, (i, x, y) => {
            if (i % 7 === 6) return;
            const a = from + ((to - from) * i) / (steps - 1);
            this.pool.spawn(x, y + LENS_Y, a, this.sp(1.7), S.needleM, { damage: this.dmg });
            if (i % 4 === 0) this.sfx();
        });
        this.after(warn, () => fire(a0, a1));
        // phase 2: it sweeps back once
        if (this.phase) {
            this.anchored += steps * every + 200;
            this.after(warn + steps * every + 200, () => fire(a1, a0));
        }
        return this.anchored + 900;
    }
}
