// Timed waves, v1 rules: survive the timer; each enemy type spawns on its own jittered interval while
// the number of active enemies is below the wave's max. Then: wave clear -> upgrade pick -> next wave.
// Boss waves (bosses/roster.js isBossWave) have no timer or spawners: state 'boss' waits for bossDefeated() (BossDirector).
// Driven by simulation dt (no scene timers) so pause / hit-stop / slow-mo freeze it naturally.
import { W } from '../config.js';
import { WAVES } from '../systems/tuning.js';
import { WAVE_TABLE } from './waves.js';
import { isBossWave } from './bosses/roster.js';   // main bosses every 5th wave + mid-bosses (waves 3, 8, 13 ...)
import { resolveType } from './enemyTypes.js';
import Enemy from './Enemy.js';

const rand = (a, b) => a + Math.random() * (b - a);

export default class WaveManager {
    /**
     * hooks: { onIntro(wave, cfg), onStart(wave), onClear(wave), onUpgrade(wave, done), onEscape(enemy) }
     * diff: difficulty modifiers (systems/difficulty.js)
     */
    constructor(scene, diff, hooks) {
        this.scene = scene;
        this.diff = diff;
        this.hooks = hooks;
        this.wave = 0;
        this.state = 'idle';
        this.timer = 0;
        this.timeLeft = 0;
        this.pool = [];
        this.live = [];
        this.spawners = [];
    }

    get biome() { const b = WAVES.biomeByWave; return this.wave <= b.length ? b[this.wave - 1] : b[b.length - 2 + (this.wave % 2)]; }

    get isBoss() { return isBossWave(this.wave); }

    get tier() { const t = WAVES.tierByWave; return t[Math.min(this.wave, t.length) - 1] ?? 0; }

    /** effective config for a wave number (1-based), including endless scaling past the authored table */
    config(wave) {
        const last = WAVE_TABLE.length;
        const base = WAVE_TABLE[Math.min(wave, last) - 1];
        const extra = Math.max(0, wave - last);
        const spawnF = Math.pow(WAVES.endlessSpawnFactor, extra) * this.diff.enemySpawn;
        return {
            duration: base.duration * WAVES.durationScale,
            max: Math.round(base.max * WAVES.maxActiveScale * this.diff.maxEnemies),
            spawns: base.spawns.map(([type, every]) => ({ type, every: every * spawnF })),
            bulletSpeed: 1 + extra * WAVES.endlessBulletSpeedStep
        };
    }

    start(wave) {
        this.wave = wave;
        this.cfg = this.config(wave);
        this.state = 'intro';
        this.timer = WAVES.introMs;
        this.timeLeft = this.cfg.duration;
        if (this.isBoss) { this.state = 'boss'; this.spawners = []; }
        this.hooks.onIntro(wave, this.cfg);
    }

    /** the boss is dead: continue with the usual clear -> upgrade -> next wave flow */
    bossDefeated() {
        if (this.state !== 'boss') return;
        this.state = 'cleared';
        this.timer = WAVES.clearToUpgradeMs;
        this.hooks.onClear(this.wave);
    }

    /** debug: jump straight to a wave */
    skipTo(wave) {
        this.clearEnemies();
        this.start(wave);
    }

    beginSpawning() {
        this.state = 'active';
        // v1 staggers each enemy type's first spawn by 800ms
        this.spawners = this.cfg.spawns.map((s, i) => ({ type: s.type, every: s.every, next: i * WAVES.staggerMs }));
        this.hooks.onStart(this.wave);
    }

    update(dt, ctx) {
        switch (this.state) {
            case 'intro':
                if ((this.timer -= dt) <= 0) this.beginSpawning();
                break;
            case 'active':
                this.timeLeft -= dt;
                for (const sp of this.spawners) {
                    if ((sp.next -= dt) > 0) continue;
                    const j = sp.every * WAVES.spawnJitter;
                    sp.next += Math.max(WAVES.minSpawnMs, sp.every + rand(-j, j));
                    if (this.live.length < this.cfg.max) this.spawnGroup(resolveType(sp.type));
                }
                if (this.timeLeft <= 0) {
                    this.timeLeft = 0;
                    this.state = 'cleared';
                    this.timer = WAVES.clearToUpgradeMs;
                    this.hooks.onClear(this.wave);
                }
                break;
            case 'cleared':
                if ((this.timer -= dt) <= 0) {
                    this.state = 'upgrade';
                    this.hooks.onUpgrade(this.wave, () => { this.state = 'next'; this.timer = WAVES.upgradeToNextMs; });
                }
                break;
            case 'next':
                if ((this.timer -= dt) <= 0) this.start(this.wave + 1);
                break;
        }
        this.updateEnemies(dt, ctx);
    }

    updateEnemies(dt, ctx) {
        const live = this.live;
        for (let i = live.length - 1; i >= 0; i--) {
            const e = live[i];
            if (e.alive && !e.update(dt, ctx)) {
                this.hooks.onEscape(e);
                e.despawn();
            }
            if (!e.alive) { live[i] = live[live.length - 1]; live.pop(); }
        }
    }

    spawnGroup(typeName) {
        const m = WAVES.spawnMarginX, gap = WAVES.formationSpacing;
        const formation = typeName === 'basic' && this.live.length + 3 <= this.cfg.max && Math.random() < WAVES.formationChance[this.tier];
        const x = formation ? rand(m + gap, W - m - gap) : rand(m, W - m);
        const lead = this.spawn(typeName, x, -20);
        if (!formation) return;
        for (const side of [-1, 1]) {
            const e = this.spawn(typeName, x + side * gap, -34);
            // wingmen copy the leader's flight path so the V holds its shape
            e.move = lead.move; e.amplitude = lead.amplitude; e.freq = lead.freq;
            e.nextFire = lead.nextFire + 150;
        }
    }

    spawn(typeName, x, y) {
        let e = this.pool.find((p) => !p.alive && !p.active);
        if (!e) { e = new Enemy(this.scene); this.pool.push(e); }
        const fa = WAVES.firstAttackMs;
        let hovering = 0;
        for (const o of this.live) if (o.alive && o.hover && o.hoverMs > 0) hovering++;
        e.spawn(typeName, x, y, { hpMod: this.diff.enemyHealth, tier: this.tier, firstAttackMs: rand(fa[0], fa[1]), canHover: hovering < WAVES.maxHovering });
        this.live.push(e);
        return e;
    }

    /** Remove every enemy, calling fn(e) first (wave-clear explosions). */
    clearEnemies(fn) {
        for (const e of this.live) { if (e.alive) { if (fn) fn(e); e.despawn(); } }
        this.live.length = 0;
    }

    /** seconds left in the wave timer, or null when no wave is running */
    get secondsLeft() { return this.state === 'active' ? Math.ceil(this.timeLeft / 1000) : this.state === 'intro' ? Math.ceil(this.cfg.duration / 1000) : null; }

    destroy() { for (const e of this.pool) e.destroy(); this.pool.length = 0; this.live.length = 0; }
}
