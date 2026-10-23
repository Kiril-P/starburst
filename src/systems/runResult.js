// End-of-run bookkeeping for the meta layer, called once by GameOver.create: bank the credits, bump the
// lifetime counters, submit to the local leaderboard and run the end-of-run achievement checks.
import { save } from './Save.js';
import { runInfo, creditsForRun, bumpLifetime } from './meta.js';
import { submitRun } from './leaderboard.js';
import { checkAchievements, sessionUnlocks } from './achievements.js';

/**
 * data: GameOver's { score, wave, stats: { graze, maxCombo, kills, bosses } }.
 * Returns { mode, credits: { lines, base, mult, total }, bank, rank, at, achievements: [...] }.
 */
export function settleRun(data = {}) {
    const info = runInfo();
    const score = Math.max(0, Math.floor(data.score || 0));
    const wave = Math.max(1, data.wave || 1);
    const s = data.stats || {};
    const run = {
        score, wave, kills: s.kills ?? 0, graze: s.graze ?? 0, maxCombo: s.maxCombo ?? 1, bosses: s.bosses ?? 0,
        ship: save.ship, difficulty: info.mode === 'daily' ? 'normal' : save.difficulty, mode: info.mode
    };
    const credits = creditsForRun(run, info.mode, run.difficulty);
    save.credits += credits.total;
    bumpLifetime({ runs: 1, kills: run.kills, graze: run.graze, credits: credits.total, dailies: info.mode === 'daily' ? 1 : 0 });
    const at = Date.now();
    const rank = submitRun(info.mode, run, at);
    checkAchievements(run);
    return { mode: info.mode, date: info.date, credits, bank: save.credits, rank, at, achievements: sessionUnlocks() };
}
