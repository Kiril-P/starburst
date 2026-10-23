// Procedural SFX for events that have no sample. Each recipe renders a short mono buffer sample-by-sample at
// boot (a few ms total, deterministic noise) and is stored in Phaser's audio cache under its key, so
// sfx(scene, key) / scene.sound.play(key) can't tell a synth key from a loaded file.
// Chiptune-ish palette to sit with the samples: square/triangle blips, filtered noise, pitch sweeps.
const TAU = Math.PI * 2;

/** tiny DSP toolkit; one instance per render so state (phases, filters, noise seed) is per sound */
function kit(sr) {
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
    return { noise, osc, lp, hp };
}

// envelopes (t, length in seconds)
const decay = (t, tau) => Math.exp(-t / tau);
const ar = (t, a, len) => (t < a ? t / a : Math.max(0, 1 - (t - a) / (len - a)));
/** note sequence helper: [[startS, hz], ...] -> hz at t (0 before the first note) */
const seqHz = (notes, t) => { let hz = 0; for (const [s, f] of notes) if (t >= s) hz = f; return hz; };
const noteT = (notes, t) => { let s0 = 0; for (const [s] of notes) if (t >= s) s0 = s; return t - s0; };

const RECIPES = {
    // bright tick, short enough to repeat fast while skimming a bullet stream
    graze: { len: 0.07, peak: 0.55, fn: (k) => { const o = k.osc('sine'), h = k.hp(); return (t) => o(3100 - t * 9000) * decay(t, 0.014) + h(k.noise(), 5000) * decay(t, 0.004) * 0.5; } },
    // two-step rising chirp; callers raise the rate with the combo tier
    'combo-up': { len: 0.16, peak: 0.6, fn: (k) => { const o = k.osc('pulse'), f = k.lp(); const n = [[0, 784], [0.055, 1175]]; return (t) => f(o(seqHz(n, t)), 5000) * decay(noteT(n, t), 0.05); } },
    'combo-lost': { len: 0.3, peak: 0.5, fn: (k) => { const o = k.osc('square'), f = k.lp(); return (t) => f(o(520 * Math.pow(0.35, t / 0.3)), 2200) * ar(t, 0.005, 0.3); } },
    pickup: { len: 0.2, peak: 0.6, fn: (k) => { const o = k.osc('square'), f = k.lp(); const n = [[0, 988], [0.06, 1319]]; return (t) => f(o(seqHz(n, t)), 6000) * (t < 0.06 ? 1 : decay(t - 0.06, 0.05)); } },
    'level-up': {
        len: 0.62, peak: 0.7, fn: (k) => {
            const a = k.osc('square'), b = k.osc('tri'), f = k.lp();
            const n = [[0, 523], [0.07, 659], [0.14, 784], [0.21, 1047], [0.3, 1319]];
            return (t) => { const hz = seqHz(n, t), e = decay(noteT(n, t), t > 0.3 ? 0.12 : 0.06); return f(a(hz) * 0.5 + b(hz * 2) * 0.5, 7000) * e; };
        }
    },
    // upgrade picked: rising sweep into a shimmering major chord with vibrato
    upgrade: {
        len: 0.85, peak: 0.7, fn: (k) => {
            const sw = k.osc('saw'), c1 = k.osc('tri'), c2 = k.osc('tri'), c3 = k.osc('tri'), f = k.lp();
            return (t) => {
                const v = 1 + 0.006 * Math.sin(t * TAU * 7);
                const sweep = t < 0.18 ? f(sw(300 + 1500 * (t / 0.18)), 3000) * 0.5 * (t / 0.18) : 0;
                const ch = t < 0.16 ? 0 : (c1(784 * v) + c2(988 * v) * 0.8 + c3(1568 * v) * 0.5) * decay(t - 0.16, 0.22) * 0.5;
                return sweep + ch;
            };
        }
    },
    'ui-hover': { len: 0.03, peak: 0.35, fn: (k) => { const o = k.osc('tri'); return (t) => o(1760) * decay(t, 0.008); } },
    'ui-select': { len: 0.09, peak: 0.5, fn: (k) => { const o = k.osc('square'), f = k.lp(); const n = [[0, 880], [0.035, 1320]]; return (t) => f(o(seqHz(n, t)), 4500) * decay(noteT(n, t), 0.03); } },
    'ui-back': { len: 0.09, peak: 0.45, fn: (k) => { const o = k.osc('square'), f = k.lp(); const n = [[0, 1320], [0.035, 784]]; return (t) => f(o(seqHz(n, t)), 4000) * decay(noteT(n, t), 0.03); } },
    // boss warning: two klaxon whoops (saw through a resonant-ish low-pass), meant to loop-free announce
    warning: {
        len: 1.7, peak: 0.75, fn: (k) => {
            const a = k.osc('saw'), b = k.osc('saw'), f = k.lp(), f2 = k.lp();
            return (t) => {
                const ph = (t % 0.8) / 0.8, hz = 380 + 420 * Math.sin(ph * Math.PI);
                const env = ar(t % 0.8, 0.03, 0.78) * (t < 1.6 ? 1 : 0);
                return f2(f(a(hz) + b(hz * 1.007), 1800), 2600) * env * 0.7;
            };
        }
    },
    // boss stinger (intros / phase shifts): a short noise riser slams into a detuned low power chord + sub hit
    'boss-stinger': {
        len: 1.2, peak: 0.8, fn: (k) => {
            const hz = [55, 55.4, 82.4, 110, 110.7], v = hz.map(() => k.osc('saw'));
            const sub = k.osc('sine'), f = k.lp(), r = k.lp();
            return (t) => {
                if (t < 0.18) return r(k.noise(), 400 + 6000 * (t / 0.18)) * (t / 0.18) * 0.5;
                const u = t - 0.18;
                const chord = v.reduce((s, o, i) => s + o(hz[i]), 0) / 3;
                return f(chord, 300 + 2600 * decay(u, 0.25)) * decay(u, 0.45) + sub(60 * decay(u, 0.3) + 30) * decay(u, 0.35) * 0.9;
            };
        }
    },
    // big boom: sub drop + low-passed noise whose cutoff closes, with a crackly start
    'boss-explosion': {
        len: 2.0, peak: 0.85, fn: (k) => {
            const sub = k.osc('sine'), f = k.lp(), f2 = k.lp();
            return (t) => {
                const n = k.noise();
                const body = f2(f(n, 2400 * decay(t, 0.35) + 80), 3000) * decay(t, 0.55);
                const crack = n * decay(t, 0.03) * 0.6;
                return body * 1.4 + sub(90 * decay(t, 0.4) + 28) * decay(t, 0.7) * 0.8 + crack;
            };
        }
    },
    // glassy shatter: high-passed noise burst + inharmonic ringing partials
    'shield-break': {
        len: 0.6, peak: 0.7, fn: (k) => {
            const h = k.hp(), p = [2093, 3271, 4703, 6229].map(() => k.osc('sine'));
            const fr = [2093, 3271, 4703, 6229];
            return (t) => h(k.noise(), 3000) * decay(t, 0.05) * 0.8 + p.reduce((s, o, i) => s + o(fr[i] * (1 - t * 0.04)) * decay(t, 0.18 / (i + 1)), 0) * 0.35;
        }
    },
    'shield-hit': { len: 0.18, peak: 0.55, fn: (k) => { const o = k.osc('tri'), h = k.hp(); return (t) => o(1400 - t * 3000) * decay(t, 0.05) + h(k.noise(), 4000) * decay(t, 0.01) * 0.4; } },
    // short whoosh-up when a wave starts
    'wave-start': { len: 0.45, peak: 0.55, fn: (k) => { const f = k.lp(), o = k.osc('tri'); return (t) => f(k.noise(), 300 + 4000 * (t / 0.45)) * ar(t, 0.3, 0.45) + o(220 + 660 * (t / 0.45)) * ar(t, 0.3, 0.45) * 0.3; } }
};

