// Combat rules and their juice: what happens when shots hit, enemies die, the player is hit or grazes,
// and when bullets are cancelled. Owns score + run stats. All feedback goes through the Fx / Hud / audio APIs.
import { COLORS } from '../art/palette.js';
import { PLAYER, SCORE, JUICE, ABILITIES } from '../systems/tuning.js';
import { meteorShards } from './enemyTypes.js';
import { origin } from './patterns.js';

const SPARK_CAP = 48;   // max sparks spawned by one bullet cancel (keeps a 400-bullet clear cheap)
const HURT_SFX_GAP = 250; // v1 debounce for the damaged sound
// semitones above the base pitch per chain link / per 5-kill streak step: a major pentatonic climb, so long chains sing
const CHAIN_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const STREAK_STEPS = [0, 2, 4, 7, 9, 12];

export default class Combat {
    constructor(game) {
        this.g = game;
        this.score = 0;
        this.stats = { graze: 0, maxCombo: 1, kills: 0 };
        this.streak = 0; this.lastKill = -1e9;   // rapid-kill streak (popup every 5)
        this.chainLen = 0; this.lastChain = -1e9;
        this.waveHits = 0;                       // hull hits taken in the current wave (FLAWLESS bonus when it ends at 0)
    }

    addScore(base, useCombo = true) {
        const pts = Math.round(base * (useCombo ? this.g.combo.mult : 1) * (this.g.powerups?.scoreMul ?? 1));
        this.score += pts;
        return pts;
    }

    shotHit(s, e) {
        const g = this.g;
        // piercing weapon shots fly on and remember the target so they never hit it twice (collisions.js)
        if (s.pierce > 0) { s.pierce--; s.hits.push(e); } else g.shots.kill(s);
        g.impacts.play(s.x, s.y - 2);
        if (e.damage(s.damage, s)) this.killEnemy(e, true);
        else g.fx.hitSpark(s.x, s.y - 2, COLORS.C);
        if (s.splash) this.splash(s, e);
    }

    /** missile blast: half damage to every other enemy within s.splash px */
    splash(s, hit) {
        const g = this.g, r2 = s.splash * s.splash;
        g.fx.explosion(Math.round(s.x), Math.round(s.y), 's', 'cyan');
        for (const e of [...g.waves.live]) {
            if (e === hit || !e.alive) continue;
            const dx = e.x - s.x, dy = e.y - s.y;
            if (dx * dx + dy * dy < r2 && e.damage(s.damage * 0.5)) this.killEnemy(e, true);
        }
    }

