// Feedback sfx added by the sound pass: chain explosions, kill streaks, wave banners, one pickup sound per type,
// boss phase / death, low-HP warning and the upgrade card. Callers vary `rate` (chain count, streak tier, ...), so each
// recipe is written to stay pleasant across about +-1 octave.
import { TAU, decay, ar, sweep, sat, seqHz, noteT } from './kit.js';

export const GAME = {
    // chain explosion: a pitched pop (callers raise the rate per link: CHAIN x2, x3 ... climbs a scale)
    'chain-pop': {
        len: 0.32, peak: 0.7, fn: (k) => {
            const o = k.osc('sine'), r = k.osc('tri'), b = k.bp();
            return (t) => o(sweep(520, 140, 0.1, t)) * decay(t, 0.09) * 0.9 + b(k.noise(), 1900) * decay(t, 0.04) * 1.2 + r(sweep(1320, 1000, 0.2, t)) * decay(t, 0.1) * 0.45;
        }
    },
    // kill streak: bright 4-note run (E major), shimmer on the last note
    streak: {
        len: 0.55, peak: 0.62, fn: (k) => {
            const a = k.osc('pulse'), b = k.osc('tri'), f = k.lp();
            const n = [[0, 659], [0.06, 831], [0.12, 988], [0.18, 1319]];
            return (t) => { const hz = seqHz(n, t), last = t >= 0.18; return f(a(hz) * 0.55 + b(hz * 2) * 0.35, 7500) * decay(noteT(n, t), last ? 0.2 : 0.045); };
        }
    },
    // wave banner slides in: soft air sweep plus a two-note ping
    banner: {
        len: 0.7, peak: 0.55, fn: (k) => {
            const b = k.bp(), a = k.osc('sine'), c = k.osc('sine');
            return (t) => b(k.noise(), sweep(250, 2600, 0.35, t)) * ar(t, 0.2, 0.4) * 1.2 + a(880) * (t >= 0.28 ? decay(t - 0.28, 0.12) : 0) * 0.5 + c(1319) * (t >= 0.36 ? decay(t - 0.36, 0.16) : 0) * 0.5;
        }
    },
    // repair: warm triad chime, the only soft "heal" sound
    'pickup-repair': {
        len: 0.55, peak: 0.6, fn: (k) => {
            const a = k.osc('tri'), b = k.osc('tri'), c = k.osc('tri'), s = k.osc('sine');
            return (t) => (a(1047) * decay(t, 0.2) + b(1319) * (t > 0.06 ? decay(t - 0.06, 0.2) : 0) + c(1568) * (t > 0.12 ? decay(t - 0.12, 0.22) : 0)) * 0.4 + s(2093) * decay(t, 0.3) * 0.15;
        }
    },
    // magnet: a sweep that pulls inward (high to low) with a wobble
    'pickup-magnet': {
        len: 0.5, peak: 0.6, fn: (k) => {
            const o = k.osc('sine'), p = k.osc('tri');
            return (t) => (o(sweep(1500, 220, 0.4, t)) * 0.6 + p(sweep(750, 110, 0.4, t)) * 0.3) * (1 + 0.5 * Math.sin(t * TAU * 22)) * ar(t, 0.02, 0.5);
        }
    },
    // rapid fire: a ratchet of rising ticks
    'pickup-rapid': {
        len: 0.42, peak: 0.55, fn: (k) => {
            const o = k.osc('pulse'), f = k.lp();
            return (t) => { const i = Math.floor(t / 0.045); return f(o(660 * Math.pow(2, i / 6)), 6000) * decay(t - i * 0.045, 0.02) * (t < 0.36 ? 1 : 0); };
        }
    },
    // x2 score: cash-register two-note ping with a bell on top
    'pickup-x2': {
        len: 0.5, peak: 0.62, fn: (k) => {
            const a = k.osc('square'), b = k.osc('sine'), h = k.hp(), f = k.lp();
            return (t) => f(a(t < 0.07 ? 988 : 1319), 6000) * decay(t < 0.07 ? t : t - 0.07, t < 0.07 ? 0.07 : 0.1) * 0.7 + b(2637) * decay(t, 0.2) * 0.3 + h(k.noise(), 6000) * decay(t, 0.008) * 0.3;
        }
    },
    // shield up: a bubble that swells then rings
    'pickup-shield': {
        len: 0.6, peak: 0.6, fn: (k) => {
            const o = k.osc('sine'), b = k.osc('sine'), c = k.osc('sine');
            return (t) => o(sweep(300, 1250, 0.25, t)) * ar(t, 0.02, 0.3) * 0.5 + (b(1800) + c(2400) * 0.7) * (t > 0.2 ? decay(t - 0.2, 0.15) : 0) * 0.4 * (1 + 0.3 * Math.sin(t * TAU * 9));
        }
    },
    // bomb: fuse beeps + a deep thud (the explosion itself is boss-explosion)
    'pickup-bomb': {
        len: 0.42, peak: 0.65, fn: (k) => {
            const o = k.osc('square'), s = k.osc('sine');
            return (t) => (t < 0.2 ? o(1000) * (((t / 0.07) | 0) % 2 === 0 ? 1 : 0) * 0.4 : 0) + (t >= 0.2 ? s(sweep(110, 40, 0.15, t - 0.2)) * decay(t - 0.2, 0.09) * 1.2 : 0);
        }
    },
    // boss phase change: dissonant stab that slams down, with a noise wash
    'boss-phase': {
        len: 1.1, peak: 0.8, fn: (k) => {
            const a = k.osc('saw'), b = k.osc('saw'), s = k.osc('sine'), f = k.lp(), n = k.lp();
            return (t) => f(a(110) + b(155.6) * 0.8 + a(0) * 0, 200 + 2600 * decay(t, 0.3)) * decay(t, 0.35) * 0.8 + s(sweep(100, 32, 0.4, t)) * decay(t, 0.3) * 1.0 + n(k.noise(), sweep(6000, 400, 0.9, t)) * decay(t, 0.3) * 0.5;
        }
    },
    // boss defeated: a chain of rolling booms, then a long shimmering tail
    'boss-death': {
        len: 3.4, peak: 0.9, fn: (k) => {
            const s = k.osc('sine'), f = k.lp(), g = k.lp(), sh = k.osc('sine'), sh2 = k.osc('sine');
            const hits = [0, 0.38, 0.7, 1.05, 1.5];
            return (t) => {
                let v = 0;
                for (let i = 0; i < hits.length; i++) if (t >= hits[i]) { const u = t - hits[i]; v += (f(k.noise(), sweep(3200, 120, 0.7, u)) * 0.6 + s(sweep(95 - i * 8, 28, 0.4, u)) * 0.8) * decay(u, 0.28 + i * 0.05) / (1 + i * 0.25); }
                const tail = t > 1.5 ? (sh(sweep(1500, 380, 1.8, t - 1.5)) + sh2(sweep(2250, 570, 1.8, t - 1.5)) * 0.5) * decay(t - 1.5, 0.7) * 0.18 : 0;
                return v + tail + g(k.noise(), 700) * decay(t, 1.0) * 0.4;
            };
        }
    },
    // low hull: heartbeat double thump + a short alarm beep; plays about once a second while HP is critical
    'low-hp': {
        len: 0.5, peak: 0.6, fn: (k) => {
            const s = k.osc('sine'), o = k.osc('square'), f = k.lp();
            const thump = (u, hz) => (u >= 0 ? s(hz * (1 + 0.5 * decay(u, 0.03))) * decay(u, 0.07) : 0);
            return (t) => thump(t, 58) * 1.0 + thump(t - 0.17, 52) * 0.8 + f(o(880), 3000) * (t >= 0.3 && t < 0.36 ? 0.18 : 0);
        }
    },
    // upgrade card hover / reveal tick
    'upgrade-card': { len: 0.1, peak: 0.45, fn: (k) => { const o = k.osc('tri'), p = k.osc('sine'); return (t) => (o(sweep(740, 1480, 0.08, t)) + p(2960) * 0.2) * decay(t, 0.04); } }
};
