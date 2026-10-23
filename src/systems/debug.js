// Dev-only console / test hook: window.__dbg (never installed in production builds).
//   __dbg.skipToWave(8)  __dbg.godMode(true)  __dbg.spawn('circular', x?)  __dbg.killAll()
//   __dbg.unlockAll()    __dbg.hurt(30)       __dbg.spray(400)  (fill the screen with bullets for FPS tests)
//   __dbg.state()        -> { fps, bullets, enemies, wave, state, score, hp, combo, ... }
import { W } from '../config.js';
import { ring, style } from '../objects/patterns.js';

export function installDebug(scene) {
    if (!import.meta.env.DEV) return;
    const g = scene;
    window.__dbg = {
        scene: g,
        skipToWave(n) { g.combat.cancelBullets(false); g.waves.skipTo(n); },
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
                enemies: g.waves.live.length, wave: g.waves.wave, waveState: g.waves.state, timeLeft: g.waves.secondsLeft,
                score: g.combat.score, hp: g.player.hp, maxHp: g.player.maxHp, combo: g.combo.mult, stats: g.combat.stats,
                levels: g.player.levels, paused: g.paused, dying: g.dying, x: Math.round(g.player.x), y: Math.round(g.player.y)
            };
        }
    };
}