    killEnemy(e, byPlayer) {
        const g = this.g;
        const t = e.type;
        const x = e.x, y = e.y, elite = e.elite;
        e.despawn();
        if (byPlayer) {
            const pts = this.addScore(t.score);
            g.loot?.enemyDrop(t, x, y);
            this.stats.kills++;
            const up = g.combo.kill(t.score);
            this.stats.maxCombo = Math.max(this.stats.maxCombo, g.combo.mult);
            this.streakKill();
            if (elite) this.eliteDown(x, y, t);
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
        if (this.chainRate) g.audio.play('chain-pop', { vol: 0.6, rate: this.chainRate });   // a link in a chain explosion: pitch climbs per link
        else if (t.big) g.audio.play('enemy-death-big', { vol: 0.7 });
        else g.audio.play('enemy-death', { vol: 0.5, jitter: 250 });
        if (t.meteor) {
            const prev = origin.v;
            origin.v = 'shards:' + e.typeName;
            meteorShards(e, g.enemyCtx, g.waves.tier);
            origin.v = prev;
            if (t.splitInto && byPlayer) {
                for (const dir of [-1, 1]) {
                    const m = g.waves.spawn(t.splitInto, x + dir * 6, y);
                    m.vx = dir * 45 + e.vx * 0.5; m.vy = Math.max(30, e.vy);
                }
            }
        }
        if (byPlayer && (e.volatile || t.chain)) this.chain(x, y, e.volatile ? 58 : 64);
        if (t.onKill) t.onKill(e, g, byPlayer, x, y);   // splitters break apart (enemyTypes2.js)
    }

    /** an ELITE fell: triple score, a shockwave, and a guaranteed drop (Loot.eliteDrop) */
    eliteDown(x, y, t) {
        const g = this.g, pts = this.addScore(t.score * 3);
        g.fx.floatText(Math.round(x), Math.round(y - 22), `ELITE +${pts}`, '#ffb547', 8);
        g.fx.shockwave(Math.round(x), Math.round(y), COLORS.A, 1);
        g.fx.hitStop(70);
        g.loot?.eliteDrop(x, y);
    }

    /** kills within 0.7s of each other build a streak; every 5th pays a flat bonus and pops a label by the ship */
    streakKill() {
        const g = this.g, now = g.time.now;
        this.streak = now - this.lastKill < 700 ? this.streak + 1 : 1;
        this.lastKill = now;
        if (this.streak < 5 || this.streak % 5) return;
        const bonus = this.addScore(this.streak * 20, false);
        g.fx.floatText(Math.round(g.player.x), Math.round(g.player.y - 26), `${this.streak} STREAK +${bonus}`, '#b7ff4a', 8);
        g.audio.play('streak', { vol: 0.55, rate: Math.pow(2, STREAK_STEPS[Math.min(STREAK_STEPS.length - 1, this.streak / 5 - 1)] / 12) });
    }

    /** chain explosion: the blast at (x,y) rips into everything close by, one ripple step at a time */
    chain(x, y, r) {
        const g = this.g, r2 = r * r;
        g.fx.shockwave(Math.round(x), Math.round(y), COLORS.A, 0.5);
        let k = 0;
        for (const o of g.waves.live) {
            const dx = o.x - x, dy = o.y - y;
            if (!o.alive || dx * dx + dy * dy > r2) continue;
            const gen = o.gen;
            g.time.delayedCall(60 + ++k * 40, () => {
                if (!o.alive || o.gen !== gen) return;
                if (!o.damage(45)) { g.fx.hitSpark(o.x, o.y, COLORS.A); return; }
                this.chainLen = g.time.now - this.lastChain < 1200 ? this.chainLen + 1 : 1;
                this.lastChain = g.time.now;
                if (this.chainLen > 1) g.fx.floatText(Math.round(o.x), Math.round(o.y - 20), `CHAIN x${this.chainLen}`, '#ffb547', 8);
                this.chainRate = Math.pow(2, CHAIN_STEPS[Math.min(CHAIN_STEPS.length - 1, this.chainLen - 1)] / 12);
                this.killEnemy(o, true);
                this.chainRate = 0;
            });
        }
    }

    ram(e) {
        const g = this.g;
        if (!g.player.hittable) return;
        this.hurt(PLAYER.contactDamage * g.diff.enemyDamage, 'ram:' + (e.typeName || (g.bosses.boss ? 'boss:' + g.bosses.boss.def.id : 'unknown')));
        if (e.damage(PLAYER.contactDamageToEnemy)) this.killEnemy(e, true);
    }

    bulletHit(b) {
        this.g.enemyBullets.kill(b);
        this.hurt(b.damage, b.src);
    }

    /** a live laser band (objects/beams.js) caught the player */
    beamHit(b) { this.hurt(this.g.enemyCtx.damage * b.mul, 'beam:' + (b.owner.typeName || 'unknown')); }

    /** `src` = what hit (telemetry label: enemy type, 'boss:id/pN', 'beam:type', 'ram:type'); only for the run log */
    hurt(amount, src) {
        const g = this.g;
        if (g.god) { g.fx.hitSpark(g.player.x, g.player.y, COLORS.R); return; }
        if (g.powerups?.absorb()) return;   // SHIELD power-up eats one hit
        const hp0 = g.player.hp;
        const dead = g.player.damage(amount);
        if (hp0 > g.player.hp) g.runlog.hurt(src, hp0 - g.player.hp, dead);
        this.waveHits++;
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
        g.audio.throttled('graze', JUICE.sfxThrottleMs, { vol: 0.4, rate: 1 + Math.min(0.5, g.combo.mult * 0.03) });
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
