// Pattern sequencer. A track definition (audio/tracks/*.js) is compiled once into per-bar lists, and scheduleBar()
// turns one bar into voice calls at exact audio times. It is stateless, so the live engine (look-ahead scheduling on
// the game's AudioContext) and tools/render-audio.mjs (everything up front on an OfflineAudioContext) share it.
//
// Track format (see docs/AUDIO.md):
//   { key, bpm, bars (loop length, informational), scale:[7 semitones], tonic:'A4', swing, mix:{layer: level}, gain,
//     bassOct, arpOct, padOct, sections:[{ bars, prog:'Am F C G', bass:'x..x..o.', arp:'0120', lead:'8:4 7:2 ...',
//       drums:{k,s,h,o,p}, pad:true, fill:true, crash:true }] }
// Patterns are 16-step strings (one bar); an array cycles per bar. Bass: x root, o octave, f fifth, s flat seventh.
// Arp: digits/letters index the chord stack. Drums: x hit, g ghost; fx row p: t tick, m/M toms, c clap.
// Lead: 'degree:steps' tokens (1-7 scale degrees, 8 = octave up, negative = octave down, 0 = rest).
import { midi, hz, seedVoices, kick, snare, hat, clap, tom, tick, bass, pluck, lead, pad, crash } from './dsp.js';

const TONES = { M: [0, 4, 7], m: [0, 3, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], sus: [0, 5, 7], dim: [0, 3, 6], 5: [0, 7] };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const STEPS = 16;
const asList = (p, n) => (Array.isArray(p) ? p : [p]).filter(Boolean).slice(0, Math.max(1, n));
const at = (list, i) => (list.length ? list[i % list.length] : null);

