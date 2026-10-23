// Dev-only console / test hook: window.__dbg (never installed in production builds).
//   __dbg.skipToWave(8)  __dbg.godMode(true)  __dbg.spawn('circular', x?)  __dbg.killAll()
//   __dbg.unlockAll()    __dbg.hurt(30)       __dbg.spray(400)  (fill the screen with bullets for FPS tests)
//   __dbg.boss(1)   jump to the n-th boss (1 Warden, 2 Hive, 3 Prism, 4 Warden MK2 ...)   __dbg.bossHp(0.5)
//   weapons / loot helpers: see objects/weapons/debugGear.js (__dbg.weapon, drop, buff, offers, gear ...)
//   __dbg.state()        -> { fps, bullets, enemies, wave, state, score, hp, combo, ... }
import { W } from '../config.js';
import { ring, style } from '../objects/patterns.js';
import { BOSS_EVERY } from '../objects/waves.js';
import { installEnemyDebug } from '../objects/enemyDebug.js';
import { gearDebug } from '../objects/weapons/debugGear.js';

export function installDebug(scene) {
    if (!import.meta.env.DEV) return;
    const g = scene;
    window.__dbg = {
        scene: g,
        skipToWave(n) { g.combat.cancelBullets(false); g.waves.skipTo(n); },
        boss(n = 1) { this.skipToWave(n * BOSS_EVERY); return g.bosses.boss?.def.name; },
        /** set the current boss's HP to a fraction (triggers phase shifts / death like real damage) */
        bossHp(f = 0.5) { const b = g.bosses.boss; if (!b || !b.alive) return null; b.state = 'fight'; b.invulnMs = 0; b.shut = false; b.hit(b.hp - b.maxHp * f, b.targets[0]); return b.phase; },
        godMode(on = true) { g.god = on; return on; },
        spawn(type = 'basic', x = W / 2, y = -10) { return g.waves.spawn(type, x, y); },
        killAll() { for (const e of [...g.waves.live]) if (e.alive) g.combat.killEnemy(e, true); },
        unlockAll() { for (const id of ['dash', 'forcefield', 'phase']) if (!g.player.levels[id]) g.player.applyUpgrade(id); },
        hurt(n = 20) { g.combat.hurt(n); },
        spray(count = 400) {
            const st = [style('orbS', 'magenta'), style('needle', 'amber'), style('ring', 'magenta'), style('shard', 'lime')];
            for (let i = 0; i < count / 20; i++) {
                ring(g.enemyBullets, 40 + Math.random() * (W - 80), 20 + Math.random() * 120, { count: 20, speed: 20 + Math.random() * 40, style: st[i % 4], offset: Math.random() });
            }
        },
        state() {
            return {
                fps: Math.round(g.game.loop.actualFps), bullets: g.enemyBullets.count, shots: g.shots.count,
                enemies: g.waves.live.length, boss: g.bosses.boss ? { name: g.bosses.boss.def.name, hp: Math.round(g.bosses.boss.hp), phase: g.bosses.boss.phase, state: g.bosses.boss.state } : null, wave: g.waves.wave, waveState: g.waves.state, timeLeft: g.waves.secondsLeft,
                score: g.combat.score, hp: g.player.hp, maxHp: g.player.maxHp, combo: g.combo.mult, stats: g.combat.stats,
                levels: g.player.levels, paused: g.paused, dying: g.dying, x: Math.round(g.player.x), y: Math.round(g.player.y)
            };
        }
    };
    installEnemyDebug(g, window.__dbg);   // formation / sector / biome / zoo helpers
    Object.assign(window.__dbg, gearDebug(g));
}
