// Live music engine on a plain AudioContext (no Phaser, no Save: systems/music.js wraps it for the game and
// audio-lab.html uses it directly). Tracks are not audio files: each one is a Sequencer scheduling synth voices a
// second or so ahead on the audio clock, so a loop has no seam at all (the pattern simply continues, tails included),
// and there is nothing to decode or download. Graph:
//
//   track rig -> trackGain ─┐
//   track rig -> trackGain ─┴> lowpass -> lowshelf -> highshelf -> mix ─┬> volume -> destination
//   sting bus ---------------------------------------------------------│-^   (stings skip the intensity filter)
//                                                                       └> analyser (visual reactivity)
//
// Intensity (0..1) opens rig layers (see rig.js GATES) and the bus filter; boss mode opens everything. Beats come
// from the sequencer itself: popBeats() hands out the ones whose audio time has arrived.
import { TRACKS } from './tracks/index.js';
import { STINGS, createStingBus, scheduleSting } from './stings.js';
import { createRig } from './rig.js';
import { Sequencer } from './sequencer.js';

const OPEN_HZ = 20000;
const DUCKS = {              // reason -> { gain, cutoff Hz }; the strongest active duck wins
    pause: { gain: 0.45, hz: 650 },
    upgrade: { gain: 0.6, hz: 1100 },
    gameover: { gain: 0.35, hz: 480 },
    launch: { gain: 0.5, hz: 900 },
    sting: { gain: 0.55, hz: 2500 }
};
const PUMP_MS = 120, AHEAD_S = 1.5, RIG_TAIL_MS = 3500;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createEngine(ctx, destination, { volume = 0.7 } = {}) {
    const S = { tracks: [], ducks: new Set(), intensity: 1, boss: false, beats: [], stings: new Set(), timer: 0 };
    const lowpass = ctx.createBiquadFilter(), lowshelf = ctx.createBiquadFilter(), highshelf = ctx.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.Q.value = 0.9; lowpass.frequency.value = OPEN_HZ;
    lowshelf.type = 'lowshelf'; lowshelf.frequency.value = 140;
    highshelf.type = 'highshelf'; highshelf.frequency.value = 4500;
    const mix = ctx.createGain(), vol = ctx.createGain(), analyser = ctx.createAnalyser();
    vol.gain.value = volume;
    analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.55;
    lowpass.connect(lowshelf).connect(highshelf).connect(mix);
    mix.connect(vol).connect(destination);
    mix.connect(analyser);

    /** smooth parameter move; tau ~ ms/3 so the target is ~95% reached after `ms` */
    const glide = (param, value, ms) => {
        const t = ctx.currentTime;
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.setTargetAtTime(value, t, Math.max(0.005, ms / 3000));
    };
    const live = () => S.tracks.filter((t) => !t.leaving);

    function applyBus(ms) {
        let gain = S.boss ? 1.12 : 0.86 + 0.14 * S.intensity;
        let hz = S.boss ? OPEN_HZ : 3200 * Math.pow(OPEN_HZ / 3200, S.intensity);      // 0 -> ~3.2 kHz, 1 -> open
        for (const r of S.ducks) { gain = Math.min(gain, DUCKS[r].gain); hz = Math.min(hz, DUCKS[r].hz); }
        glide(mix.gain, gain, ms);
        glide(lowpass.frequency, hz, ms);
        glide(lowshelf.gain, S.boss ? 5 : 1.5 * S.intensity, ms);
        glide(highshelf.gain, S.boss ? 3 : 0, ms);
        for (const t of live()) t.rig.setLevel(S.intensity, S.boss, ms);
    }

    function pump() { for (const t of S.tracks) t.seq.pump(AHEAD_S); }
    const ensureTimer = () => { if (!S.timer) S.timer = setInterval(pump, PUMP_MS); };

    function fade(track, ms) {
        track.leaving = true;
        track.seq.stop();
        const t = ctx.currentTime, s = Math.max(0.02, ms / 1000);
        track.gain.gain.cancelScheduledValues(t);
        track.gain.gain.setValueAtTime(track.gain.gain.value, t);
        track.gain.gain.linearRampToValueAtTime(0, t + s);
        // voices already scheduled ahead keep playing under the fade; free the rig once they are surely silent
        setTimeout(() => { track.rig.dispose(); try { track.gain.disconnect(); } catch (e) { /* gone */ } S.tracks = S.tracks.filter((x) => x !== track); if (!S.tracks.length) { clearInterval(S.timer); S.timer = 0; } }, ms + RIG_TAIL_MS);
    }

    return {
        ctx, analyser,
        tracks: () => Object.keys(TRACKS),
        current: () => live()[0]?.key ?? null,

        /** play a looping track, crossfading from the current one. opts { fadeIn, fadeOut, restart, intensity, boss } */
        play(key, opts = {}) {
            const def = TRACKS[key];
            if (!def) return false;
            S.ducks.clear();
            S.boss = !!opts.boss;
            S.intensity = opts.intensity ?? 1;
            const cur = live()[0];
            if (cur && cur.key === key && !opts.restart) { applyBus(400); glide(cur.gain.gain, 1, opts.fadeIn ?? 600); return true; }
            for (const t of live()) fade(t, opts.fadeOut ?? 1200);
            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.connect(lowpass);
            const rig = createRig(ctx, def, gain);
            rig.setLevel(S.intensity, S.boss, 0);
            const track = { key, def, gain, rig, leaving: false };
            track.seq = new Sequencer(ctx, def, rig, (time, strength) => { if (!track.leaving) { S.beats.push({ time, strength }); if (S.beats.length > 64) S.beats.shift(); } });
            S.tracks.push(track);
            const fin = Math.max(0.006, (opts.fadeIn ?? 600) / 1000), t0 = ctx.currentTime + 0.03;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(1, t0 + fin);
            track.seq.start(t0);
            applyBus(400);
            ensureTimer();
            return true;
        },

        stop(ms = 600) { for (const t of live()) fade(t, ms); },
        setVolume(v) { glide(vol.gain, clamp01(v), 60); },
        duck(reason, on = true, ms = 350) {
            if (!DUCKS[reason] || S.ducks.has(reason) === on) return;
            if (on) S.ducks.add(reason); else S.ducks.delete(reason);
            applyBus(ms);
        },
        setIntensity(v) {
            v = clamp01(v);
            if (Math.abs(v - S.intensity) < 0.01) return;
            S.intensity = v;
            applyBus(1500);
        },
        setBoss(on) {
            if (S.boss === !!on) return;
            S.boss = !!on;
            applyBus(on ? 600 : 2000);
        },

        /** one-shot music sting (STINGS key). opts { vol = 1, duck = true } -> length in seconds or 0 */
        sting(key, opts = {}) {
            const def = STINGS[key];
            if (!def) return 0;
            const bus = createStingBus(ctx, vol, (opts.vol ?? 1) * def.gain);
            const len = scheduleSting(ctx, bus.input, def, ctx.currentTime + 0.03);
            S.stings.add(bus);
            setTimeout(() => { bus.dispose(); S.stings.delete(bus); }, (len + 2.5) * 1000);
            if (opts.duck !== false) {
                this.duck('sting', true, 120);
                clearTimeout(S.stingT);
                S.stingT = setTimeout(() => this.duck('sting', false, 900), Math.min(len, 3.5) * 1000);
            }
            return len;
        },

        /** beats whose audio time has arrived (call once per frame); fn(strength) */
        popBeats(fn) {
            const now = ctx.currentTime;
            while (S.beats.length && S.beats[0].time <= now + 0.02) {
                const b = S.beats.shift();
                if (b.time > now - 0.25) fn(b.strength);      // stale beats (tab was hidden) are dropped
            }
        },

        state() {
            return {
                state: ctx.state, track: this.current(), tracks: S.tracks.map((t) => ({ key: t.key, leaving: t.leaving, bar: t.seq.bar })),
                ducks: [...S.ducks], intensity: S.intensity, boss: S.boss, cutoff: Math.round(lowpass.frequency.value), mix: +mix.gain.value.toFixed(3), volume: +vol.gain.value.toFixed(3)
            };
        }
    };
}
