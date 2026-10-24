// MID-BOSS: THE LANCER -- arrowhead interceptor. Two phases.
// P1: aimed needle fans from the wing prongs, telegraphed nose lances, a strafing run that drops needle columns.
// P2: faster strafes, five-lance spreads and a sweeping crossfire from both prongs.
import { W } from '../../config.js';
import { DEG } from '../patterns.js';
import Boss from './Boss.js';
import { S, muzzleFans, lances } from './attacks.js';

const PRONG_X = 21, PRONG_Y = 13, NOSE_Y = 20;
const PRONGS = [[-PRONG_X, PRONG_Y], [PRONG_X, PRONG_Y]];

export const LANCER = { id: 'lancer', kind: 'mini', name: 'LANCER', title: 'INTERCEPTOR', hp: 800, phases: [0.5], homeY: 66, bonus: 5000, enterMs: 1800 };

export default class Lancer extends Boss {
    constructor(game, opts) {
        super(game, LANCER, opts);
        this.hull = this.part('boss_lancer');
        this.target(0, -2, 9, 1.25);
        this.target(0, 14, 7);
        this.target(-PRONG_X, 4, 9, 0.8);
        this.target(PRONG_X, 4, 9, 0.8);
        this.run = null;
        this.sync();
    }

    move(dt) {
        const r = this.run;
        if (r) {
            // strafing run: ease across the screen on a straight line, then hand back to the sway
            r.t += dt;
            const k = Math.min(1, r.t / r.ms), e = k * k * (3 - 2 * k);
            this.x = r.x0 + (r.x1 - r.x0) * e;
            this.y = this.homeY - 8 * Math.sin(k * Math.PI);
            if (k >= 1) this.run = null;
            return;
        }
        // drift back from wherever the last run ended
        const t = this.age / 1000, tx = W / 2 + Math.sin(t * 0.6) * 120;
        this.x += (tx - this.x) * Math.min(1, dt / 600);
        this.y = this.homeY + Math.sin(t * 1.3) * 5;
    }

    onPhase() { this.hull.anims.timeScale = 1.6; }

    attacks(p) {
        if (p === 0) return [this.fans, this.lance3, this.strafe, this.fans, this.lance3];
        return [this.strafe, this.lance5, this.crossfire, this.strafe, this.fans];
    }

    fans() { return muzzleFans(this, PRONGS, { volleys: this.phase ? 4 : 3, count: this.phase ? 5 : 3, spread: this.phase ? 36 : 24 }) + 900; }

    lance3() { return lances(this, { dy: NOSE_Y, count: 3, spreadDeg: 22, ms: 850 }) + 1100; }
    lance5() { return lances(this, { dy: NOSE_Y, count: 5, spreadDeg: 20, ms: 850 }) + 1000; }

    /** dash to the far side dropping accelerating needle pairs: gaps between drops let you slip through */
    strafe() {
        const ms = this.phase ? 1500 : 1900;
        const x1 = this.x < W / 2 ? W - 70 : 70;
        this.run = { x0: this.x, x1, t: 0, ms };
        const drops = Math.round(ms / 130);
        this.repeat(130, drops, (i, x, y) => {
            if (i % 4 === 3) return;            // every 4th beat is skipped: a guaranteed opening
            for (const s of [-1, 1]) this.pool.spawn(x + s * PRONG_X, y + PRONG_Y + 4, Math.PI / 2, this.sp(0.35), S.needle, { damage: this.dmg, accel: this.sp(1.6), maxSpeed: this.sp(1.7) });
            if (i & 1) this.sfx();
        });
        this.g.audio.play('dash', { vol: 0.4, rate: 0.8 });
        return ms + 700;
    }

    /** both prongs sweep a needle stream back and forth below the ship (sprinkler) */
    crossfire() {
        const steps = this.n(26);
        this.repeat(70, steps, (i, x, y) => {
            const sw = Math.sin(i * 0.28) * 55 * DEG;
            for (const s of [-1, 1]) this.pool.spawn(x + s * PRONG_X, y + PRONG_Y, Math.PI / 2 + s * sw, this.sp(1.05), S.needleM, { damage: this.dmg });
            if (i % 3 === 0) this.sfx();
        });
        return steps * 70 + 900;
    }
}
