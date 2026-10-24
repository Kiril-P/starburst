// One loop per sector, each 16 bars. Mood follows the biome: NEBULA dreamy, ASTEROID FIELD heavy and rhythmic,
// DERELICT STATION cold and sparse, SOLAR STORM fast and urgent. Intensity layers: pad/bass/kick are the calm
// bed, then hats + arp, snare, lead, and finally extra percussion as the waves ramp up.
import { MINOR, PHRYGIAN, DORIAN, K4, SNARE, H8, H16, OFF } from './scales.js';

// ---- 1  NEBULA: F# minor, 118 BPM, 16 bars = 32.5 s -----------------------------------------------------------------------
const NEB_A = '5:6 3:2 1:4 3:4  6:8 8:4 6:4  10:6 8:2 7:4 5:4  9:8 7:4 4:4';
const NEB_B = '8:2 10:2 13:4 12:4 10:4  12:4 10:4 9:4 7:4  11:4 9:4 7:4 9:4  8:8 0:4 5:2 7:2';
export const sector1 = {
    key: 'sector1', name: 'Sector 1 - Nebula', bpm: 118, tonic: 'F#4', scale: MINOR, swing: 0.06,
    bassOct: 1, arpOct: 4, padOct: 3, arpLen: 2.2, arpDuty: 0.25, arpCut: 3200, echo: 0.42, gain: 0.86, leadDuty: 0.5, padCut: 1300,
    mix: { pad: 0.6, bass: 0.8, kick: 0.7, snare: 0.5, hat: 0.35, arp: 0.5, lead: 0.5, fx: 0.4 },
    sections: [
        { bars: 4, prog: 'F#m D A E', bass: 'x.......x.....o.', arp: '0.1.2.3.4.3.2.1.', lead: NEB_A, crash: true,
          drums: { k: 'x...x...x...x...', s: '........x.......', h: 'x.x.x.x.x.x.x.xg', o: OFF } },
        { bars: 4, prog: 'D A E F#m', bass: 'x..x..o.x..x..o.', arp: '0.12.21.0.12.21.', lead: NEB_B,
          drums: { k: K4, s: SNARE, h: H8, o: OFF } },
        { bars: 4, prog: 'F#m D A E', bass: 'x.......x.......', arp: '0.1.2.1.0.1.2.1.', padHalf: true, fill: true,
          drums: { k: 'x.......x.......', s: '................', h: '..x...x...x...x.', p: '..............t.' } },
        { bars: 4, prog: 'F#m D A E', bass: 'x..x..o.x..x..o.', arp: '0123432101234321', lead: NEB_A, crash: true,
          leadVoice: { duty: 0.25 }, drums: { k: K4, s: SNARE, h: H8, o: OFF, p: '.......t.......t' } }
    ]
};

// ---- 2  ASTEROID FIELD: E phrygian, 132 BPM, 16 bars = 29.1 s --------------------------------------------------------------
const AST_A = '1:2 0:2 1:2 2:2 1:2 0:2 -7:4  1:2 0:2 1:2 3:2 2:2 1:2 -7:4  1:2 0:2 1:2 5:2 4:2 3:2 2:4  3:2 2:2 1:2 2:2 1:8';
export const sector2 = {
    key: 'sector2', name: 'Sector 2 - Asteroid Field', bpm: 132, tonic: 'E4', scale: PHRYGIAN, swing: 0,
    bassOct: 1, arpOct: 4, padOct: 3, arpLen: 1.1, arpDuty: 0.125, arpCut: 3800, bassWave: 'sawtooth', bassCut: 1000, gain: 0.71, leadDuty: 0.25,
    kick: { punch: 170, tail: 0.26 }, tickHz: 900, padCut: 1000,
    mix: { pad: 0.45, bass: 0.9, kick: 0.9, snare: 0.7, hat: 0.4, arp: 0.5, lead: 0.5, fx: 0.55 },
    sections: [
        { bars: 4, prog: 'Em F Em D', bass: 'x.xx.x.xx.xx.x.x', arp: '0.2.1.2.0.2.1.3.', crash: true,
          drums: { k: 'x..x..x.x..x..x.', s: SNARE, h: H8, p: '.......M.......m' } },
        { bars: 4, prog: 'Em F Em D', bass: 'x.xx.x.xx.xx.x.x', arp: '012012012012012.', lead: AST_A,
          drums: { k: 'x..x..x.x..x..x.', s: SNARE, h: H16, o: OFF, p: '.......M.......m' } },
        { bars: 4, prog: 'Am F D Em', bass: 'x...x...x...x.o.', arp: '0.1.2.1.0.1.2.1.', fill: true, padHalf: true,
          drums: { k: 'x...............', s: '........x.......', h: 'x.x.x.x.x.x.x.x.', p: 'M..m..M..m..M.mm' } },
        { bars: 4, prog: 'Em F Em D', bass: 'x.xx.x.xx.xx.x.x', arp: '012012012012012.', lead: AST_A, crash: true,
          leadVoice: { duty: 0.125 }, drums: { k: 'x..x..x.x..x..x.', s: SNARE, h: H16, o: OFF, p: 'M.m.M.m.M.m.M.mm' } }
    ]
};