function parseChord(s) {
    const m = /^([A-G])([#b]?)(m7|M7|m|sus|dim|5)?$/.exec(s);
    if (!m) throw new Error(`bad chord ${s}`);
    return { pc: PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), tones: TONES[m[3] || 'M'] };
}

function parseLead(str, def) {
    if (!str) return [];
    const tonic = midi(def.tonic), ev = [];
    let step = 0;
    for (const tok of str.trim().split(/\s+/)) {
        const [d, l] = tok.split(':'), deg = Number(d), len = Number(l);
        if (deg !== 0) {
            const i = Math.abs(deg) - 1, semis = def.scale[i % 7] + 12 * Math.floor(i / 7) - (deg < 0 ? 12 : 0);
            ev.push({ step, midi: tonic + semis, len });
        }
        step += len;
    }
    return ev;
}

/** compile (once) the sections of a track into a flat list of bars with everything pre-resolved */
export function compile(def) {
    if (def._bars) return def._bars;
    const bars = [];
    def.sections.forEach((sec, si) => {
        const prog = sec.prog.trim().split(/\s+/).map(parseChord);
        const lead = parseLead(sec.lead, def), dr = sec.drums || {};
        for (let b = 0; b < sec.bars; b++) {
            bars.push({
                chord: prog[b % prog.length], first: b === 0, last: b === sec.bars - 1, sec,
                bass: at(asList(sec.bass, sec.bars), b), arp: at(asList(sec.arp, sec.bars), b),
                k: at(asList(dr.k, sec.bars), b), s: at(asList(dr.s, sec.bars), b), h: at(asList(dr.h, sec.bars), b),
                o: at(asList(dr.o, sec.bars), b), p: at(asList(dr.p, sec.bars), b),
                lead: lead.filter((e) => e.step >= b * STEPS && e.step < (b + 1) * STEPS).map((e) => ({ ...e, step: e.step - b * STEPS })),
                si
            });
        }
    });
    def._bars = bars;
    def.bars = bars.length;
    return bars;
}

const ONSET = /[^.\-]/;
/** length (in steps) of the bass note starting at i: until the next onset, max 4 */
function noteLen(pat, i) { let n = 1; while (n < 4 && i + n < STEPS && !ONSET.test(pat[i + n] || '.')) n++; return n; }

/**
 * Schedule bar number `bar` (any integer; wraps around the loop) at audio time t.
 * sink(time, strength) is told about every beat (quarter note) so visuals can pulse in time.
 */
export function scheduleBar(ctx, rig, def, bar, t, sink) {
    const bars = compile(def), idx = ((bar % bars.length) + bars.length) % bars.length, B = bars[idx];
    seedVoices(idx + 1);          // noise phases depend only on the bar in the loop, so every pass is sample-identical
    const stepT = 60 / def.bpm / 4, swing = def.swing || 0, L = rig.layer;
    const when = (i) => t + i * stepT + (i & 1 ? swing * stepT : 0);
    const c = B.chord, tones = c.tones;
    const padOct = def.padOct ?? 3, bassOct = def.bassOct ?? 1, arpOct = def.arpOct ?? 4;

    if (B.sec.pad !== false) {
        // one chord per bar (padHalf: two), re-struck so the progression is audible under the arp
        const base = c.pc + 12 * (padOct + 1), freqs = [...tones, 12].map((x) => hz(base + x)), n = B.sec.padHalf ? 2 : 1;
        for (let h = 0; h < n; h++) pad(ctx, L.pad, t + (h * STEPS * stepT) / n, freqs, ((STEPS * stepT) / n) * 0.98, 1, { cut: def.padCut });
    }
    if (B.first && B.sec.crash) crash(ctx, L.fx, t, 0.9);

    const k = B.k, bs = B.bass, ar = B.arp;
    for (let i = 0; i < STEPS; i++) {
        const ti = when(i), fillRoll = B.sec.fill && B.last && i >= 12;
        if (bs && bs[i] && ONSET.test(bs[i])) {
            const rootM = c.pc + 12 * (bassOct + 1);
            const m = bs[i] === 'o' ? rootM + 12 : bs[i] === 'f' ? rootM + 7 : bs[i] === 's' ? rootM + 10 : rootM;
            bass(ctx, L.bass, ti, hz(m), noteLen(bs, i) * stepT * 0.9, i % 4 ? 0.85 : 1, { cut: def.bassCut, wave: def.bassWave });
        }
        if (ar && ar[i] && ar[i] !== '.') {
            const idx = parseInt(ar[i], 16), L3 = tones.length;
            const m = c.pc + 12 * (arpOct + 1) + tones[idx % L3] + 12 * Math.floor(idx / L3);
            pluck(ctx, L.arp, ti, hz(m), stepT * (def.arpLen ?? 1.6), i % 4 ? 0.8 : 1, { duty: def.arpDuty, cut: def.arpCut });
        }
        if (k && k[i] && k[i] !== '.' && !fillRoll) kick(ctx, L.kick, ti, k[i] === 'g' ? 0.5 : 1, def.kick);
        if (B.s && B.s[i] && B.s[i] !== '.' && !fillRoll) (def.clap ? clap : snare)(ctx, L.snare, ti, B.s[i] === 'g' ? 0.45 : 1, def.snare);
        if (fillRoll) snare(ctx, L.snare, ti, 0.45 + (i - 12) * 0.16, def.snare);
        if (B.h && B.h[i] && B.h[i] !== '.') hat(ctx, L.hat, ti, B.h[i] === 'g' ? 0.5 : (i % 4 ? 0.8 : 1), false);
        if (B.o && B.o[i] && B.o[i] !== '.') hat(ctx, L.hat, ti, 0.9, true);
        const p = B.p && B.p[i];
        if (p && p !== '.') {
            if (p === 't') tick(ctx, L.fx, ti, 0.9, def.tickHz);
            else if (p === 'c') clap(ctx, L.fx, ti, 0.8);
            else tom(ctx, L.fx, ti, 0.9, p === 'M' ? 80 : 118);
        }
        if (sink && i % 4 === 0) sink(ti, i === 0 ? 1 : k && k[i] && k[i] !== '.' ? 0.7 : 0.35);
    }
    const lv = B.sec.leadVoice || {};
    for (const e of B.lead) {
        const len = e.len * stepT * (e.len > 1 ? 0.97 : 0.8);
        lead(ctx, L.lead, when(e.step), hz(e.midi), len, e.step % 4 ? 0.9 : 1, { duty: lv.duty ?? def.leadDuty, vib: lv.vib, cut: def.leadCut });
    }
}

export const barSeconds = (def) => (60 / def.bpm) * 4;
export const loopSeconds = (def) => compile(def).length * barSeconds(def);

/** Live look-ahead player for one track on a running context. */
export class Sequencer {
    constructor(ctx, def, rig, sink) {
        this.ctx = ctx; this.def = def; this.rig = rig; this.sink = sink;
        this.t = 0; this.bar = 0; this.running = false;
        compile(def);
    }

    start(when) { this.t = when; this.bar = 0; this.running = true; this.pump(0.8); }
    stop() { this.running = false; }

    /** schedule every bar that starts within the look-ahead window; resyncs if the page stalled */
    pump(ahead = 0.9) {
        if (!this.running) return;
        const ctx = this.ctx, len = barSeconds(this.def);
        const late = ctx.currentTime - this.t;
        if (late > 0.05) { const skip = Math.ceil(late / len); this.bar += skip; this.t += skip * len; }
        while (this.t < ctx.currentTime + ahead) {
            scheduleBar(ctx, this.rig, this.def, this.bar, this.t, this.sink);
            this.t += len;
            this.bar++;
        }
    }
}
