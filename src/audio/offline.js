// Offline rendering of tracks / stings (OfflineAudioContext) with the same code the game plays live. Used by
// tools/render-audio.mjs (headless Chrome) and the audio lab page. Returns plain Float32 channels plus loudness stats.
import { TRACKS } from './tracks/index.js';
import { STINGS, createStingBus, scheduleSting } from './stings.js';
import { createRig } from './rig.js';
import { scheduleBar, barSeconds, compile } from './sequencer.js';

export const SR = 44100;

/** the game's master limiter, so renders sound like the game (see systems/sfx.js installAudio) */
function master(ctx) {
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 4; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    glue.connect(lim).connect(ctx.destination);
    return glue;
}

const toChannels = (buf) => [buf.getChannelData(0), buf.getChannelData(1)];

/**
 * Render a looping track. loops = number of full passes kept; one extra warm-up pass is rendered first so the kept
 * audio contains the previous pass's reverb/echo tails (it is a true steady-state loop, seam included).
 * opts { intensity = 1, boss = false, loops = 1, limiter = true, sr }
 */
export async function renderTrack(key, opts = {}) {
    const base = TRACKS[key], sr = opts.sr || SR, loops = opts.loops || 1;
    compile(base);
    // bar length rounded to a whole number of samples (tempo error < 0.001%): every pass is then sample-identical, which
    // is what makes the loop check (and the exported loop's seam) exact
    // (a multiple of 16 samples, so every sixteenth-note step starts on a whole sample too)
    const bl = (Math.round((barSeconds(base) * sr) / 16) * 16) / sr, def = { ...base, bpm: 240 / bl };
    const L = bl * def.bars, total = L * (loops + 1);
    const ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    const dest = opts.limiter === false ? ctx.destination : master(ctx);
    const rig = createRig(ctx, def, dest);
    rig.setLevel(opts.intensity ?? 1, !!opts.boss, 0);
    const bars = def.bars * (loops + 1);
    // schedule two bars ahead while rendering (suspend/resume at each bar): thousands of pending nodes make the offline
    // graph quadratic, a rolling window keeps it linear
    // + a fraction of a sample: event times never sit on a sample boundary, where float noise could flip a pass by one frame
    const eps = 0.3719 / sr;
    scheduleBar(ctx, rig, def, 0, eps, null);
    if (bars > 1) scheduleBar(ctx, rig, def, 1, bl + eps, null);
    const quantum = 128 / sr;
    for (let b = 2; b < bars; b++) {
        const at = Math.round(((b - 1) * bl) / quantum) * quantum;
        ctx.suspend(at).then(() => { scheduleBar(ctx, rig, def, b, b * bl + eps, null); ctx.resume(); });
    }
    const buf = await ctx.startRendering();
    const skip = Math.round(L * sr), ch = toChannels(buf);
    return { sr, loopSeconds: L, channels: ch.map((c) => c.slice(skip, skip + Math.round(L * loops * sr))), warmup: ch.map((c) => c.slice(0, skip)) };
}

/** Render a sting (plus a 1.5 s tail). */
export async function renderSting(key, opts = {}) {
    const def = STINGS[key], sr = opts.sr || SR;
    const ctx = new OfflineAudioContext(2, Math.ceil((def.len + 1.5) * sr), sr);
    const bus = createStingBus(ctx, opts.limiter === false ? ctx.destination : master(ctx), def.gain);
    scheduleSting(ctx, bus.input, def, 0.02);
    const buf = await ctx.startRendering();
    return { sr, channels: toChannels(buf) };
}

const db = (x) => 20 * Math.log10(Math.max(1e-9, x));

/** loudness / sanity numbers for a stereo render */
export function analyze(channels, sr, loopCheck = null) {
    const [l, r] = channels, n = l.length;
    let peak = 0, sum = 0, bad = 0, dc = 0;
    for (let i = 0; i < n; i++) {
        const a = l[i], b = r[i];
        if (!Number.isFinite(a) || !Number.isFinite(b)) { bad++; continue; }
        peak = Math.max(peak, Math.abs(a), Math.abs(b));
        sum += (a * a + b * b) / 2; dc += (a + b) / 2;
    }
    // RMS per 0.5 s window: the quietest/loudest window show dropouts or runaway
    const w = Math.round(sr * 0.5), wins = [];
    for (let i = 0; i + w <= n; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += (l[j] * l[j] + r[j] * r[j]) / 2; wins.push(Math.sqrt(s / w)); }
    const out = {
        seconds: +(n / sr).toFixed(2), peakDb: +db(peak).toFixed(2), rmsDb: +db(Math.sqrt(sum / n)).toFixed(2), dc: +(dc / n).toFixed(5), nan: bad,
        quietWindowDb: +db(Math.min(...wins)).toFixed(1), loudWindowDb: +db(Math.max(...wins)).toFixed(1)
    };
    if (loopCheck) {
        // loopCheck = the NEXT pass of the same render. Passes are sample-identical when the loop is truly periodic (voices'
        // tails included), and then the wrap from this pass's end to its start is exactly what the infinite signal does
        // there: no seam. seamDiff = biggest sample difference around the wrap (end of pass vs where the next pass starts)
        let seam = 0, e = 0, s2 = 0;
        const nx = loopCheck;
        for (let i = 0; i < n; i++) { const d = l[i] - nx[i]; e += d * d; s2 += l[i] * l[i]; if (i < 2048) seam = Math.max(seam, Math.abs(d)); }
        out.seamDiffDb = +db(seam).toFixed(1);
        out.loopMismatchDb = +db(Math.sqrt(e / Math.max(1e-12, s2))).toFixed(1);
    }
    return out;
}

/** 16-bit interleaved PCM as base64 (for transfer out of the page) */
export function pcm16Base64(channels) {
    const [l, r] = channels, n = l.length, out = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) {
        out[2 * i] = Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767)));
        out[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767)));
    }
    const bytes = new Uint8Array(out.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
}
