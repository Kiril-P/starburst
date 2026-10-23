// Music engine on raw Web Audio (shares Phaser's AudioContext and master volume/mute).
// Why not Phaser sounds: we need sample-accurate loop points, crossfades between tracks, a shared filter/gain
// bus for ducking + intensity, and an analyser tap for visuals. Graph:
//
//   track voices -> trackGain ─┐
//   track voices -> trackGain ─┴> lowpass -> lowshelf -> highshelf -> mixGain ─┬> volume -> sound.destination
//                                                                              └> analyser (audioReact)
//
// Seamless looping: the MP3s carry encoder priming/padding (browsers differ in whether they strip it) and
// main.mp3 ends in a ~3s fade-out. Loop points are measured from the decoded buffer: start = first audible
// sample, end = where the trailing level falls under a fraction of the track's typical level. The next pass
// is scheduled on the audio clock exactly at the loop end, while the old pass rings out its tail briefly
// underneath, so neither padding nor the fade leaves a hole.
//
// Every export is no-op safe: before init (or without Web Audio) calls simply do nothing.
import { save } from './Save.js';

const TAIL_S = 1.2;          // how long the previous pass keeps ringing after the loop point
const DUCKS = {              // reason -> { gain, cutoff Hz }; the strongest active duck wins
    pause: { gain: 0.45, hz: 650 },
    upgrade: { gain: 0.6, hz: 1100 },
    gameover: { gain: 0.35, hz: 480 },
    launch: { gain: 0.5, hz: 900 }
};
const OPEN_HZ = 20000;

const S = { ctx: null, game: null, tracks: [], loops: new Map(), ducks: new Set(), intensity: 1, boss: false };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const now = () => S.ctx.currentTime;
/** smooth param move; tau ~ ms/3 so the target is ~95% reached after `ms` */
function glide(param, value, ms) {
    const t = now();
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.setTargetAtTime(value, t, Math.max(0.005, ms / 3000));
}

/** Build the bus once per game. Safe to call repeatedly. */
export function initMusic(game) {
    const sound = game.sound;
    if (S.ctx || !sound || !sound.context || !sound.destination) return;
    const ctx = sound.context;
    S.ctx = ctx; S.game = game;
    S.lowpass = ctx.createBiquadFilter();
    S.lowpass.type = 'lowpass'; S.lowpass.Q.value = 0.9; S.lowpass.frequency.value = OPEN_HZ;
    S.lowshelf = ctx.createBiquadFilter();
    S.lowshelf.type = 'lowshelf'; S.lowshelf.frequency.value = 140; S.lowshelf.gain.value = 0;
    S.highshelf = ctx.createBiquadFilter();
    S.highshelf.type = 'highshelf'; S.highshelf.frequency.value = 4500; S.highshelf.gain.value = 0;
    S.mix = ctx.createGain();
    S.volume = ctx.createGain();
    S.volume.gain.value = save.musicVolume;
    S.analyser = ctx.createAnalyser();
    S.analyser.fftSize = 2048;
    S.analyser.smoothingTimeConstant = 0.55;
    S.lowpass.connect(S.lowshelf).connect(S.highshelf).connect(S.mix);
    S.mix.connect(S.volume).connect(sound.destination);
    S.mix.connect(S.analyser);
    game.events.once('destroy', () => { stop(0); S.ctx = null; });
}

/** Analyser on the music bus (pre user volume), or null. Used by audioReact. */
export const musicAnalyser = () => S.analyser || null;
/** Key of the track currently playing (not fading out), or null. */
export const currentTrack = () => S.tracks.find((t) => !t.leaving)?.key ?? null;

/** Measure loop points of a decoded buffer (cached per key). */
function loopPoints(key, buf) {
    if (S.loops.has(key)) return S.loops.get(key);
    const sr = buf.sampleRate, d = buf.getChannelData(0), n = d.length;
    const d2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d;
    let start = 0;
    while (start < n - 1 && Math.abs(d[start]) < 1e-3 && Math.abs(d2[start]) < 1e-3) start++;
    // typical level: median RMS of 50ms windows sampled across the track
    const win = Math.round(sr * 0.05);
    const rms = (i) => { let s = 0; for (let j = i; j < i + win; j += 4) s += d[j] * d[j] + d2[j] * d2[j]; return Math.sqrt(s / (win / 2)); };
    const probes = [];
    for (let i = start; i + win < n; i += Math.max(win, Math.floor(n / 400))) probes.push(rms(i));
    probes.sort((a, b) => a - b);
    const floor = (probes[probes.length >> 1] || 0) * 0.12;
    // walk back from the end (max 20s) to the last window that is still clearly audible
    let end = n;
    for (let i = n - win, lim = Math.max(start, n - sr * 20); i > lim; i -= win) {
        if (rms(i) > floor) { end = Math.min(n, i + win); break; }
    }
    const lp = { start: start / sr, end: end / sr };
    if (lp.end - lp.start < 1) { lp.start = 0; lp.end = buf.duration; }   // short/odd buffer: plain loop
    S.loops.set(key, lp);
    return lp;
}

