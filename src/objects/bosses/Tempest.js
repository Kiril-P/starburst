// THE TEMPEST -- the Siren. A crescent of beam emitters around a spiral storm eye.
// P1: falling beam walls with a bracketed gap, emitter fans, eye spirals, one gravity well.
// P2: walls that sweep in from the sides, wells that pulse rings, curving storm spirals.
// P3: crossed walls (one falling, one sweeping), twin wells, faster everything.
import { W, H, DEPTH } from '../../config.js';
import Boss from './Boss.js';
import GravityWell from './GravityWell.js';
import { S, hWall, vWall, gapNear, muzzleFans, spiral } from './attacks.js';

const EMIT_X = 47, EMIT_Y = 17, EYE_Y = -4;
const EMITTERS = [[-EMIT_X, EMIT_Y], [EMIT_X, EMIT_Y]];

export const TEMPEST = { id: 'tempest', kind: 'main', name: 'THE TEMPEST', title: 'STORM SIREN', hp: 2000, phases: [0.66, 0.33], homeY: 64, bonus: 17000 };

export default class Tempest extends Boss {
    constructor(game, opts) {
        super(game, TEMPEST, opts);
        this.hull = this.part('boss_tempest', 0, 0, DEPTH.ENEMY);
        this.target(0, EYE_Y, 12, 1.25);
        this.target(0, 18, 10);
        this.target(-EMIT_X, EMIT_Y, 9, 0.8);
        this.target(EMIT_X, EMIT_Y, 9, 0.8);
        this.spin = 0;
        this.side = 1;
        this.sync();
    }

    move() {
        const t = this.age / 1000, fast = this.phase >= 2 ? 1.4 : 1;
        this.x = W / 2 + Math.sin(t * 0.36 * fast) * 100;
        this.y = this.homeY + Math.sin(t * 0.8) * 7;
    }

    onPhase(p) {
        this.hull.anims.timeScale = 1 + p * 0.6;
        this.clearProps();          // wells collapse on a phase change (the director also clears bullets)
    }

    attacks(p) {
        if (p === 0) return [this.fallWall, this.fans, this.well, this.eye, this.fallWall, this.fans];
        if (p === 1) return [this.sweepWall, this.well, this.storm, this.fallWall, this.fans];
        return [this.crossWalls, this.wells2, this.storm, this.sweepWall, this.fans, this.crossWalls];
    }

    fallWall() {
        const c = this.c, y = this.y + EMIT_Y + 8;
        const warn = hWall(this, { y, gapX: gapNear(c.px, 40, W - 40), gap: this.phase >= 2 ? 58 : 66 });
        this.flashEmitters(warn);
        return warn + 1500;
    }

    sweepWall() {
        const c = this.c, dir = (this.side = -this.side);
        const y0 = this.y + 36;
        const warn = vWall(this, { dir, y0, y1: H - 26, gapY: gapNear(c.py, y0 + 36, H - 56, 70), gap: 60 });
        this.flashEmitters(warn);
        return warn + 2000;
    }

    /** a falling wall and a sweeping wall together: gaps are placed independently, both near the player */
    crossWalls() {
        const c = this.c, dir = (this.side = -this.side);
        const y0 = this.y + 40;
        hWall(this, { y: this.y + EMIT_Y + 8, gapX: gapNear(c.px, 40, W - 40), gap: 64, warnMs: 1100 });
        this.after(700, () => vWall(this, { dir, y0, y1: H - 26, gapY: gapNear(this.c.py, y0 + 36, H - 56, 60), gap: 62, warnMs: 1100 }));
        this.flashEmitters(1800);
        return 1800 + 2200;
    }

    fans() { return muzzleFans(this, EMITTERS, { volleys: 3, count: this.phase ? 5 : 3, spread: this.phase ? 40 : 28, style: S.orbS, speed: 0.9 }) + 1000; }

    eye() { return spiral(this, { dy: EYE_Y, arms: 4, steps: 28, every: 90, rot: 12, speed: 0.55, dir: this.spin++ & 1 ? -1 : 1 }) + 900; }

    /** curving spiral: the arms bend as they fly, like spiral bands of a storm */
    storm() {
        const dir = this.spin++ & 1 ? -1 : 1;
        return spiral(this, { dy: EYE_Y, arms: this.phase >= 2 ? 5 : 4, steps: 30, every: 85, rot: 9, speed: 0.55, style: S.ring, turn: 0.35, dir }) + 900;
    }

    /** gravity well: an amber ring marks the spot (away from the player but within the pull radius) */
    well() { this.spawnWell(this.wellSpot(), this.phase ? 900 : 0); return 2600; }

    wells2() {
        const a = this.wellSpot(), b = { x: W - a.x, y: a.y + 30 };
        this.spawnWell(a, 1100);
        this.after(500, () => this.spawnWell(b, 1100));
        return 3200;
    }

    wellSpot() {
        const c = this.c, side = c.px < W / 2 ? 1 : -1;
        return { x: Math.max(60, Math.min(W - 60, c.px + side * (90 + Math.random() * 60))), y: Math.max(120, Math.min(H - 90, c.py - 40 - Math.random() * 40)) };
    }

    spawnWell({ x, y }, ringEvery) {
        const ms = 900;
        this.warn.ring(ms, { x, y, r: 30 });
        this.after(ms, () => {
            if (this.props.length >= 2) return;
            this.prop(new GravityWell(this, x, y, { life: this.phase >= 2 ? 6000 : 6500, radius: 130, pull: this.phase >= 2 ? 58 : 50, ringEvery }));
        });
    }

    /** emitters flare white while a wall is charging */
    flashEmitters(ms) {
        for (const [dx, dy] of EMITTERS) this.warn.ring(ms, { r: 14, follow: (it) => { it.x = this.x + dx; it.y = this.y + dy; } });
    }
}
