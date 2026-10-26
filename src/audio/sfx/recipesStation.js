// Station hazards: laser beams (charge whine + discharge), warper blink, seeker lock-on.
import { TAU, decay, ar, sweep, sat } from './kit.js';

export const STATION = {
    // a rising whine with a tremolo that speeds up: "it is about to fire" (callers pass rate = 1100 / chargeMs)
    'beam-charge': {
        len: 1.1, peak: 0.55, fn: (k) => {
            const a = k.osc('saw'), s = k.osc('sine'), f = k.lp();
            return (t) => { const u = t / 1.1; return f(a(sweep(110, 840, 1.1, t)), sweep(600, 3800, 1.1, t)) * (0.1 + u * u) * 0.55 * (0.78 + 0.22 * Math.sin(t * TAU * (8 + 18 * u))) + s(sweep(220, 1680, 1.1, t)) * u * 0.25; };
        }
    },
    // the discharge: a hard zap falling into a low thump, with a grainy tail
    'beam-fire': {
        len: 0.55, peak: 0.85, fn: (k) => {
            const a = k.osc('saw'), s = k.osc('sine'), f = k.lp(), n = k.lp();
            return (t) => sat(f(a(sweep(2400, 70, 0.5, t)), sweep(7000, 300, 0.5, t)) * ar(t, 0.003, 0.55) * 0.7 + n(k.noise(), sweep(6000, 500, 0.5, t)) * decay(t, 0.2) * 0.7 + s(sweep(160, 45, 0.35, t)) * decay(t, 0.2), 1.3);
        }
    },
    // warper blinking in or out: a quick upward chirp with a airy tick
    warp: { len: 0.24, peak: 0.5, fn: (k) => { const o = k.osc('sine'), p = k.osc('tri'), h = k.hp(); return (t) => (o(sweep(260, 2600, 0.13, t)) * 0.8 + p(sweep(520, 5200, 0.13, t)) * 0.3) * decay(t, 0.07) + h(k.noise(), 5000) * decay(t, 0.02) * 0.3; } },
    // seeker drone locking on: two short pings
    'seeker-lock': { len: 0.2, peak: 0.45, fn: (k) => { const o = k.osc('sine'), p = k.osc('tri'); return (t) => { const u = t % 0.1; return (o(1760) + p(3520) * 0.3) * decay(u, 0.025) * (t < 0.2 ? 1 : 0); }; } }
};
