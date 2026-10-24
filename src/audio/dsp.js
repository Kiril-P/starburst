// Voices for the music engine: tiny Web Audio instruments (kick, snare, bass, arp pluck, lead, pad ...) built from
// oscillators, one shared noise buffer and biquads. Every voice takes (ctx, out, t, ...) and schedules itself at
// audio time `t`, then stops and frees its own nodes, so the same code drives the live AudioContext and the
// OfflineAudioContext used by tools/render-audio.mjs. No Phaser, no samples: everything is synthesised.
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'D2' / 'F#3' / 'Bb1' -> MIDI number (C-1 = 0, A4 = 69) */
export function midi(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error(`bad note ${name}`);
    return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// per-context shared resources (noise buffer, pulse waves, reverb impulse)
const shared = new WeakMap();
const res = (ctx) => { let r = shared.get(ctx); if (!r) shared.set(ctx, (r = { waves: {} })); return r; };

/** 2 s of deterministic white noise (xorshift), shared by every drum / noise voice */
export function noiseBuffer(ctx) {
    const r = res(ctx);
    if (r.noise) return r.noise;
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let s = 0x2545f491;
    for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
    return (r.noise = buf);
}

/** band-limited pulse wave of a given duty (0.125 / 0.25 give the NES-style hollow tones) */
export function pulseWave(ctx, duty) {
    const r = res(ctx);
    if (r.waves[duty]) return r.waves[duty];
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) {
        re[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
        im[n] = (2 * Math.pow(Math.sin(Math.PI * n * duty), 2)) / (n * Math.PI);
    }
    return (r.waves[duty] = ctx.createPeriodicWave(re, im));
}

/** short stereo room: exponentially decaying noise, darker over time (cheap one-pole lowpass per channel) */
export function impulse(ctx, seconds = 1.6) {
    const r = res(ctx);
    if (r.ir) return r.ir;
    const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    let s = 0x1234567;
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let y = 0;
        for (let i = 0; i < n; i++) {
            s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
            const k = i / n, a = 0.9 - 0.8 * k;               // lowpass coefficient: tail loses highs
            y += (((s >>> 0) / 4294967296) * 2 - 1 - y) * a;
            d[i] = y * Math.pow(1 - k, 2.2) * (i < 64 ? i / 64 : 1);
        }
    }
    return (r.ir = buf);
}

// ---- helpers ------------------------------------------------------------------------------------------------------------
const FLOOR = 0.0001;
function gainEnv(ctx, t, a, peak, d) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(Math.max(FLOOR, peak), t + a);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + a + d);
    return g;
}
function osc(ctx, type, t, end, f) {
    const o = ctx.createOscillator();
    if (type && type.constructor === PeriodicWave) o.setPeriodicWave(type); else o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t); o.stop(end);
    return o;
}
function noise(ctx, t, end, offset = 0) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx);
    s.start(t, offset % 1.5); s.stop(end);
    return s;
}
const filt = (ctx, type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
/** deterministic offset into the noise buffer so repeated hits differ but renders are reproducible */
let nz = 0;
/** reset the hit-variation sequence (offline renders call this first so they are reproducible) */
export const seedVoices = (n = 0) => { nz = (n * 2654435761) >>> 0; };
const nextOff = () => ((nz = (nz * 1664525 + 1013904223) >>> 0) / 4294967296) * 1.5;

// ---- drums -------------------------------------------------------------------------------------------------------------
export function kick(ctx, out, t, v = 1, { punch = 150, tail = 0.3 } = {}) {
    const end = t + tail + 0.05;
    const o = osc(ctx, 'sine', t, end, punch);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(34, t + tail);
    const g = gainEnv(ctx, t, 0.002, v, tail);
    o.connect(g).connect(out);
    const c = noise(ctx, t, t + 0.02, nextOff()), cg = gainEnv(ctx, t, 0.001, 0.22 * v, 0.012);
    c.connect(filt(ctx, 'highpass', 1800)).connect(cg).connect(out);
}

export function snare(ctx, out, t, v = 1, { tone = 190, tail = 0.16 } = {}) {
    const n = noise(ctx, t, t + tail + 0.05, nextOff()), ng = gainEnv(ctx, t, 0.001, 0.8 * v, tail);
    n.connect(filt(ctx, 'bandpass', 2100, 0.7)).connect(ng).connect(out);
    const o = osc(ctx, 'triangle', t, t + 0.12, tone);
    o.frequency.exponentialRampToValueAtTime(tone * 0.6, t + 0.1);
    o.connect(gainEnv(ctx, t, 0.001, 0.55 * v, 0.09)).connect(out);
}

export function clap(ctx, out, t, v = 1) {
    for (let i = 0; i < 3; i++) {
        const s = t + i * 0.011, n = noise(ctx, s, s + 0.2, nextOff());
        n.connect(filt(ctx, 'bandpass', 1500, 1.1)).connect(gainEnv(ctx, s, 0.001, 0.5 * v, i === 2 ? 0.14 : 0.01)).connect(out);
    }
}

export function hat(ctx, out, t, v = 1, open = false) {
    const d = open ? 0.17 : 0.03, n = noise(ctx, t, t + d + 0.03, nextOff());
    n.connect(filt(ctx, 'highpass', open ? 6500 : 8000)).connect(gainEnv(ctx, t, 0.001, 0.32 * v, d)).connect(out);
}

export function tom(ctx, out, t, v = 1, f = 120) {
    const o = osc(ctx, 'sine', t, t + 0.3, f * 1.5);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(gainEnv(ctx, t, 0.002, 0.7 * v, 0.22)).connect(out);
}

/** metal tick / rim: two inharmonic square partials, very short */
export function tick(ctx, out, t, v = 1, f = 1250) {
    for (const m of [1, 1.504]) {
        const o = osc(ctx, 'square', t, t + 0.08, f * m);
        o.connect(filt(ctx, 'bandpass', f * 1.4, 2)).connect(gainEnv(ctx, t, 0.001, 0.14 * v, 0.04)).connect(out);
    }
}

// ---- tonal voices ------------------------------------------------------------------------------------------------------
/** low synth: saw through a closing low-pass + a sine sub an octave down */
export function bass(ctx, out, t, f, len, v = 1, { cut = 900, wave = 'sawtooth', sub = 0.6 } = {}) {
    const end = t + len + 0.08;
    const o = osc(ctx, wave, t, end, f), lp = filt(ctx, 'lowpass', cut * 3, 3);
    lp.frequency.setValueAtTime(cut * 3, t);
    lp.frequency.exponentialRampToValueAtTime(cut * 0.6, t + Math.min(0.25, len));
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(0.5 * v, t + 0.006);
    g.gain.setValueAtTime(0.5 * v, t + len * 0.8);
    g.gain.exponentialRampToValueAtTime(FLOOR, end);
    o.connect(lp).connect(g).connect(out);
    if (sub > 0) {
        const s = osc(ctx, 'sine', t, end, f), sg = ctx.createGain();
        sg.gain.setValueAtTime(FLOOR, t);
        sg.gain.linearRampToValueAtTime(sub * v * 0.6, t + 0.008);
        sg.gain.setValueAtTime(sub * v * 0.6, t + len * 0.8);
        sg.gain.exponentialRampToValueAtTime(FLOOR, end);
        s.connect(sg).connect(out);
    }
}

/** plucked chip note (arp): 25% pulse, brightness drops fast */
export function pluck(ctx, out, t, f, len, v = 1, { duty = 0.25, cut = 4200 } = {}) {
    const end = t + len + 0.05;
    const o = osc(ctx, pulseWave(ctx, duty), t, end, f), lp = filt(ctx, 'lowpass', cut, 1.2);
    lp.frequency.setValueAtTime(cut, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, cut * 0.18), t + len);
    o.connect(lp).connect(gainEnv(ctx, t, 0.003, 0.42 * v, len)).connect(out);
}

