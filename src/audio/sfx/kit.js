// Tiny per-sound DSP toolkit for the sample-by-sample sfx recipes (one instance per render, so oscillator phases,
// filter state and the noise seed are per sound and every render is deterministic).
export const TAU = Math.PI * 2;

export function kit(sr) {
    let seed = 0x9e3779b9;
    const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296) * 2 - 1; };
    const osc = (shape) => {
        let ph = 0;
        return (hz) => {
            ph = (ph + hz / sr) % 1;
            if (shape === 'sine') return Math.sin(ph * TAU);
            if (shape === 'tri') return 1 - 4 * Math.abs(ph - 0.5);
            if (shape === 'saw') return ph * 2 - 1;
            return ph < (shape === 'pulse' ? 0.25 : 0.5) ? 0.8 : -0.8;   // square / 25% pulse, a bit softer than full scale
        };
    };
    const lp = () => { let y = 0; return (x, hz) => (y += (x - y) * Math.min(1, (TAU * hz) / sr)); };
    const hp = () => { const l = lp(); return (x, hz) => x - l(x, hz); };
    /** band-pass = lowpass(hz*1.4) - lowpass(hz/1.4): cheap, wide, good enough for whooshes */
    const bp = () => { const a = lp(), b = lp(); return (x, hz) => a(x, hz * 1.4) - b(x, hz / 1.4); };
    return { noise, osc, lp, hp, bp };
}

// envelopes (t, length in seconds)
export const decay = (t, tau) => Math.exp(-t / tau);
export const ar = (t, a, len) => (t < a ? t / a : Math.max(0, 1 - (t - a) / (len - a)));
/** exponential sweep from f0 to f1 over `len` seconds (clamped after) */
export const sweep = (f0, f1, len, t) => f0 * Math.pow(f1 / f0, Math.min(1, t / len));
/** soft clipper: drive > 1 adds grit */
export const sat = (x, drive = 1) => Math.tanh(x * drive);
/** note sequence helper: [[startS, hz], ...] -> hz at t (0 before the first note) */
export const seqHz = (notes, t) => { let hz = 0; for (const [s, f] of notes) if (t >= s) hz = f; return hz; };
export const noteT = (notes, t) => { let s0 = 0; for (const [s] of notes) if (t >= s) s0 = s; return t - s0; };