export const SYNTH_KEYS = Object.keys(RECIPES);

/** Render a recipe to Float32 samples, normalised to its peak with a 4ms de-click fade at the end. */
export function renderSynth(key, sr) {
    const r = RECIPES[key];
    const n = Math.ceil(r.len * sr), out = new Float32Array(n);
    const fn = r.fn(kit(sr));
    let max = 0;
    for (let i = 0; i < n; i++) { const v = fn(i / sr); out[i] = v; const a = Math.abs(v); if (a > max) max = a; }
    const g = max > 0 ? r.peak / max : 0, fade = Math.min(n, Math.round(sr * 0.004));
    for (let i = 0; i < n; i++) out[i] *= g * (i >= n - fade ? (n - i) / fade : 1);
    return out;
}

/** Bake every recipe into the audio cache (Web Audio only). Keys already present (real samples) win. */
export function registerSynthSfx(game) {
    const ctx = game.sound && game.sound.context;
    if (!ctx) return [];
    const done = [];
    for (const key of SYNTH_KEYS) {
        if (game.cache.audio.exists(key)) continue;
        const data = renderSynth(key, ctx.sampleRate);
        const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buf.copyToChannel(data, 0);
        game.cache.audio.add(key, buf);
        done.push(key);
    }
    return done;
}
