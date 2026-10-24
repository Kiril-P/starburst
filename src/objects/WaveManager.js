// Timed waves, v1 rules: survive the timer; each enemy type spawns on its own jittered interval while
// the number of active enemies is below the wave's max. Then: wave clear -> upgrade pick -> next wave.
// Boss waves (bosses/roster.js isBossWave) have no timer or spawners: state 'boss' waits for bossDefeated() (BossDirector).
// Driven by simulation dt (no scene timers) so pause / hit-stop / slow-mo freeze it naturally.
import { W } from '../config.js';
import { WAVES } from '../systems/tuning.js';
import { WAVE_TABLE, BOSS_EVERY } from './waves.js';
import { isBossWave } from './bosses/roster.js';   // main bosses every 5th wave + mid-bosses (waves 3, 8, 13 ...)
import { resolveType, ENEMY_TYPES } from './enemyTypes.js';
import Enemy from './Enemy.js';
import Formations from './formations.js';
import { applyScript } from './waveScripts.js';
import { runEvent, eventDue } from './waveEvents.js';
import { applySector, sectorBiome, sectorInfo, isSectorStart } from './sectors.js';
import SectorBanner from '../fx/SectorBanner.js';

import { rngStream } from '../systems/rng.js';

const rnd = rngStream('spawns');    // seeded in Daily Runs (systems/rng.js), Math.random otherwise
const rand = (a, b) => a + rnd() * (b - a);

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
        this.formations = new Formations(this);
        this.banner = new SectorBanner(scene);
    }

    get biome() { return sectorBiome(this.wave); }   // one backdrop per sector (sectors.js)

    get isBoss() { return isBossWave(this.wave); }

    get tier() { const t = WAVES.tierByWave; return t[Math.min(this.wave, t.length) - 1] ?? 0; }

    /** effective config for a wave number (1-based), including endless scaling past the authored table */
    config(wave) {
        const last = WAVE_TABLE.length, rows = WAVES.tableRowByWave;
        const row = wave <= rows.length ? rows[wave - 1] : rows[rows.length - 1] + wave - rows.length;
        const base = WAVE_TABLE[Math.min(row, last) - 1];
        const extra = Math.max(0, row - last);
        const spawnF = Math.pow(WAVES.endlessSpawnFactor, extra) * this.diff.enemySpawn;
        return applyScript(applySector({
            duration: base.duration * WAVES.durationScale,
            max: Math.round(base.max * WAVES.maxActiveScale * this.diff.maxEnemies),
            spawns: base.spawns.map(([type, every]) => ({ type, every: every * spawnF })),
            bulletSpeed: 1 + extra * WAVES.endlessBulletSpeedStep
        }, wave, spawnF), wave, spawnF);
    }

    start(wave) {
        this.wave = wave;
        this.cfg = this.config(wave);
        this.state = 'intro';
        this.timer = WAVES.introMs;
        this.timeLeft = this.cfg.duration;
        if (this.isBoss) { this.state = 'boss'; this.spawners = []; }
        this.hooks.onIntro(wave, this.cfg);
        if (isSectorStart(wave)) this.banner.show(wave, sectorInfo(wave));
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
        this.spawners = this.cfg.spawns.map((s, i) => ({ type: s.type, every: s.every, filler: !!s.filler, next: s.delay ?? (i * WAVES.staggerMs + (s.type.startsWith('f:') ? s.every * 0.5 : 0)) }));
        this.elapsed = 0; this.calm = 0; this.surge = 1;
        this.events = (this.cfg.events || []).map((e) => ({ ...e, done: false }));   // scripted timeline (waveScripts.js)
        if (this.cfg.opener) this.formations.launch(this.cfg.opener, true);   // every wave opens with a set piece
        this.hooks.onStart(this.wave);
    }

    update(dt, ctx) {
        switch (this.state) {
            case 'intro':
                if ((this.timer -= dt) <= 0) this.beginSpawning();
                break;
            case 'active':
                this.timeLeft -= dt;
                this.elapsed += dt;
                for (const ev of this.events) if (!ev.done && eventDue(this, ev)) { ev.done = true; runEvent(this, ev); }
                const calm = (this.calm -= dt) > 0;   // scripted lull: spawners hold (formations already queued still arrive)
                for (const sp of this.spawners) {
                    if (calm) { sp.next = Math.max(sp.next, 700); continue; }
                    if ((sp.next -= dt * this.surge) > 0) continue;
                    const j = sp.every * WAVES.spawnJitter;
                    sp.next += Math.max(WAVES.minSpawnMs, sp.every + rand(-j, j));
                    if (this.room() > (sp.filler ? this.cfg.reserve || 0 : 0)) this.spawnGroup(resolveType(sp.type, rnd));
                }
                this.formations.update(dt);
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
            if (!e.alive) { e.listed = false; live[i] = live[live.length - 1]; live.pop(); }
        }
    }

    /** free slots under the wave's max-active cap; minor enemies (mines, split pods) don't take a slot */
    room() {
        let n = 0;
        for (const e of this.live) if (e.alive && !e.type.minor) n++;
        return this.cfg.max - n;
    }

    resolve(name) { return resolveType(name); }

    spawnGroup(typeName) {
        if (typeName.startsWith('f:')) { this.formations.launch(typeName.slice(2)); return; }
        const cap = ENEMY_TYPES[typeName].maxAlive;
        if (cap && this.live.reduce((k, e) => k + (e.alive && e.typeName === typeName), 0) >= cap) return;
        const m = WAVES.spawnMarginX, gap = WAVES.formationSpacing;
        const formation = typeName === 'basic' && this.room() >= 3 && rnd() < WAVES.formationChance[this.tier];
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

    /** extra: per-type spawn options (e.g. kamikaze { delay }) */
    spawn(typeName, x, y, extra) {
        // `listed`: a just-killed enemy stays in `live` until the next sweep; reusing it now would list it twice
        let e = this.pool.find((p) => !p.alive && !p.active && !p.listed);
        if (!e) { e = new Enemy(this.scene); this.pool.push(e); }
        const fa = WAVES.firstAttackMs;
        let hovering = 0;
        for (const o of this.live) if (o.alive && o.hover && o.hoverMs > 0) hovering++;
        e.spawn(typeName, x, y, { hpMod: this.diff.enemyHealth, tier: this.tier, firstAttackMs: rand(fa[0], fa[1]), canHover: hovering < WAVES.maxHovering, ...extra });
        e.listed = true;
        this.live.push(e);
        return e;
    }

    /** Remove every enemy, calling fn(e) first (wave-clear explosions). */
    clearEnemies(fn) {
        this.formations.clear();
        for (const e of this.live) { if (e.alive) { if (fn) fn(e); e.despawn(); } e.listed = false; }
        this.live.length = 0;
    }

    /** seconds left in the wave timer, or null when no wave is running */
    get secondsLeft() { return this.state === 'active' ? Math.ceil(this.timeLeft / 1000) : this.state === 'intro' ? Math.ceil(this.cfg.duration / 1000) : null; }

    destroy() { this.banner.destroy(); for (const e of this.pool) e.destroy(); this.pool.length = 0; this.live.length = 0; }
}
