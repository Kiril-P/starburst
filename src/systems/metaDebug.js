// Dev-only console helpers for the meta layer: window.__meta (never installed in production builds).
//   __meta.credits(5000)        set the bank            __meta.state()          credits / levels / ships / achievements
//   __meta.achieve('combo8')    unlock one (no arg: all) __meta.resetAchievements()
//   __meta.resetMeta()          wipe credits, hangar levels, bought ships, leaderboard, lifetime counters
//   __meta.intro()              replay the story crawl  __meta.daily()          start today's Daily Run
//   __meta.sector()             show the sector-complete recap now (during a run)
//   __meta.board('normal')      leaderboard entries     __meta.seed()           current run seed (null = unseeded)
import { save } from './Save.js';
import { META_UPGRADES, metaLevel, setRunMode } from './meta.js';
import { ACHIEVEMENTS, debugUnlock, checkAchievements } from './achievements.js';
import { topRuns } from './leaderboard.js';
import { currentSeed } from './rng.js';

export function installMetaDebug(game) {
    if (!import.meta.env.DEV || window.__meta) return;
    const start = (key) => {
        const target = game.scene.getScene(key);
        // restarting a running scene must go through restart(): a stop + start in one queue leaves it half torn down
        if (target.sys.isActive()) { target.scene.restart(); return; }
        const active = game.scene.getScenes(true).filter((s) => !['SysOverlay', 'Wipe'].includes(s.sys.settings.key));
        active.forEach((s) => s.scene.stop());
        game.scene.start(key);
    };
    window.__meta = {
        credits(n) { if (n !== undefined) save.credits = n; return save.credits; },
        achieve(id) { if (id) debugUnlock(id); else debugUnlock(); return Object.keys(save.achievements).length; },
        resetAchievements() { save.achievements = {}; return 0; },
        resetMeta() {
            for (const k of ['credits', 'metaLevels', 'unlockedShips', 'leaderboard', 'lifetime']) localStorage.removeItem(k);
            return this.state();
        },
        intro() { save.seenIntro = false; start('Intro'); },
        daily() { setRunMode('daily'); start('Game'); },
        sector() { const g = game.scene.getScene('Game'); if (g?.run) g.run.showSector(); },
        board(mode = 'normal') { return topRuns(mode); },
        seed: () => currentSeed(),
        check: () => checkAchievements().map((a) => a.id),
        state() {
            return {
                credits: save.credits, levels: Object.fromEntries(META_UPGRADES.map((u) => [u.id, metaLevel(u.id)])),
                ships: save.unlockedShips, achievements: `${Object.keys(save.achievements).length}/${ACHIEVEMENTS.length}`, lifetime: save.lifetime
            };
        }
    };
}
