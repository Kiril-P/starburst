// Set pieces for the newer enemies (merged into formations.js DEFS; same contract as formationsSet.js): raiders crossing
// in a pincer, a gate of laser pylons, wall emitters sweeping crossways, a pack of seekers, a pair of warpers.
import { W } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const sized = (f, n) => Math.max(1, Math.round(n * Math.min(1.2, f.wm.diff?.patternDensity ?? 1)));

export const STATION_PIECES = {
    // raiders cross from both sides at different heights: aimed fire from two directions at once
    crossfire(f, type, tier) {
        const pairs = tier >= 2 ? 2 : 1, out = [];
        for (let i = 0; i < pairs; i++) {
            const y = rand(56, 100) + i * 38;
            out.push({ at: i * 1300, type: 'strafer', x: 8, y });
            out.push({ at: i * 1300 + 650, type: 'strafer', x: W - 8, y: y + rand(18, 40) });
        }
        return out;
    },
    // pylons across the ceiling firing in turn: beams never fall in the same place twice in a row
    lasergate(f, type, tier) {
        const xs = tier >= 3 ? [0.28, 0.5, 0.72] : [0.33, 0.67];
        return xs.map((k, i) => ({ at: i * 500, type: 'pylon', x: Math.round(W * k + rand(-14, 14)), y: -18, after: (e) => { e.timer = 900 + i * 1100; } }));
    },
    // emitters on both walls at different heights: beams sweep across, one after the other
    crossbeam(f, type, tier) {
        const out = [
            { at: 0, type: 'emitter', x: 0, y: rand(70, 120), after: (e) => { e.timer = 800; } },
            { at: 500, type: 'emitter', x: W, y: rand(150, 220), after: (e) => { e.timer = 1900; } }
        ];
        return out;
    },
    // a pack of seekers dropping in from the top, spread across the width
    hunt(f, type, tier) {
        const count = sized(f, tier >= 2 ? 4 : 3), out = [];
        for (let i = 0; i < count; i++) {
            out.push({ at: i * 520, type: 'seeker', x: Math.round(W * (0.15 + 0.7 * (i + rand(0, 0.5)) / count)), y: -12 });
        }
        return out;
    },
    // two warpers: they blink in and out around you, a few seconds apart
    blink(f, type, tier) {
        return [{ at: 0, type: 'warper', x: W / 2, y: -30 }, { at: 1800, type: 'warper', x: W / 2, y: -30 }].slice(0, tier >= 2 ? 2 : 1);
    }
};
