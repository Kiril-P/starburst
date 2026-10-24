// Runs boss waves for the Game scene: picks the boss for the wave (roster.js: mid-bosses, main bosses, the final),
// stages the intro (BossStage), reacts to phase shifts (shockwave + bullet clear + stinger) and plays the death
// sequence (hit-stop, slow-mo, chain explosions, bullets -> score, bonus, heal) before handing control back to
// the WaveManager, which continues with the normal clear -> upgrade -> next wave flow. After the final boss it
// opens the Victory scene first; continuing from there resumes the run in endless mode.
// Game.js only calls intro(), update(dt), `targets` and destroy().
import { COLORS } from '../../art/palette.js';
import { fmtNum } from '../../ui/text.js';
import { save } from '../../systems/Save.js';
import { BOSSES, bossHpScale } from '../../systems/tuning.js';
import BossStage from './BossStage.js';
import { planRun, bossFor, isBossWave, logBoss, BY_ID, DEF_OF, MID_OFFSET, FINAL_EVERY } from './roster.js';

const NONE = [];
const DEATH_MS = { mini: 1100, main: 1800, final: 3200 };   // sim ms of chain explosions before the final blast
const HEAL_FRAC = { mini: 0.25, main: 0.5, final: 1 };
const SPARK_CAP = 60;
const BULLET_POINTS = 10;
const ENDLESS = { enemyHealth: 1.25, enemySpawn: 0.9, damage: 1.15, density: 1.1 };   // per final boss beaten
const rand = (a, b) => a + Math.random() * (b - a);

export default class BossDirector {
    constructor(game) {
        this.g = game;
        this.boss = null;
        this.stage = new BossStage(game);
        this.order = planRun();
        this.forced = null;      // debug: next boss wave fights this class
        game.combat.stats.bosses = 0;
    }

    /** hit circles for collisions (empty when no boss is fighting) */
    get targets() { return this.boss && this.boss.alive ? this.boss.targets : NONE; }

    static isBossWave(wave) { return isBossWave(wave); }

    /** Called on every wave intro. Returns true when it staged a boss (the caller then skips its own banner). */
    intro(wave) {
        this.clear();
        const pick = bossFor(wave, this.order);
        if (!pick) return false;
        const g = this.g, Cls = this.forced || pick.Cls, cycle = pick.cycle;
        this.forced = null;
        this.boss = new Cls(g, {
            hpMod: g.diff.enemyHealth * bossHpScale(wave) * (1 + cycle * BOSSES.cycleHp), cycle,
            onPhase: (b, p) => this.onPhase(b, p),
            onDefeat: (b) => this.onDefeat(b),
            onHit: () => g.combo.add(0.015)        // chip damage keeps a combo chain alive during long fights
        });
        this.cycle = cycle;
        this.fightMs = 0;
        const d = this.boss.def;
        logBoss(d.id, 'seen');
        g.hud.setBoss({ name: d.name, hp01: 0, phase: 0, phases: d.phases.length + 1, invuln: true, thresholds: d.phases });
        this.stage.intro(this.boss, cycle);
        return true;
    }

    update(dt) {
        const b = this.boss;
        this.stage.update(dt);
        if (!b) return;
        b.update(dt);
        if (b.state === 'fight' && b.age > b.enterTotal + 600) this.stage.settle();
        if (b.alive) {
            this.fightMs += dt;
            this.pushHud();
            // last phase: the hull is breaking up
            if (b.phase === b.def.phases.length && Math.random() < dt / 260) {
                const t = b.targets[(Math.random() * b.targets.length) | 0];
                if (t) this.g.fx.hitSpark(t.x + rand(-t.r, t.r), t.y + rand(-t.r, t.r), Math.random() < 0.5 ? COLORS.A : COLORS.R);
            }
        } else this.updateDeath(dt);
    }

    pushHud() {
        const b = this.boss, h = this.hudInfo || (this.hudInfo = {});
        h.name = b.def.name; h.hp01 = b.hp01; h.phase = b.phase; h.phases = b.def.phases.length + 1;
        h.invuln = b.invulnerable; h.thresholds = b.def.phases;
        this.g.hud.setBoss(h);
    }

