// Local leaderboard: top 10 runs per mode ('normal' | 'daily'). The daily board only counts today's seed, so
// older days are pruned whenever a new daily score is submitted.
import { save } from './Save.js';
import { dateKey } from './rng.js';

export const BOARD_SIZE = 10;
export const MODES = ['normal', 'daily'];

/** Entries for a mode, best first: [{ score, wave, ship, date, at }]. */
export function topRuns(mode) {
    const all = save.leaderboard[mode] ?? [];
    const today = dateKey();
    return (mode === 'daily' ? all.filter((e) => e.date === today) : all).slice(0, BOARD_SIZE);
}

/**
 * Insert a finished run. Returns its 1-based rank, or 0 when it didn't make the board.
 * `at` (timestamp) identifies the entry so GameOver can highlight it.
 */
export function submitRun(mode, { score, wave, ship }, at = Date.now()) {
    if (!MODES.includes(mode) || score <= 0) return 0;
    const board = save.leaderboard;
    const today = dateKey();
    let list = (board[mode] ?? []).filter((e) => mode !== 'daily' || e.date === today);
    const entry = { score: Math.floor(score), wave, ship, date: today, at };
    list.push(entry);
    // ties: the older run keeps the higher place
    list.sort((a, b) => b.score - a.score || a.at - b.at);
    list = list.slice(0, BOARD_SIZE);
    board[mode] = list;
    save.leaderboard = board;
    return list.indexOf(entry) + 1;
}
