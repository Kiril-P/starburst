// Combat rules and their juice: what happens when shots hit, enemies die, the player is hit or grazes,
// and when bullets are cancelled. Owns score + run stats. All feedback goes through the Fx / Hud / audio APIs.
import { COLORS } from '../art/palette.js';
import { PLAYER, SCORE, JUICE, ABILITIES } from '../systems/tuning.js';
import { meteorShards } from './enemyTypes.js';

const SPARK_CAP = 48;   // max sparks spawned by one bullet cancel (keeps a 400-bullet clear cheap)
const HURT_SFX_GAP = 250; // v1 debounce for the damaged sound

export default class Combat {
    constructor(game) {
        this.g = game;
        this.score = 0;
        this.stats = { graze: 0, maxCombo: 1, kills: 0 };
    }

    addScore(base, useCombo = true) {
        const pts = Math.round(base * (useCombo ? this.g.combo.mult : 1));
        this.score += pts;
        return pts;
    }

    shotHit(s, e) {
        const g = this.g;
        g.shots.kill(s);
        g.impacts.play(s.x, s.y - 2);
        if (e.damage(s.damage)) this.killEnemy(e, true);
        else g.fx.hitSpark(s.x, s.y - 2, COLORS.C);
    }

    killEnemy(e, byPlayer) {
        const g = this.g;
        const t = e.type;
        const x = e.x, y = e.y;
        e.despawn();
        if (byPlayer) {
            const pts = this.addScore(t.score);
            this.stats.kills++;
            const up = g.combo.kill(t.score);
            this.stats.maxCombo = Math.max(this.stats.maxCombo, g.combo.mult);
            g.fx.floatText(x, y - 10, String(pts), g.combo.mult > 1 ? '#ffe3a0' : '#f4faff', 8);
            if (up && g.combo.mult >= 2) g.fx.floatText(x, y - 20, `x${g.combo.mult}`, '#39e7ff', 8);
        }
        g.fx.explosion(x, y, t.explosion, t.meteor ? 'lime' : 'fire');
        g.fx.debris(x, y, t.big ? 10 : 5, t.meteor ? COLORS.l : COLORS[5]);
        if (t.shake) g.fx.shake(t.shake, 90 + t.shake * 50);
        if (t.big) {
            g.fx.hitStop(JUICE.hitStopBigKillMs);
            g.fx.shockwave(x, y, t.meteor ? COLORS.L : COLORS.q, 0.6);
            g.bg.pulse(0.35);
        }
        g.audio.play('enemy-death', { vol: t.big ? 0.7 : 0.5, jitter: 250, rate: t.big ? 0.85 : 1 });
        if (t.meteor) {
            meteorShards(e, g.enemyCtx, g.waves.tier);
            if (t.splitInto && byPlayer) {
                for (const dir of [-1, 1]) {
                    const m = g.waves.spawn(t.splitInto, x + dir * 6, y);
                    m.vx = dir * 45 + e.vx * 0.5; m.vy = Math.max(30, e.vy);
                }
            }
        }
    }

    ram(e) {
        const g = this.g;
        if (!g.player.hittable) return;
        this.hurt(PLAYER.contactDamage * g.diff.enemyDamage);
        if (e.damage(PLAYER.contactDamageToEnemy)) this.killEnemy(e, true);
    }

    bulletHit(b) {
        this.g.enemyBullets.kill(b);
        this.hurt(b.damage);
    }

    hurt(amount) {
        const g = this.g;
        if (g.god) { g.fx.hitSpark(g.player.x, g.player.y, COLORS.R); return; }
        const dead = g.player.damage(amount);
        g.combo.reset();
        if (dead) { g.startDeath(); return; }
        const now = g.game.loop.time;
        if (now - (this.lastHurt || -1e9) > HURT_SFX_GAP) { this.lastHurt = now; g.audio.play('player-damaged', { vol: 0.8 }); }
        g.fx.hitStop(JUICE.hitStopDamageMs);
        g.fx.flash(COLORS.r, 0.35, 120);
        g.fx.shake(2, 180);
        g.fx.hitSpark(g.player.x, g.player.y, COLORS.R);
        g.bg.pulse(0.5);
    }

    graze(b) {
        const g = this.g;
        this.stats.graze++;
        this.addScore(SCORE.graze);
        g.combo.graze();
        this.stats.maxCombo = Math.max(this.stats.maxCombo, g.combo.mult);
        // spark on the near side of the bullet, between it and the ship
        g.fx.grazeSpark((b.x + g.player.x) / 2, (b.y + g.player.y) / 2);
        g.audio.throttled('button-sound', JUICE.sfxThrottleMs, { vol: 0.18, rate: 1.7, jitter: 150 });
    }

    /** Forcefield / wave clear: every enemy bullet becomes a spark (+ points when `reward`). */
    cancelBullets(reward) {
        const g = this.g;
        let n = 0;
        g.enemyBullets.clear((b) => {
            if (n++ < SPARK_CAP) g.fx.hitSpark(b.x, b.y, n & 1 ? COLORS.C : COLORS.b);
        });
        if (reward && n) {
            const pts = this.addScore(n * ABILITIES.forcefield.cancelPoints, false);   // flat: the combo shouldn't turn Z into a score button
            g.fx.floatText(g.player.x, g.player.y - 24, `+${pts}`, '#a6f7ff', 8);
        }
        g.seq.clear();
        return n;
    }
}
