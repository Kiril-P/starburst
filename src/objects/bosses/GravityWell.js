// Gravity well (Tempest, THE STARBURST): a vortex that drags the player and bends enemy bullets toward itself,
// swallowing the ones that reach its core. It never damages on its own -- the danger is being pulled into the
// streams around it -- and the pull is capped well below the slowest ship's speed so you can always fly out.
// Registered with boss.prop(): updated on simulation dt, destroyed with the boss / on its phase change.
import { DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { S } from './attacks.js';

const CORE_R = 7;
const SPARK_GAP = 140;

export default class GravityWell {
    /** o: { life ms, radius px, pull px/s at the core, bend px/s^2 on bullets, ringEvery ms (0 = silent) } */
    constructor(boss, x, y, o = {}) {
        this.b = boss;
        this.g = boss.g;
        this.x = Math.round(x); this.y = Math.round(y);
        this.life = o.life ?? 6500;
        this.R = o.radius ?? 130;
        this.pull = o.pull ?? 52;
        this.bend = o.bend ?? 150;
        this.ringEvery = o.ringEvery ?? 0;
        this.ringT = this.ringEvery * 0.6;
        this.sparkT = 0;
        this.age = 0;
        const sc = this.g;
        this.halo = sc.add.image(this.x, this.y, 'glow_l').setTint(COLORS.V).setBlendMode('ADD').setAlpha(0.55).setDepth(DEPTH.ENEMY - 2);
        this.spr = sc.add.sprite(this.x, this.y, 'boss_well', 0).setDepth(DEPTH.ENEMY - 1).play('boss_well');
        sc.fx.shockwave(this.x, this.y, COLORS.V, 1.6);
        sc.audio.play('phase-shift', { vol: 0.45, rate: 0.5 });
    }

    update(dt) {
        this.age += dt;
        if ((this.life -= dt) <= 0) { this.g.fx.shockwave(this.x, this.y, COLORS.M, 0.8); return false; }
        // the last second it flickers (stepped, no alpha fade) so its end is readable
        const dying = this.life < 900;
        this.spr.setVisible(!dying || ((this.life / 80) | 0) % 2 === 0);
        this.halo.setAlpha(0.35 + 0.2 * Math.sin(this.age / 140));
        const s = dt / 1000, R = this.R, R2 = R * R;
        const p = this.g.player;
        if (p.alive && p.controllable && !p.dashing && !this.g.dying) {
            const dx = this.x - p.x, dy = this.y - p.y, d2 = dx * dx + dy * dy;
            if (d2 < R2 && d2 > 16) {
                const d = Math.sqrt(d2), f = this.pull * Math.sqrt(1 - d / R) * s;
                p.x += (dx / d) * f; p.y += (dy / d) * f;
            }
        }
        // bend bullets: integrate an acceleration toward the core and write it back in the pool's polar form
        const live = this.b.pool.live;
        for (let i = 0; i < live.length; i++) {
            const bl = live[i];
            if (!bl.alive || (bl.wellOwner === this && bl.age < 4000)) continue;   // its own rings fly free
            const dx = this.x - bl.x, dy = this.y - bl.y, d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const d = Math.sqrt(d2);
            if (d < CORE_R) {
                if ((this.sparkT -= dt) <= 0) { this.sparkT = SPARK_GAP; this.g.fx.hitSpark(bl.x, bl.y, COLORS.q); }
                this.b.pool.kill(bl);
                continue;
            }
            const a = this.bend * (1 - d / R) * s;
            bl.vx += (dx / d) * a; bl.vy += (dy / d) * a;
            bl.speed = Math.hypot(bl.vx, bl.vy);
            bl.angle0 = Math.atan2(bl.vy, bl.vx);
            if (bl.orient) bl.rotation = bl.angle0 + Math.PI / 2;
        }
        if (this.ringEvery && (this.ringT -= dt) <= 0) {
            this.ringT = this.ringEvery;
            const n = this.b.n(10), off = this.age / 700;
            for (let k = 0; k < n; k++) {
                const a = off + (k * Math.PI * 2) / n;
                const bl = this.b.pool.spawn(this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10, a, this.b.sp(0.4), S.ring, { damage: this.b.dmg });
                if (bl) bl.wellOwner = this;
            }
        }
        return true;
    }

    destroy() { this.spr.destroy(); this.halo.destroy(); }
}
