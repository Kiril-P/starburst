// Combat sfx: one recipe per weapon family (so spread / lance / missiles / drones / charge are told apart by ear),
// enemy fire, deaths, dash / forcefield / phase abilities, damage and the thruster loop. These replace the old
// sample files; keys keep the names the game already plays.
import { TAU, decay, ar, sweep, sat, seqHz, noteT } from './kit.js';

export const COMBAT = {
    // blaster: a short falling "pew" (square), the bread-and-butter shot
    'player-shoot': { len: 0.11, peak: 0.5, fn: (k) => { const o = k.osc('pulse'), f = k.lp(); return (t) => f(o(sweep(1700, 480, 0.1, t)), 5500) * decay(t, 0.04) + k.noise() * decay(t, 0.003) * 0.15; } },
    // spread: a fat triple chirp (three detuned pellets) with a breathy top
    'shoot-spread': {
        len: 0.16, peak: 0.55, fn: (k) => {
            const a = k.osc('tri'), b = k.osc('tri'), c = k.osc('tri'), h = k.hp();
            return (t) => (a(sweep(1100, 380, 0.14, t)) + b(sweep(1330, 450, 0.14, t)) * 0.8 + c(sweep(880, 300, 0.14, t)) * 0.8) * decay(t, 0.05) * 0.45 + h(k.noise(), 2500) * decay(t, 0.03) * 0.35;
        }
    },
    // lance: a bright piercing zap - saw whip up then ring
    'shoot-lance': {
        len: 0.24, peak: 0.55, fn: (k) => {
            const a = k.osc('saw'), r = k.osc('sine'), f = k.lp();
            return (t) => f(a(sweep(500, 3200, 0.05, t) * (t > 0.05 ? Math.pow(0.55, (t - 0.05) / 0.19) : 1)), 6500) * ar(t, 0.004, 0.24) * 0.6 + r(2700) * (1 + 0.5 * Math.sin(t * TAU * 60)) * decay(t, 0.09) * 0.3;
        }
    },
    // missile: whoosh + a low thump as it leaves the rail
    'shoot-missile': {
        len: 0.42, peak: 0.55, fn: (k) => {
            const f = k.lp(), o = k.osc('sine');
            return (t) => f(k.noise(), sweep(350, 2400, 0.4, t)) * ar(t, 0.05, 0.42) * 0.9 + o(sweep(140, 55, 0.1, t)) * decay(t, 0.07) * 0.9;
        }
    },
    // drone gun: tiny high tick, deliberately small so three drones don't swamp the mix
    'shoot-drone': { len: 0.06, peak: 0.4, fn: (k) => { const o = k.osc('sine'), p = k.osc('tri'); return (t) => (o(sweep(2600, 1700, 0.05, t)) + p(sweep(3900, 2500, 0.05, t)) * 0.4) * decay(t, 0.014); } },
    // charge: rising tier ping while holding, and the release blast (a heavy falling saw with a noise tail)
    'charge-tick': { len: 0.1, peak: 0.45, fn: (k) => { const o = k.osc('sine'), p = k.osc('tri'); return (t) => (o(1320) + p(2640) * 0.4) * decay(t, 0.04); } },
    'charge-blast': {
        len: 0.55, peak: 0.8, fn: (k) => {
            const a = k.osc('saw'), s = k.osc('sine'), f = k.lp(), n = k.lp();
            return (t) => f(a(sweep(1100, 70, 0.4, t)), sweep(5000, 400, 0.4, t)) * ar(t, 0.004, 0.55) * 0.7 + s(sweep(180, 45, 0.3, t)) * decay(t, 0.18) * 0.9 + n(k.noise(), 1800) * decay(t, 0.12) * 0.5;
        }
    },
    // enemies fire lower and duller than the player, with a pulse that falls less far (so it reads as "theirs")
    'enemy-shoot': { len: 0.1, peak: 0.38, fn: (k) => { const o = k.osc('square'), f = k.lp(); return (t) => f(o(sweep(640, 330, 0.09, t)), 2600) * decay(t, 0.035); } },
    // dash: air rush rising; dash-alt: the same falling (the game alternates them)
    dash: { len: 0.28, peak: 0.6, fn: (k) => { const b = k.bp(), o = k.osc('sine'); return (t) => b(k.noise(), sweep(450, 3800, 0.22, t)) * ar(t, 0.07, 0.28) * 1.6 + o(sweep(220, 700, 0.2, t)) * ar(t, 0.05, 0.28) * 0.25; } },
    'dash-alt': { len: 0.28, peak: 0.6, fn: (k) => { const b = k.bp(), o = k.osc('tri'); return (t) => b(k.noise(), sweep(3800, 420, 0.24, t)) * ar(t, 0.03, 0.28) * 1.6 + o(sweep(800, 240, 0.22, t)) * ar(t, 0.03, 0.28) * 0.25; } },
    // standard explosion: noise burst with a closing low-pass over a falling thump, a little crackle at the front
    'enemy-death': {
        len: 0.38, peak: 0.72, fn: (k) => {
            const f = k.lp(), o = k.osc('sine');
            return (t) => f(k.noise(), sweep(5200, 180, 0.3, t)) * decay(t, 0.1) * 1.4 + o(sweep(150, 40, 0.15, t)) * decay(t, 0.1) * 0.9 + k.noise() * decay(t, 0.006) * 0.4;
        }
    },
    // big enemy: deeper, longer, with a second rumble
    'enemy-death-big': {
        len: 0.75, peak: 0.85, fn: (k) => {
            const f = k.lp(), f2 = k.lp(), o = k.osc('sine');
            return (t) => f(k.noise(), sweep(3600, 120, 0.6, t)) * decay(t, 0.22) * 1.3 + f2(k.noise(), 300) * decay(Math.max(0, t - 0.1), 0.25) * (t > 0.1 ? 0.9 : 0) + o(sweep(110, 28, 0.35, t)) * decay(t, 0.22) * 1.1;
        }
    },
    // forcefield: rising shimmer that settles into a glassy chime
    forcefield: {
        len: 0.62, peak: 0.65, fn: (k) => {
            const a = k.osc('sine'), b = k.osc('sine'), c = k.osc('sine');
            return (t) => t < 0.3
                ? a(sweep(300, 1900, 0.3, t)) * (1 + 0.5 * Math.sin(t * TAU * 28)) * ar(t, 0.02, 0.3) * 0.5
                : (b(1568) + c(2349) * 0.5) * decay(t - 0.3, 0.14) * 0.6;
        }
    },
    // phase shift: wobbly down-chirp, like reality being re-tuned
    'phase-shift': {
        len: 0.55, peak: 0.6, fn: (k) => {
            const a = k.osc('saw'), b = k.osc('saw'), f = k.lp();
            return (t) => f(a(sweep(1200, 220, 0.5, t) * (1 + 0.04 * Math.sin(t * TAU * 11))) + b(sweep(1230, 226, 0.5, t) * (1 + 0.04 * Math.sin(t * TAU * 13))), 2800) * ar(t, 0.01, 0.55) * 0.5 * (0.6 + 0.4 * Math.sin(t * TAU * 18));
        }
    },
    // player hit: distorted buzz + crunch, clearly harsher than any pickup
    'player-damaged': {
        len: 0.36, peak: 0.78, fn: (k) => {
            const a = k.osc('saw'), s = k.osc('sine'), f = k.lp();
            return (t) => sat(a(sweep(230, 70, 0.3, t)), 3) * decay(t, 0.13) * 0.7 + f(k.noise(), 2600) * decay(t, 0.07) * 0.9 + s(sweep(110, 45, 0.15, t)) * decay(t, 0.1);
        }
    },
    // player death: stuttering crash into a long falling boom
    'player-death': {
        len: 1.6, peak: 0.9, fn: (k) => {
            const f = k.lp(), a = k.osc('saw'), s = k.osc('sine'), g = k.lp();
            return (t) => {
                const gate = t < 0.45 ? (Math.sin(t * TAU * 17) > -0.2 ? 1 : 0.15) : 1;
                return f(k.noise(), sweep(4200, 90, 1.2, t)) * decay(t, 0.55) * 1.4 * gate + sat(a(sweep(320, 28, 1.1, t)), 2) * decay(t, 0.5) * 0.5 + s(sweep(90, 26, 0.8, t)) * decay(t, 0.55) * 1.0 + g(k.noise(), 1200) * decay(t, 0.02) * 0.5;
            };
        }
    },
    // soft tick for menu buttons / counters, a little rounder than ui-select
    'button-sound': { len: 0.11, peak: 0.5, fn: (k) => { const o = k.osc('tri'), f = k.lp(); const n = [[0, 660], [0.04, 990]]; return (t) => f(o(seqHz(n, t)), 5000) * decay(noteT(n, t), 0.03); } },
    // loopable engine rumble: every modulation is an integer number of cycles in the 1.2 s loop, so it wraps cleanly
    'thruster-hum': {
        len: 1.2, peak: 0.5, loop: true, fn: (k) => {
            const f = k.lp(), a = k.osc('saw'), s = k.osc('sine'), g = k.lp();
            return (t) => f(k.noise(), 260 + 90 * Math.sin(t * TAU / 1.2 * 3)) * 0.9 + g(a(55), 400) * 0.35 + s(41.6667) * 0.5 * (0.8 + 0.2 * Math.sin(t * TAU / 1.2 * 5));
        }
    },
    // short wave-clear fanfare (the music sting plays on top in-game; menus use this alone)
    'wave-complete': {
        len: 0.95, peak: 0.65, fn: (k) => {
            const a = k.osc('square'), b = k.osc('tri'), f = k.lp();
            const n = [[0, 523], [0.09, 659], [0.18, 784], [0.27, 1047], [0.4, 1319]];
            return (t) => { const hz = seqHz(n, t), e = decay(noteT(n, t), t > 0.4 ? 0.28 : 0.07); return f(a(hz) * 0.5 + b(hz * 2) * 0.5, 7000) * e; };
        }
    }
};