// ---- 3  DERELICT STATION: C minor, 96 BPM half-time, 16 bars = 40.0 s ------------------------------------------------------
const STA_A = '5:8 4:4 3:4  8:12 7:4  6:6 5:2 4:8  3:16';
export const sector3 = {
    key: 'sector3', name: 'Sector 3 - Derelict Station', bpm: 96, tonic: 'C4', scale: MINOR, swing: 0,
    bassOct: 1, arpOct: 4, padOct: 2, arpLen: 0.9, arpDuty: 0.125, arpCut: 2600, bassWave: 'square', bassCut: 600, echo: 0.46, gain: 0.52, leadDuty: 0.125,
    leadCut: 3000, tickHz: 1700, padCut: 900,
    mix: { pad: 0.7, bass: 0.9, kick: 0.8, snare: 0.6, hat: 0.35, arp: 0.5, lead: 0.5, fx: 0.55 },
    sections: [
        { bars: 4, prog: 'Cm Ab Bb Cm', bass: 'x.x.x.x.x.x.x.x.', arp: '0...2...1...3...', crash: true,
          drums: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.', p: 't...t...t...t.t.' } },
        { bars: 4, prog: 'Cm Ab Bb Cm', bass: 'x.x.x.x.x.x.x.x.', arp: '0.1.2.1.0.1.2.1.', lead: STA_A,
          drums: { k: 'x.....x.x.......', s: '........x.......', h: H8, o: OFF, p: 't...t...t...t.t.' } },
        { bars: 4, prog: 'Fm Ab Fm G', bass: 'x...x...x...x...', arp: '0...1...2...1...', padHalf: true, fill: true,
          drums: { k: 'x...............', s: '................', h: '................', p: 't..t..t..t..t...' } },
        { bars: 4, prog: 'Cm Ab Bb Cm', bass: 'x.x.x.x.x.x.x.xx', arp: '0.1.2.1.0.1.2.1.', lead: STA_A, crash: true,
          drums: { k: 'x.....x.x.....x.', s: '........x.......', h: H8, o: OFF, p: 'tgtgtgtgtgtgtgtg' } }
    ]
};

// ---- 4  SOLAR STORM: G dorian, 150 BPM, 16 bars = 25.6 s -------------------------------------------------------------------
const SOL_A = '1:2 3:2 5:2 8:2 7:2 5:2 3:2 5:2  4:2 6:2 8:2 11:2 10:2 8:2 6:2 8:2  5:2 7:2 9:2 12:2 11:2 9:2 7:2 9:2  8:4 10:4 9:4 7:4';
export const sector4 = {
    key: 'sector4', name: 'Sector 4 - Solar Storm', bpm: 150, tonic: 'G4', scale: DORIAN, swing: 0,
    bassOct: 1, arpOct: 4, padOct: 3, arpLen: 1.2, arpDuty: 0.25, arpCut: 5200, bassWave: 'sawtooth', bassCut: 1300, gain: 0.7, leadDuty: 0.25,
    kick: { punch: 160, tail: 0.22 }, tickHz: 2000, padCut: 1800,
    mix: { pad: 0.45, bass: 0.9, kick: 0.9, snare: 0.7, hat: 0.4, arp: 0.5, lead: 0.5, fx: 0.55 },
    sections: [
        { bars: 4, prog: 'Gm Eb Bb F', bass: 'x.xxx.xxx.xxx.xx', arp: '0.12.21.0.12.21.', crash: true,
          drums: { k: K4, s: SNARE, h: H16 } },
        { bars: 4, prog: 'Gm Eb Bb F', bass: 'x.xxx.xxx.xxx.xx', arp: '0123432101234321', lead: SOL_A,
          drums: { k: K4, s: SNARE, h: H16, o: OFF, p: '..............tt' } },
        { bars: 4, prog: 'Cm Eb F Gm', bass: 'x..x..x.x..x..x.', arp: '0.1.2.1.0.1.2.1.', fill: true,
          drums: { k: 'x..x..x.x..x..x.', s: '........x.......', h: H8, p: '..tt..tt..tt..tt' } },
        { bars: 4, prog: 'Gm Eb Bb F', bass: 'x.xxx.xxx.xxx.xx', arp: '0123432101234321', lead: SOL_A, crash: true,
          leadVoice: { duty: 0.125 }, drums: { k: 'x...x...x...x.xx', s: SNARE, h: H16, o: OFF, p: 't.t.t.t.t.t.t.tt' } }
    ]
};
