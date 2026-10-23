// Runs boss waves for the Game scene: picks the boss for the wave, stages the intro (dimmed backdrop, amber
// hazard stripes + WARNING banner, rumble), reacts to phase shifts (shockwave + bullet clear) and plays the
// death sequence (hit-stop, slow-mo, chain explosions, bullets -> score, bonus, heal) before handing control
// back to the WaveManager, which continues with the normal clear -> upgrade -> next wave flow.
// Game.js only calls intro(), update(dt), `targets` and destroy().
import { W, H, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { fmtNum } from '../../ui/text.js';
import { save } from '../../systems/Save.js';
import { BOSS_EVERY } from '../waves.js';
import Warden from './Warden.js';
import Hive from './Hive.js';
import Prism from './Prism.js';

export const ROSTER = [Warden, Hive, Prism];
const NONE = [];
const DIM_ALPHA = 0.5;
const STRIPE_MS = 2600;
const DEATH_MS = 1800;           // sim ms of chain explosions before the final blast
const HEAL_FRAC = 0.5;
const SPARK_CAP = 60;
const BULLET_POINTS = 10;
const rand = (a, b) => a + Math.random() * (b - a);

export default class BossDirector {
    constructor(game) {
        this.g = game;
        this.boss = null;
        this.dim = game.add.rectangle(0, 0, W, H, COLORS.k, 1).setOrigin(0, 0).setDepth(DEPTH.PICKUP - 1).setAlpha(0).setVisible(false);
        this.stripes = game.add.graphics().setDepth(DEPTH.HUD + 4).setVisible(false);
        this.dimTarget = 0;
        this.stripeT = 0;
        game.combat.stats.bosses = 0;
    }

    /** hit circles for collisions (empty when no boss is fighting) */
    get targets() { return this.boss && this.boss.alive ? this.boss.targets : NONE; }

    static isBossWave(wave) { return wave > 0 && wave % BOSS_EVERY === 0; }

    /** Called on every wave intro. Returns true when it staged a boss (the caller then skips its own banner). */
    intro(wave) {
        this.clear();
        if (!BossDirector.isBossWave(wave)) return false;
        const g = this.g;
        const n = wave / BOSS_EVERY - 1;
        const Cls = ROSTER[n % ROSTER.length];
        const cycle = Math.floor(n / ROSTER.length);
        this.boss = new Cls(g, {
            hpMod: g.diff.enemyHealth * (1 + cycle * 0.6), cycle,
            onPhase: (b, p) => this.onPhase(b, p),
            onDefeat: (b) => this.onDefeat(b),
            onHit: () => g.combo.add(0.015)        // chip damage keeps a combo chain alive during long fights
        });
        this.cycle = cycle;
        this.fightMs = 0;
        const d = this.boss.def;
        g.hud.announce('WARNING', `${d.name}  //  ${d.title}${cycle ? '  MK ' + (cycle + 1) : ''}`, 2800);
        g.hud.setBoss({ name: d.name, hp01: 0, phase: 0, phases: d.phases.length + 1, invuln: true, thresholds: d.phases });
        this.dimTarget = DIM_ALPHA;
        this.dim.setVisible(true);
        this.stripeT = STRIPE_MS;
        this.stripes.setVisible(true);
        g.fx.shake(1, 2400);
        g.fx.flash(COLORS.r, 0.18, 300);
        g.bg.pulse(0.8);
        g.audio.bossWarning();
        g.audio.setBossMode(true);
        g.audio.play('forcefield', { vol: 0.7, rate: 0.5 });
        g.audio.play('wave-complete', { vol: 0.5, rate: 0.6 });
        return true;
    }

    update(dt) {
        const b = this.boss;
        // dim fades on simulation time so it freezes with pause; stripes blink for the first seconds
        const a = this.dim.alpha, step = dt / 600;
        if (a !== this.dimTarget) {
            const na = a < this.dimTarget ? Math.min(this.dimTarget, a + step) : Math.max(this.dimTarget, a - step);
            this.dim.setAlpha(na).setVisible(na > 0);
        }
        if (this.stripeT > 0) { this.stripeT -= dt; this.drawStripes(); if (this.stripeT <= 0) this.stripes.clear().setVisible(false); }
        if (!b) return;
        b.update(dt);
        if (b.state === 'fight' && this.dimTarget > 0.25 && b.age > 3200) this.dimTarget = 0.25;   // keep a little gloom during the fight
        if (b.alive) {
            this.fightMs += dt;
            this.pushHud();
            // last phase: the hull is breaking up
            if (b.phase === b.def.phases.length && Math.random() < dt / 260) {
                const t = b.targets[(Math.random() * b.targets.length) | 0];
                this.g.fx.hitSpark(t.x + rand(-t.r, t.r), t.y + rand(-t.r, t.r), Math.random() < 0.5 ? COLORS.A : COLORS.R);
            }
        } else this.updateDeath(dt);
    }

    pushHud() {
        const b = this.boss, h = this.hudInfo || (this.hudInfo = {});
        h.name = b.def.name; h.hp01 = b.hp01; h.phase = b.phase; h.phases = b.def.phases.length + 1;
        h.invuln = b.invulnerable; h.thresholds = b.def.phases;
        this.g.hud.setBoss(h);
    }

    drawStripes() {
        // two amber hazard bands framing the WARNING banner, stripes crawl sideways; stepped blink
        const g = this.stripes.clear();
        if (((this.stripeT / 220) | 0) % 4 === 3) return;
        const y0 = Math.round(H * 0.3) - 23 - 7, y1 = Math.round(H * 0.3) + 23 + 1;
        const off = ((this.stripeT / 40) | 0) % 12;
        for (const y of [y0, y1]) {
            g.fillStyle(COLORS.k, 0.85).fillRect(0, y, W, 6);
            g.fillStyle(COLORS.A, 1);
            for (let x = -12 + off; x < W; x += 12) for (let r = 0; r < 6; r++) g.fillRect(x + r, y + r, 5, 1);
        }
    }

    onPhase(b, phase) {
        const g = this.g;
        this.clearBullets(false);
        g.seq.clear();
        g.fx.hitStop(70);
        g.fx.shockwave(b.x, b.y, COLORS.q, 2.5);
        g.fx.shockwave(b.x, b.y, COLORS.A, 1.2);
        g.fx.explosion(b.x + rand(-20, 20), b.y + rand(-8, 12), 'm', 'magenta');
        g.fx.flash(COLORS.M, 0.3, 260);
        g.fx.shake(3, 400);
        g.bg.pulse(0.9);
        g.audio.play('phase-shift', { vol: 0.8, rate: 0.75 });
        g.hud.toast(phase >= b.def.phases.length ? `${b.def.name} ENRAGED` : `PHASE ${phase + 1}`, '#ff43c8', 1600);
    }

    /** every enemy bullet becomes a spark; with `reward` each one is worth points */
    clearBullets(reward) {
        const g = this.g;
        let n = 0;
        g.enemyBullets.clear((bl) => { if (n++ < SPARK_CAP) g.fx.hitSpark(bl.x, bl.y, n & 1 ? COLORS.q : COLORS.A); });
        if (reward && n) {
            const pts = g.combat.addScore(n * BULLET_POINTS);
            g.fx.floatText(this.boss.x, this.boss.y + 34, `${n} BULLETS +${fmtNum(pts)}`, '#ffe3a0', 8);
        }
        return n;
    }

    onDefeat(b) {
        const g = this.g;
        this.deathT = DEATH_MS;
        this.popT = 0;
        g.seq.clear();
        g.fx.hitStop(140);
        g.fx.slowmo(0.3, 1600);
        g.fx.flash(COLORS.w, 0.5, 200);
        g.fx.shake(3, 600);
        g.audio.play('player-death', { vol: 0.8, rate: 0.7 });
        this.clearBullets(true);
        // the brood dies with its mother: drones pop (and still score)
        for (const e of [...g.waves.live]) if (e.alive) g.combat.killEnemy(e, true);
        g.audio.setBossMode(false);
        g.hud.setBoss(null);
    }

    updateDeath(dt) {
        const b = this.boss, g = this.g;
        if (this.deathT <= 0) return;
        this.deathT -= dt;
        // chain explosions over the hull, getting denser; the rig shakes a pixel each pop
        if ((this.popT -= dt) <= 0) {
            this.popT = 70 + 120 * (this.deathT / DEATH_MS);
            const hw = b.parts[0].width * 0.42, hh = b.parts[0].height * 0.36;
            g.fx.explosion(b.x + rand(-hw, hw), b.y + rand(-hh, hh), Math.random() < 0.45 ? 'm' : 's', Math.random() < 0.35 ? 'magenta' : 'fire');
            g.audio.throttled('enemy-death', 90, { vol: 0.5, jitter: 300 });
            // every other pop the hull blinks white for a moment (Boss.update clears flashT tints)
            if ((this.pops = (this.pops || 0) + 1) & 1) { for (const p of b.parts) p.setTintFill(0xffffff); b.flashT = 45; }
            b.x += rand(-2, 2);
        }
        if (this.deathT <= 0) this.finalBlast();
    }

    finalBlast() {
        const b = this.boss, g = this.g, d = b.def;
        for (let i = 0; i < 5; i++) g.fx.explosion(b.x + rand(-40, 40), b.y + rand(-20, 20), 'l', i & 1 ? 'magenta' : 'fire');
        g.fx.shockwave(b.x, b.y, COLORS.w, 4);
        g.fx.shockwave(b.x, b.y, COLORS.M, 2.5);
        g.fx.debris(b.x, b.y, 24, COLORS[4]);
        g.fx.flash(COLORS.w, 0.7, 450);
        g.fx.shake(4, 700);
        g.fx.hitStop(120);
        g.bg.pulse(1);
        g.audio.play('enemy-death', { vol: 1, rate: 0.5 });
        b.hide();
        // reward: bonus (faster kills pay more), heal, stats
        const speed = Math.max(0, 1 - this.fightMs / 120000);
        const bonus = g.combat.addScore(Math.round((d.bonus * (1 + this.cycle) + 10000 * speed) / 100) * 100, false);
        const p = g.player;
        if (p.alive) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * HEAL_FRAC));
        g.combat.stats.bosses++;
        save.bossesDefeated += 1;
        g.combo.add(2);
        g.combat.stats.maxCombo = Math.max(g.combat.stats.maxCombo, g.combo.mult);
        g.hud.announce(`${d.name.replace('THE ', '')} DOWN`, `BOSS BONUS +${fmtNum(bonus)}   HULL REPAIRED`, 2600);
        this.dimTarget = 0;
        g.time.delayedCall(1000, () => { if (this.boss === b) { this.clear(); g.waves.bossDefeated(); } });
    }

    /** remove the current boss (wave skip / after its death) */
    clear() {
        if (!this.boss) return;
        this.g.audio.setBossMode(false);
        this.boss.destroy();
        this.boss = null;
        this.g.hud.setBoss(null);
        this.dimTarget = 0;
    }

    destroy() {
        this.clear();
        this.dim.destroy();
        this.stripes.destroy();
    }
}
