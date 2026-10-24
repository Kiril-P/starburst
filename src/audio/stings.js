// Short one-shot music stings (not loops): boss warning, wave clear, game over, upgrade screen, victory.
// An event is [beat, voice, notes, lengthInBeats, velocity]; `notes` is a note name or an array (a chord).
// Same engine as the tracks: voices from dsp.js on a small bus with a room send.
import { midi, hz, kick, snare, tom, bass, pluck, lead, pad, riser, crash, bell, hat } from './dsp.js';
import { impulse } from './dsp.js';

export const STINGS = {
    // boss intro: noise riser, then a slam on D minor with toms
    'sting-boss': {
        bpm: 140, gain: 0.3, len: 8.5, events: [
            [0, 'riser', 'x', 4, 1], [3, 'tom', 'D3', 0.5, 0.6], [3.5, 'tom', 'F3', 0.5, 0.7], [3.75, 'tom', 'A3', 0.5, 0.8],
            [4, 'kick', 'x', 1, 1], [4, 'crash', 'x', 3, 1], [4, 'bass', 'D1', 3, 1], [4, 'pad', ['D2', 'A2', 'F3', 'D4'], 3.5, 1],
            [4, 'lead', 'D5', 1.5, 0.9], [5.5, 'lead', 'F5', 0.5, 0.9], [6, 'lead', 'E5', 0.5, 0.85], [6.5, 'lead', 'D5', 1.5, 0.9],
            [6, 'kick', 'x', 1, 0.9], [7, 'snare', 'x', 1, 0.9]
        ]
    },
    // wave clear: bright major run up and a bell
    'sting-clear': {
        bpm: 132, gain: 0.5, len: 3.6, events: [
            [0, 'pluck', 'C5', 0.5, 0.9], [0.5, 'pluck', 'E5', 0.5, 0.9], [1, 'pluck', 'G5', 0.5, 0.9], [1.5, 'pluck', 'C6', 0.5, 0.95],
            [2, 'pluck', 'E6', 1, 1], [2, 'bell', 'C6', 2.5, 0.9], [2, 'pad', ['C3', 'G3', 'E4', 'C5'], 2.5, 0.9],
            [0, 'kick', 'x', 1, 0.5], [2, 'kick', 'x', 1, 0.45], [2, 'hat', 'x', 1, 0.5]
        ]
    },
    // game over: slow minor fall, low final note
    'sting-gameover': {
        bpm: 76, gain: 0.2, len: 6.2, events: [
            [0, 'lead', 'A4', 1.5, 0.9], [1.5, 'lead', 'G4', 0.5, 0.85], [2, 'lead', 'F4', 1.5, 0.85], [3.5, 'lead', 'E4', 0.5, 0.8], [4, 'lead', 'C4', 3, 0.8],
            [0, 'pad', ['A2', 'E3', 'C4'], 2, 0.9], [2, 'pad', ['F2', 'C3', 'A3'], 2, 0.9], [4, 'pad', ['A1', 'E2', 'A2', 'C3'], 4, 1],
            [4, 'bass', 'A1', 3.5, 1], [4, 'bell', 'A3', 4, 0.7], [0, 'tom', 'A2', 1, 0.7]
        ]
    },
    // upgrade screen opens: shimmering ascending chime
    'sting-upgrade': {
        bpm: 120, gain: 0.6, len: 2.8, events: [
            [0, 'pluck', 'G4', 0.5, 0.8], [0.25, 'pluck', 'B4', 0.5, 0.8], [0.5, 'pluck', 'D5', 0.5, 0.85], [0.75, 'pluck', 'G5', 0.5, 0.9],
            [1, 'pluck', 'B5', 1, 0.95], [1, 'bell', 'G5', 2, 0.8], [1, 'pad', ['G3', 'D4', 'B4'], 2, 0.8]
        ]
    },
    // victory: fanfare in C major with a held top note
    'sting-victory': {
        bpm: 120, gain: 0.3, len: 9.5, events: [
            [0, 'lead', 'G4', 0.5, 0.9], [0.5, 'lead', 'C5', 0.5, 0.9], [1, 'lead', 'E5', 0.5, 0.9], [1.5, 'lead', 'G5', 1, 1],
            [2.5, 'lead', 'E5', 0.5, 0.9], [3, 'lead', 'G5', 0.5, 0.95], [3.5, 'lead', 'C6', 2, 1],
            [0, 'pad', ['C3', 'G3', 'E4'], 3, 0.9], [3, 'pad', ['F2', 'C3', 'A3', 'C4'], 1.5, 0.9], [4.5, 'pad', ['C2', 'G2', 'E3', 'G3', 'C4'], 5, 1],
            [0, 'kick', 'x', 1, 1], [1, 'kick', 'x', 1, 0.8], [2, 'kick', 'x', 1, 0.8], [3, 'kick', 'x', 1, 0.9],
            [3.5, 'crash', 'x', 3, 1], [3.5, 'kick', 'x', 1, 1], [1.5, 'snare', 'x', 1, 0.7], [3, 'snare', 'x', 1, 0.8],
            [3.5, 'bass', 'C2', 3, 1], [4.5, 'bell', 'C6', 4, 0.8], [5, 'bell', 'G6', 4, 0.6], [6, 'bell', 'E6', 3, 0.5]
        ]
    }
};
export const STING_KEYS = Object.keys(STINGS);

const note = (n) => hz(midi(n));

/** a small bus for a sting: dry out + room send. Returns { input, dispose } */
export function createStingBus(ctx, dest, gain = 1) {
    const input = ctx.createGain(), dry = ctx.createGain(), send = ctx.createGain(), room = ctx.createConvolver();
    dry.gain.value = gain; send.gain.value = 0.3;
    room.buffer = impulse(ctx);
    input.connect(dry).connect(dest);
    input.connect(send); send.connect(room); room.connect(dry);
    return { input, dispose() { try { input.disconnect(); dry.disconnect(); room.disconnect(); send.disconnect(); } catch (e) { /* gone */ } } };
}

/** schedule a whole sting at audio time t onto `out`; returns its length in seconds */
export function scheduleSting(ctx, out, def, t) {
    const beat = 60 / def.bpm;
    for (const [b, voice, n, len, v] of def.events) {
        const at = t + b * beat, l = len * beat;
        if (voice === 'kick') kick(ctx, out, at, v);
        else if (voice === 'snare') snare(ctx, out, at, v);
        else if (voice === 'hat') hat(ctx, out, at, v, true);
        else if (voice === 'crash') crash(ctx, out, at, v, l);
        else if (voice === 'riser') riser(ctx, out, at, l, v);
        else if (voice === 'tom') tom(ctx, out, at, v, note(n));
        else if (voice === 'bass') bass(ctx, out, at, note(n), l, v, { cut: 1100 });
        else if (voice === 'pluck') pluck(ctx, out, at, note(n), l, v, { duty: 0.25, cut: 5200 });
        else if (voice === 'lead') lead(ctx, out, at, note(n), l, v, { duty: 0.25 });
        else if (voice === 'bell') bell(ctx, out, at, note(n), l, v);
        else if (voice === 'pad') pad(ctx, out, at, n.map(note), l, v, { cut: 1700, attack: 0.08 });
    }
    return def.len;
}