    onPhase(b, phase) {
        const g = this.g, last = phase >= b.def.phases.length;
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
        g.audio.play('boss-stinger', { vol: 0.55, rate: 1 + phase * 0.08 });
        const named = b.def.phaseNames?.[phase];
        g.hud.toast(named ? `PHASE ${phase + 1}  ${named}` : last ? `${b.def.name} ENRAGED` : `PHASE ${phase + 1}`, '#ff43c8', 1600);
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
        const g = this.g, kind = b.def.kind;
        this.deathT = this.deathTotal = DEATH_MS[kind];
        this.popT = 0;
        g.seq.clear();
        g.fx.hitStop(kind === 'mini' ? 90 : 140);
        g.fx.slowmo(0.3, kind === 'final' ? 2600 : 1600);
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
            this.popT = 70 + 120 * (this.deathT / this.deathTotal);
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
        const b = this.boss, g = this.g, d = b.def, kind = d.kind;
        const big = kind === 'mini' ? 3 : kind === 'final' ? 9 : 5;
        for (let i = 0; i < big; i++) g.fx.explosion(b.x + rand(-40, 40), b.y + rand(-20, 20), 'l', i & 1 ? 'magenta' : 'fire');
        g.fx.shockwave(b.x, b.y, COLORS.w, kind === 'final' ? 6 : 4);
        g.fx.shockwave(b.x, b.y, COLORS.M, 2.5);
        g.fx.debris(b.x, b.y, kind === 'mini' ? 14 : 24, COLORS[4]);
        g.fx.flash(COLORS.w, 0.7, 450);
        g.fx.shake(4, 700);
        g.fx.hitStop(120);
        g.bg.pulse(1);
        g.audio.play('enemy-death', { vol: 1, rate: 0.5 });
        g.audio.play('boss-explosion', { vol: 0.8 });
        b.hide();
        // reward: bonus (faster kills pay more), heal, stats
        const speed = Math.max(0, 1 - this.fightMs / (kind === 'mini' ? 60000 : 120000));
        const bonus = g.combat.addScore(Math.round((d.bonus * (1 + this.cycle) + (kind === 'mini' ? 4000 : 10000) * speed) / 100) * 100, false);
        const p = g.player;
        if (p.alive) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * HEAL_FRAC[kind]));
        g.combat.stats.bosses++;
        save.bossesDefeated += 1;
        logBoss(d.id, 'kill', this.fightMs);
        g.combo.add(kind === 'mini' ? 1 : 2);
        g.combat.stats.maxCombo = Math.max(g.combat.stats.maxCombo, g.combo.mult);
        const sub = kind === 'mini' ? `BONUS +${fmtNum(bonus)}` : `BOSS BONUS +${fmtNum(bonus)}   HULL REPAIRED`;
        g.hud.announce(`${d.name.replace('THE ', '')} DOWN`, sub, 2600);
        this.stage.lift();
        if (kind === 'final') { g.time.delayedCall(2600, () => { if (this.boss === b) this.victory(); }); return; }
        g.time.delayedCall(1000, () => { if (this.boss === b) { this.clear(); g.waves.bossDefeated(); } });
    }

    /** the final boss is dead: freeze the run and show the Victory scene on top */
    victory() {
        const g = this.g;
        this.clear();
        g.audio.stopHum();
        g.scene.launch('Victory', { score: g.combat.score, wave: g.waves.wave, stats: { ...g.combat.stats }, game: g });
        g.scene.pause();
    }

    /** Victory -> CONTINUE: resume the run in endless mode, a notch harder each time */
    continueEndless() {
        const g = this.g, d = g.diff, c = g.enemyCtx;
        g.endless = (g.endless || 0) + 1;
        d.enemyHealth *= ENDLESS.enemyHealth;
        d.enemySpawn *= ENDLESS.enemySpawn;
        c.damage *= ENDLESS.damage;
        c.density *= ENDLESS.density;
        g.scene.resume();
        g.hud.toast(`ENDLESS MODE  ${g.endless > 1 ? 'LV ' + g.endless : ''}`, '#ffb547', 2400);
        g.waves.bossDefeated();
    }

    /** remove the current boss (wave skip / after its death) */
    clear() {
        this.stage.clear();
        if (!this.boss) return;
        this.g.audio.setBossMode(false);
        this.boss.destroy();
        this.boss = null;
        this.g.hud.setBoss(null);
    }

    /** dev helpers merged into window.__dbg (systems/debug.js) */
    debugHelpers() {
        const g = this.g;
        const jump = (wave) => { g.combat.cancelBullets(false); g.waves.skipTo(wave); return this.boss?.def.name; };
        return {
            /** fight a boss by id: lancer gyre bastion manta | warden hive prism tempest colossus | starburst */
            fight: (id) => {
                const C = BY_ID[id], k = DEF_OF[id]?.kind;
                if (!C) return Object.keys(BY_ID);
                this.forced = C;
                return jump(k === 'mini' ? MID_OFFSET : k === 'final' ? FINAL_EVERY : 5);
            },
            /** n-th mid-boss wave (1 = wave 3 Lancer, 2 = wave 8 Gyre ...) */
            mini: (n = 1) => jump((n - 1) * 5 + MID_OFFSET),
            final: () => jump(FINAL_EVERY),
            bossHp: (f = 0.5) => {
                const b = this.boss;
                if (!b || !b.alive) return null;
                if (b.debugHp) b.debugHp(f);
                else { b.state = 'fight'; b.invulnMs = 0; b.shut = false; b.hit(b.hp - b.maxHp * f, b.targets[0]); }
                return b.phase;
            },
            bossOrder: () => this.order.map((C) => Object.keys(BY_ID).find((k) => BY_ID[k] === C))
        };
    }

    destroy() {
        this.clear();
        this.stage.destroy();
    }
}
