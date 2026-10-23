// Single place for persistence. Keeps the legacy localStorage keys so existing players keep their progress.
const num = (k, d) => { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; };
const str = (k, d) => localStorage.getItem(k) || d;
const set = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage unavailable */ } };
// JSON values: a corrupt entry falls back to the default instead of breaking the menu
const json = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };

export const save = {
    get masterVolume() { return num('masterVolume', 1); },
    set masterVolume(v) { set('masterVolume', v); },
    get musicVolume() { return num('musicVolume', 0.7); },
    set musicVolume(v) { set('musicVolume', v); },
    get soundVolume() { return num('soundVolume', 0.8); },
    set soundVolume(v) { set('soundVolume', v); },

    // new in v2 (all default ON / 1)
    get screenShake() { return num('screenShake', 1); },       // 0 = off, 1 = full
    set screenShake(v) { set('screenShake', v); },
    get flashEffects() { return str('flashEffects', '1') === '1'; },
    set flashEffects(v) { set('flashEffects', v ? '1' : '0'); },
    get glow() { return str('glow', '1') === '1'; },           // optional bloom post-FX
    set glow(v) { set('glow', v ? '1' : '0'); },
    get quality() { const q = str('quality', 'auto'); return ['auto', 'high', 'low'].includes(q) ? q : 'auto'; },  // see systems/quality.js
    set quality(v) { set('quality', v); },
    get autoLow() { return str('autoLow', '0') === '1'; },     // AUTO quality measured a slow device on a previous run
    set autoLow(v) { set('autoLow', v ? '1' : '0'); },
    get showFps() { return str('showFps', '0') === '1'; },
    set showFps(v) { set('showFps', v ? '1' : '0'); },

    get ship() { return str('selectedShip', 'normal'); },      // 'normal' | 'speedy' | 'tank'
    set ship(v) { set('selectedShip', v); },
    get difficulty() { return str('selectedDifficulty', 'normal'); }, // 'easy' | 'normal' | 'hard'
    set difficulty(v) { set('selectedDifficulty', v); },

    get highScore() { return num('highScore', 0); },
    set highScore(v) { set('highScore', v); },
    get highWave() { return num('highWave', 1); },
    set highWave(v) { set('highWave', v); },
    get highestWaveCompleted() { return num('highestWaveCompleted', 0); },
    set highestWaveCompleted(v) { set('highestWaveCompleted', v); },

    get bossesDefeated() { return num('bossesDefeated', 0); },
    set bossesDefeated(v) { set('bossesDefeated', v); },

    get completedTasks() { try { return JSON.parse(localStorage.getItem('completedTasks') || '[]'); } catch (e) { return []; } },
    set completedTasks(v) { set('completedTasks', JSON.stringify(v)); },

    // --- meta progression (systems/meta.js, achievements.js, leaderboard.js) ---------------------------------
    get credits() { return Math.max(0, Math.floor(num('credits', 0))); },
    set credits(v) { set('credits', Math.max(0, Math.floor(v))); },
    get metaLevels() { return json('metaLevels', {}); },              // { hull: 2, damage: 1, ... }
    set metaLevels(v) { set('metaLevels', JSON.stringify(v)); },
    get unlockedShips() { return json('unlockedShips', ['normal']); }, // bought with credits (challenges are checked live)
    set unlockedShips(v) { set('unlockedShips', JSON.stringify(v)); },
    get achievements() { return json('achievements', {}); },          // { id: unlockedAtMs }
    set achievements(v) { set('achievements', JSON.stringify(v)); },
    get leaderboard() { return json('leaderboard', { normal: [], daily: [] }); },
    set leaderboard(v) { set('leaderboard', JSON.stringify(v)); },
    get lifetime() { return json('lifetime', {}); },                  // { runs, kills, graze, credits, dailies, purchases }
    set lifetime(v) { set('lifetime', JSON.stringify(v)); },
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