/** lead: pulse + a quiet detuned saw, delayed vibrato, short release */
export function lead(ctx, out, t, f, len, v = 1, { duty = 0.5, vib = 5.5, cut = 5200 } = {}) {
    const end = t + len + 0.12;
    const o = osc(ctx, pulseWave(ctx, duty), t, end, f), o2 = osc(ctx, 'sawtooth', t, end, f * 1.004);
    const lfo = osc(ctx, 'sine', t, end, vib), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.3, len));      // vibrato fades in on held notes
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const m = ctx.createGain(); m.gain.value = 0.6;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(m); o2.connect(g2);
    const lp = filt(ctx, 'lowpass', cut, 0.8);
    m.connect(lp); g2.connect(lp);
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(0.4 * v, t + 0.012);
    g.gain.setValueAtTime(0.34 * v, t + len);
    g.gain.exponentialRampToValueAtTime(FLOOR, end);
    lp.connect(g).connect(out);
}

/** pad chord: two slightly detuned saws per note through a soft low-pass, slow attack / release */
export function pad(ctx, out, t, freqs, len, v = 1, { cut = 1500, attack = 0.35 } = {}) {
    const end = t + len + 0.7;
    const lp = filt(ctx, 'lowpass', cut, 0.5), g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(0.16 * v / Math.sqrt(freqs.length), t + attack);
    g.gain.setValueAtTime(0.16 * v / Math.sqrt(freqs.length), t + len);
    g.gain.exponentialRampToValueAtTime(FLOOR, end);
    lp.connect(g).connect(out);
    for (const f of freqs) for (const d of [0.9965, 1.0035]) osc(ctx, 'sawtooth', t, end, f * d).connect(lp);
}

/** noise riser: band-pass sweeping up (transitions / boss stings) */
export function riser(ctx, out, t, len, v = 1, from = 300, to = 7000) {
    const n = noise(ctx, t, t + len + 0.02, nextOff()), bp = filt(ctx, 'bandpass', from, 1.4);
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + len);
    g.gain.linearRampToValueAtTime(0, t + len + 0.02);
    n.connect(bp).connect(g).connect(out);
}

/** crash: long noise wash, for section starts and stings */
export function crash(ctx, out, t, v = 1, tail = 1.4) {
    const n = noise(ctx, t, t + tail + 0.05, nextOff());
    n.connect(filt(ctx, 'highpass', 4500)).connect(gainEnv(ctx, t, 0.002, 0.35 * v, tail)).connect(out);
}

/** soft bell: sine + octave partial, for sting tails */
export function bell(ctx, out, t, f, len, v = 1) {
    for (const [m, a] of [[1, 1], [2.01, 0.35], [3.99, 0.12]]) {
        osc(ctx, 'sine', t, t + len + 0.05, f * m).connect(gainEnv(ctx, t, 0.003, 0.3 * v * a, len)).connect(out);
    }
}
