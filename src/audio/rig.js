// The mixer for one music track: a gain bus per layer (pad, bass, kick, snare, hat, arp, lead, fx) feeding a dry
// output plus two shared sends (a dotted-eighth echo locked to the track's tempo, and a small room). The layer gains
// are how intensity works: calm gameplay hears pad + bass + kick (+ a quiet arp), and as the run heats up hats,
// snare, arp, lead and finally percussion fade in. Boss mode opens everything. The sequencer always schedules every
// layer, so layers fade in already in sync with the groove.
import { impulse } from './dsp.js';

/** intensity (0..1) at which each layer reaches full level; it fades in over the 0.12 below that */
export const GATES = { pad: 0, bass: 0, kick: 0, hat: 0.15, arp: 0.1, snare: 0.3, lead: 0.55, fx: 0.8 };
const SEND = {                                  // [echo, room] amounts per layer
    pad: [0, 0.34], bass: [0, 0], kick: [0, 0.02], snare: [0, 0.22], hat: [0, 0.05],
    arp: [0.34, 0.14], lead: [0.3, 0.24], fx: [0.1, 0.28]
};
/** overall music level: tracks are written at full scale, this puts them ~ -23 dBFS RMS so sfx sit on top */
const TRIM = 0.18;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** dest: where the rig's output goes (a track gain). def.bpm sets the echo time; def.mix the layer levels */
export function createRig(ctx, def, dest) {
    const out = ctx.createGain();
    out.gain.value = TRIM * (def.gain ?? 1);
    out.connect(dest);

    const echoIn = ctx.createGain(), echo = ctx.createDelay(2), fb = ctx.createGain(), tone = ctx.createBiquadFilter(), echoOut = ctx.createGain();
    echo.delayTime.value = (60 / def.bpm) * 0.75;
    fb.gain.value = def.echo ?? 0.38;
    tone.type = 'lowpass'; tone.frequency.value = 2600;
    echoOut.gain.value = 0.6;
    echoIn.connect(echo); echo.connect(tone); tone.connect(fb); fb.connect(echo); tone.connect(echoOut); echoOut.connect(out);

    const roomIn = ctx.createGain(), room = ctx.createConvolver(), roomOut = ctx.createGain();
    room.buffer = impulse(ctx);
    roomOut.gain.value = 0.55;
    roomIn.connect(room); room.connect(roomOut); roomOut.connect(out);

    const layer = {};
    for (const name of Object.keys(GATES)) {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(out);
        const [e, r] = SEND[name];
        if (e) { const s = ctx.createGain(); s.gain.value = e; g.connect(s); s.connect(echoIn); }
        if (r) { const s = ctx.createGain(); s.gain.value = r; g.connect(s); s.connect(roomIn); }
        layer[name] = g;
    }

    const rig = {
        out, layer,
        /** move every layer to its level for this intensity / boss state; ms = glide time (0 = jump) */
        setLevel(intensity, boss, ms = 0) {
            const t = ctx.currentTime;
            for (const name of Object.keys(GATES)) {
                const on = boss ? 1 : clamp01(1 + (intensity - GATES[name]) / 0.12);
                const target = (def.mix?.[name] ?? 0.7) * on, p = layer[name].gain;
                p.cancelScheduledValues(t);
                if (ms <= 0) p.setValueAtTime(target, t);
                else { p.setValueAtTime(p.value, t); p.setTargetAtTime(target, t, Math.max(0.01, ms / 3000)); }
            }
        },
        dispose() { try { out.disconnect(); for (const n of Object.values(layer)) n.disconnect(); echoIn.disconnect(); roomIn.disconnect(); } catch (e) { /* gone */ } }
    };
    return rig;
}
