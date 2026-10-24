// Music reactivity: reads the music bus analyser once per frame and turns it into a few cheap signals for visuals.
//   getBass()   0..1 smoothed low-end energy (≈40-160 Hz)
//   getLevel()  0..1 smoothed overall loudness
//   getPulse()  0..1 envelope that jumps on each beat and decays (~200 ms) - handy for glows
//   onBeat(cb)  cb(strength 0..1) on every beat of the music; returns an unsubscribe function
// Beats come straight from the music sequencer (exact, on the audio clock), loudness from the analyser tap.
// Driven by the game's 'step' event, so nothing has to call update(). No-op safe before the music engine exists.
import { musicAnalyser, popBeats } from './music.js';
import { save } from './Save.js';

const BASS_HZ = [40, 160];
const listeners = new Set();
const R = { bins: null, bass: 0, level: 0, pulse: 0, peak: 0, peakAll: 0, beats: 0, installed: false };

export const getBass = () => R.bass;
export const getLevel = () => R.level;
export const getPulse = () => R.pulse;
/** total beats detected (verification/debug) */
export const beatCount = () => R.beats;

export function onBeat(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

/** Hook the per-frame update into the game loop once. */
export function installAudioReact(game) {
    if (R.installed) return;
    R.installed = true;
    game.events.on('step', (time, delta) => update(time, delta));
}

function update(time, dt) {
    const an = musicAnalyser();
    R.pulse *= Math.exp(-dt / 200);
    // muted music shouldn't drive visuals: the beats would be "inaudible flashes"
    if (!an || save.musicVolume <= 0 || an.context.state !== 'running') { R.bass *= 0.9; R.level *= 0.9; popBeats(() => {}); return; }
    if (!R.bins || R.bins.length !== an.frequencyBinCount) R.bins = new Float32Array(an.frequencyBinCount);
    an.getFloatFrequencyData(R.bins);           // dB per bin
    const hzPerBin = an.context.sampleRate / an.fftSize;
    const b0 = Math.max(1, Math.round(BASS_HZ[0] / hzPerBin)), b1 = Math.round(BASS_HZ[1] / hzPerBin);
    const top = R.bins.length >> 2;            // up to ~6 kHz is where the music lives
    // linear power: the byte/dB view saturates on a mastered bass line and hides the kicks
    let bassP = 0, allP = 0;
    for (let i = 1; i < top; i++) {
        const p = Math.pow(10, R.bins[i] / 10);
        allP += p;
        if (i >= b0 && i <= b1) bassP += p;
    }
    // auto-gain: normalise against a slowly decaying recent peak so quiet and loud tracks both span 0..1
    R.peak = Math.max(bassP, (R.peak || 1e-9) * Math.exp(-dt / 4000));
    R.peakAll = Math.max(allP, (R.peakAll || 1e-9) * Math.exp(-dt / 4000));
    const bass = Math.sqrt(bassP / R.peak), all = Math.sqrt(allP / R.peakAll);
    R.bass += (bass - R.bass) * (bass > R.bass ? 0.6 : 0.15);
    R.level += (all - R.level) * (all > R.level ? 0.3 : 0.05);
    // beats are scheduled by the sequencer; this hands out the ones that are sounding now
    popBeats((strength) => {
        R.beats++;
        R.pulse = Math.max(R.pulse, strength);
        for (const cb of listeners) cb(strength);
    });
}
