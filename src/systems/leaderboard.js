// Local leaderboard: top 10 runs per mode ('normal' | 'daily'). The daily board only counts today's seed, so
// older days are pruned whenever a new daily score is submitted. The world boards at the bottom come from the server.
import { save } from './Save.js';
import { dateKey } from './rng.js';
import { getJson } from './net.js';

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

// ---- world boards (server/, needs an API configured at build time and ONLINE on) ------------------------------------
export const WORLD_TABS = ['world', 'today'];   // all-time (normal runs) / today's daily seed

/** Top runs of a world board: [{ rank, id, name, score, wave, ship, diff, date, won }], or null when it could not be loaded. */
export async function fetchWorld(tab) {
    const q = tab === 'today' ? `mode=daily&day=${dateKey()}` : 'mode=normal';
    const res = await getJson(`/v1/board?${q}&limit=${BOARD_SIZE}`);
    return res && res.status === 200 && res.data?.ok ? res.data.rows : null;
}
