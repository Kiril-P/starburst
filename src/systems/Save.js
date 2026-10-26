// Single place for persistence. Keeps the legacy localStorage keys so existing players keep their progress.
// localStorage is attacker/user-editable and can be corrupt: every read is type-checked and clamped here, so the rest of
// the game only ever sees values of the right shape (numbers finite and in range, arrays/objects of the expected kind).
import { SHIPS } from '../config.js';
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const MAX_NUM = 1e12;   // far above any real score / credit count, far below precision loss
const raw = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };   // storage can throw (blocked / sandboxed iframe)
const num = (k, d, min = 0, max = MAX_NUM) => { const v = parseFloat(raw(k)); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d; };
const str = (k, d) => raw(k) || d;
const oneOf = (k, list, d) => { const v = str(k, d); return list.includes(v) ? v : d; };
const set = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage unavailable */ } };
const kind = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
// JSON values: a corrupt entry, or one of the wrong kind (array vs object vs number ...), falls back to the default
// instead of breaking the menu. Own "__proto__" keys from hostile JSON are dropped.
const clean = (v) => { if (v && typeof v === 'object' && !Array.isArray(v)) delete v.__proto__; return v; };
const json = (k, d) => { try { const v = JSON.parse(raw(k)); return kind(v) === kind(d) ? clean(v) : d; } catch (e) { return d; } };

export const save = {
    get masterVolume() { return num('masterVolume', 1, 0, 1); },
    set masterVolume(v) { set('masterVolume', v); },
    get musicVolume() { return num('musicVolume', 0.7, 0, 1); },
    set musicVolume(v) { set('musicVolume', v); },
    get soundVolume() { return num('soundVolume', 0.8, 0, 1); },
    set soundVolume(v) { set('soundVolume', v); },

    // new in v2 (all default ON / 1)
    get screenShake() { return num('screenShake', 1, 0, 3); },       // 0 = off, 1 = full
    set screenShake(v) { set('screenShake', v); },
    get flashEffects() { return str('flashEffects', '1') === '1'; },
    set flashEffects(v) { set('flashEffects', v ? '1' : '0'); },
    get glow() { return str('glow', '1') === '1'; },           // optional bloom post-FX
    set glow(v) { set('glow', v ? '1' : '0'); },
    get quality() { return oneOf('quality', ['auto', 'high', 'low'], 'auto'); },  // see systems/quality.js
    set quality(v) { set('quality', v); },
    get autoLow() { return str('autoLow', '0') === '1'; },     // AUTO quality measured a slow device on a previous run
    set autoLow(v) { set('autoLow', v ? '1' : '0'); },
    get showFps() { return str('showFps', '0') === '1'; },
    set showFps(v) { set('showFps', v ? '1' : '0'); },

    // accessibility / controls (see systems/bindings.js, systems/access.js)
    get bindings() { const b = json('keyBindings', {}); return Object.keys(b).length ? b : null; },
    set bindings(v) { set('keyBindings', JSON.stringify(v)); },
    get aimMode() { return str('aimMode', 'move') === 'mouse' ? 'mouse' : 'move'; },   // 'move' | 'mouse'
    set aimMode(v) { set('aimMode', v); },
    get bulletContrast() { return oneOf('bulletContrast', ['off', 'hc', 'cb'], 'off'); },
    set bulletContrast(v) { set('bulletContrast', v); },
    get assist() { return str('assist', '0') === '1'; },
    set assist(v) { set('assist', v ? '1' : '0'); },
    /** runs played with assist mode must never be submitted to a leaderboard */
    get leaderboardEligible() { return !this.assist; },

    get ship() { return oneOf('selectedShip', SHIPS, 'normal'); },      // 'normal' | 'speedy' | 'tank'
    set ship(v) { set('selectedShip', v); },
    get difficulty() { return oneOf('selectedDifficulty', DIFFICULTIES, 'normal'); }, // 'easy' | 'normal' | 'hard'
    set difficulty(v) { set('selectedDifficulty', v); },

    get highScore() { return num('highScore', 0); },
    set highScore(v) { set('highScore', v); },
    get highWave() { return Math.max(1, num('highWave', 1)); },
    set highWave(v) { set('highWave', v); },
    get highestWaveCompleted() { return num('highestWaveCompleted', 0); },
    set highestWaveCompleted(v) { set('highestWaveCompleted', v); },

    get bossesDefeated() { return num('bossesDefeated', 0); },
    set bossesDefeated(v) { set('bossesDefeated', v); },

    // boss gallery: { [bossId]: { seen, kills, best (ms) } } (objects/bosses/roster.js)
    get bossLog() { return json('bossLog', {}); },
    set bossLog(v) { set('bossLog', JSON.stringify(v)); },

    get completedTasks() { return json('completedTasks', []).filter((id) => typeof id === 'string'); },
    set completedTasks(v) { set('completedTasks', JSON.stringify(v)); },

    // --- meta progression (systems/meta.js, achievements.js, leaderboard.js) ---------------------------------
    get credits() { return Math.floor(num('credits', 0)); },
    set credits(v) { set('credits', Math.max(0, Math.floor(v))); },
    get metaLevels() { return json('metaLevels', {}); },              // { hull: 2, damage: 1, ... }
    set metaLevels(v) { set('metaLevels', JSON.stringify(v)); },
    get unlockedShips() { return json('unlockedShips', ['normal']).filter((id) => typeof id === 'string'); }, // bought with credits (challenges are checked live)
    set unlockedShips(v) { set('unlockedShips', JSON.stringify(v)); },
    get achievements() { return json('achievements', {}); },          // { id: unlockedAtMs }
    set achievements(v) { set('achievements', JSON.stringify(v)); },
    get leaderboard() { const l = json('leaderboard', {}); return { ...l, normal: Array.isArray(l.normal) ? l.normal : [], daily: Array.isArray(l.daily) ? l.daily : [] }; },
    set leaderboard(v) { set('leaderboard', JSON.stringify(v)); },
    get lifetime() { return json('lifetime', {}); },                  // { runs, kills, graze, credits, dailies, purchases }
    set lifetime(v) { set('lifetime', JSON.stringify(v)); },
    // --- online (systems/net.js): boards + anonymous telemetry, on by default, one switch in SETTINGS ---------------
    get online() { return str('online', '1') === '1'; },
    set online(v) { set('online', v ? '1' : '0'); },
    get callsign() { const c = str('callsign', ''); return /^[A-Z0-9]{3}$/.test(c) ? c : ''; },   // 3-char arcade name for the world boards
    set callsign(v) { set('callsign', v); },
    get worldRuns() { return json('worldRuns', []).filter((id) => typeof id === 'string').slice(-30); },   // ids of this device's board entries (to highlight them)
    set worldRuns(v) { set('worldRuns', JSON.stringify(v.slice(-30))); },
    get outbox() { return json('outbox', []).filter((r) => r && typeof r === 'object').slice(-20); },      // runs that could not be sent (offline)
    set outbox(v) { set('outbox', JSON.stringify(v.slice(-20))); },
    get seenIntro() { return str('seenIntro', '0') === '1'; },
    set seenIntro(v) { set('seenIntro', v ? '1' : '0'); },

    /** Record a finished run. Returns { newBestScore, newBestWave }. */
    recordRun(score, wave) {
        const newBestScore = score > this.highScore;
        const newBestWave = wave > this.highWave;
        if (newBestScore) this.highScore = score;
        if (newBestWave) this.highWave = wave;
        if (wave - 1 > this.highestWaveCompleted) this.highestWaveCompleted = wave - 1;
        return { newBestScore, newBestWave };
    }
};