function startPass(track, when, fadeIn) {
    const ctx = S.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = track.buf;
    src.connect(g).connect(track.gain);
    // a few ms fade-in avoids a click when the loop start isn't at a zero crossing
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + (fadeIn ?? 0.006));
    src.start(when, track.lp.start);
    const pass = { src, g, when, end: when + (track.lp.end - track.lp.start) };
    // stop the pass after its tail has rung out under the next one
    g.gain.setValueAtTime(1, pass.end);
    g.gain.setTargetAtTime(0, pass.end, TAIL_S / 4);
    src.stop(pass.end + TAIL_S);
    src.onended = () => { try { g.disconnect(); } catch (e) { /* already gone */ } };
    track.passes.push(pass);
    track.passes = track.passes.filter((p) => p.end + TAIL_S > now());
    scheduleNext(track, pass);
}

function scheduleNext(track, pass) {
    // queue the following pass well before it is due (setTimeout is coarse/throttled in background tabs;
    // the audio clock does the precise timing)
    const lead = Math.max(0, pass.end - now() - 4) * 1000;
    clearTimeout(track.timer);
    track.timer = setTimeout(() => { if (!track.leaving && S.ctx) startPass(track, Math.max(pass.end, now() + 0.01), 0.004); }, lead);
}

/**
 * Play a looping track, crossfading from whatever is playing. opts { fadeIn = 600 ms, fadeOut = 1200 ms,
 * restart = false (restart even if it is already the current track), intensity = 1 }.
 * Clears ducks and boss mode: a new track is a new context (menu, run, ...).
 */
export function playMusic(key, opts = {}) {
    if (!S.ctx) return;
    const buf = S.game.cache.audio.get(key);
    if (!buf || typeof buf.getChannelData !== 'function') return;
    S.ducks.clear();
    S.boss = false;
    S.intensity = opts.intensity ?? 1;
    applyBus(400);
    const cur = S.tracks.find((t) => !t.leaving);
    if (cur && cur.key === key && !opts.restart) { glide(cur.gain.gain, 1, opts.fadeIn ?? 600); return; }
    for (const t of S.tracks) if (!t.leaving) fadeTrack(t, opts.fadeOut ?? 1200);
    const gain = S.ctx.createGain();
    gain.connect(S.lowpass);
    const track = { key, buf, gain, lp: loopPoints(key, buf), passes: [], timer: 0, leaving: false };
    S.tracks.push(track);
    const fadeIn = (opts.fadeIn ?? 600) / 1000;
    startPass(track, now() + 0.02, Math.max(0.006, fadeIn));
}

function fadeTrack(track, ms) {
    track.leaving = true;
    clearTimeout(track.timer);
    const t = now(), s = Math.max(0.02, ms / 1000);
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(track.gain.gain.value, t);
    track.gain.gain.linearRampToValueAtTime(0, t + s);
    for (const p of track.passes) { try { p.src.stop(t + s + 0.05); } catch (e) { /* not started yet */ } }
    setTimeout(() => {
        try { track.gain.disconnect(); } catch (e) { /* ignore */ }
        S.tracks = S.tracks.filter((x) => x !== track);
    }, ms + 200);
}

/** Fade out and stop all music. */
export function stopMusic(ms = 600) {
    if (!S.ctx) return;
    for (const t of S.tracks) if (!t.leaving) fadeTrack(t, ms);
}

/** User music volume 0..1 (settings slider). */
export function setMusicVolume(v) {
    if (S.ctx) glide(S.volume.gain, clamp01(v), 60);
}

/** Duck the music for a reason ('pause' | 'upgrade' | 'gameover' | 'launch'): low-pass + quieter. */
export function duck(reason, on = true, ms = 350) {
    if (!S.ctx || !DUCKS[reason] || S.ducks.has(reason) === on) return;
    if (on) S.ducks.add(reason); else S.ducks.delete(reason);
    applyBus(ms);
}

/** Gameplay intensity 0 (calm: darker, a touch quieter) .. 1 (wide open). */
export function setIntensity(v) {
    if (!S.ctx) return;
    v = clamp01(v);
    if (Math.abs(v - S.intensity) < 0.01) return;
    S.intensity = v;
    applyBus(1500);
}

/** Boss fight state: filter fully open, extra low-end weight and air, a bit louder. */
export function setBossMode(on) {
    if (!S.ctx || S.boss === !!on) return;
    S.boss = !!on;
    applyBus(on ? 600 : 2000);
}

function applyBus(ms) {
    let gain = S.boss ? 1.12 : 0.86 + 0.14 * S.intensity;
    // exponential cutoff mapping: 0 -> ~3.2 kHz, 1 -> open
    let hz = S.boss ? OPEN_HZ : 3200 * Math.pow(OPEN_HZ / 3200, S.intensity);
    for (const r of S.ducks) { gain = Math.min(gain, DUCKS[r].gain); hz = Math.min(hz, DUCKS[r].hz); }
    glide(S.mix.gain, gain, ms);
    glide(S.lowpass.frequency, hz, ms);
    glide(S.lowshelf.gain, S.boss ? 5 : 1.5 * S.intensity, ms);
    glide(S.highshelf.gain, S.boss ? 3 : 0, ms);
}

/** Debug/verification snapshot. */
export function musicState() {
    if (!S.ctx) return null;
    return {
        state: S.ctx.state, track: currentTrack(), tracks: S.tracks.map((t) => ({ key: t.key, leaving: t.leaving, passes: t.passes.length, loop: t.lp })),
        ducks: [...S.ducks], intensity: S.intensity, boss: S.boss, cutoff: Math.round(S.lowpass.frequency.value), mix: +S.mix.gain.value.toFixed(3), volume: +S.volume.gain.value.toFixed(3)
    };
}
