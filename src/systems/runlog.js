// What happened in one run, for the telemetry (systems/telemetry.js) and the online boards: per-wave time / hull lost /
// hits taken, hull damage by source, and what dealt the lethal hit. Fed by Game (tick / wave / hurt); read once at the end.
// All of it is gameplay data: there is nothing in here that identifies a player.
import { save } from './Save.js';
import { runInfo } from './meta.js';
import { touchWanted } from '../ui/TouchControls.js';
import { BUILD, ENV } from './net.js';

const rid = () => {
    const b = new Uint8Array(16);
    (globalThis.crypto || { getRandomValues: (a) => a.map(() => (Math.random() * 256) | 0) }).getRandomValues(b);
    return Array.from(b, (v) => v.toString(36).padStart(2, '0')).join('').slice(0, 22);
};

const device = () => {
    if (touchWanted()) return 'touch';
    try { if ([...(navigator.getGamepads?.() || [])].some((p) => p && p.connected)) return 'gamepad'; } catch (e) { /* blocked */ }
    return 'keyboard';
};

export default class RunLog {
    constructor(game) {
        this.g = game;
        this.id = rid();
        const info = runInfo();
        this.mode = info.mode;
        this.day = info.date || '';
        this.diff = this.mode === 'daily' ? 'normal' : save.difficulty;
        this.ship = save.ship;
        this.ms = 0;
        this.waves = [];       // [wave, ms, hpLost, hits]
        this.cur = null;
        this.dmg = {};         // source -> hull points lost
        this.killer = '';
        this.won = false;
        this.fpsSum = 0; this.fpsN = 0; this.fpsT = 0;
        this.done = false;
    }

    tick(dt) {
        this.ms += dt;
        if (this.cur) this.cur[1] += dt;
        if ((this.fpsT += dt) >= 1000) {   // one frame-rate sample per simulated second
            this.fpsT -= 1000;
            const f = this.g.game.loop.actualFps;
            if (f > 0) { this.fpsSum += f; this.fpsN++; }
        }
    }

    /** a wave starts (Game.waveHooks.onIntro) */
    wave(n) {
        if (this.cur && this.cur[0] === n) return;
        this.cur = [n, 0, 0, 0];
        if (this.waves.length < 80) this.waves.push(this.cur);
    }

    /** the hull lost `hp` points to `src` (Combat.hurt); `dead` = it was the lethal hit */
    hurt(src, hp, dead) {
        const k = src || 'unknown';
        this.dmg[k] = (this.dmg[k] || 0) + hp;
        if (this.cur) { this.cur[2] += hp; this.cur[3]++; }
        if (dead) this.killer = k;
    }

    /** the finished run, in the shape POST /v1/run takes (the callsign is added by the sender) */
    finish(outcome, { score, wave, stats }) {
        this.done = true;
        const round = (n) => Math.round(n * 10) / 10;
        const dmg = {};
        for (const [k, v] of Object.entries(this.dmg)) dmg[k] = round(v);
        return {
            id: this.id, build: BUILD, env: ENV, mode: this.mode, day: this.day, ship: this.ship, diff: this.diff, outcome,
            won: this.won, assist: !save.leaderboardEligible, score: Math.max(0, Math.floor(score || 0)), wave: Math.max(1, wave || 1), dur: Math.round(this.ms),
            kills: stats?.kills ?? 0, graze: stats?.graze ?? 0, combo: stats?.maxCombo ?? 1, bosses: stats?.bosses ?? 0,
            killer: outcome === 'death' ? this.killer : '', device: device(), quality: save.quality, fps: this.fpsN ? Math.round(this.fpsSum / this.fpsN) : 0,
            waves: this.waves.map(([w, ms, hp, hits]) => [w, Math.round(ms), round(hp), hits]), dmg
        };
    }
}
