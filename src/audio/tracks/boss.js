// BOSS THEMES. Always full intensity. Crossfaded in by Game audio when a boss arrives (setBossMode).
import { HARMONIC, PHRYGIAN_DOM, K4, SNARE, H16, OFF } from './scales.js';

// ---- BOSS: D harmonic minor, 140 BPM, 16 bars = 27.4 s ----------------------------------------------------------------------
const BOSS_A = '1:2 1:1 3:1 1:2 5:2 4:2 3:2 1:4  1:2 1:1 3:1 1:2 6:2 5:2 4:2 3:4  7:2 7:1 9:1 7:2 5:2 4:2 3:2 2:4  3:2 5:2 7:2 8:4 7:2 5:4';
export const boss = {
    key: 'boss', name: 'Boss', bpm: 140, tonic: 'D4', scale: HARMONIC, swing: 0,
    bassOct: 1, arpOct: 4, padOct: 3, arpLen: 1, arpDuty: 0.125, arpCut: 4600, bassWave: 'sawtooth', bassCut: 1400, gain: 0.77, leadDuty: 0.25,
    kick: { punch: 170, tail: 0.24 }, tickHz: 1500, padCut: 1400,
    mix: { pad: 0.5, bass: 0.95, kick: 0.95, snare: 0.8, hat: 0.4, arp: 0.5, lead: 0.55, fx: 0.6 },
    sections: [
        { bars: 4, prog: 'Dm Bb A Dm', bass: 'x.xxx.xxx.xxx.xx', arp: '0.12.21.0.12.21.', crash: true, padHalf: true,
          drums: { k: 'x..xx...x..xx...', s: SNARE, h: H16, o: OFF } },
        { bars: 4, prog: 'Dm Bb A Dm', bass: 'x.xxx.xxx.xxx.xx', arp: '0123432101234321', lead: BOSS_A, leadVoice: { duty: 0.25 },
          drums: { k: 'x..xx...x..xx...', s: SNARE, h: H16, o: OFF, p: 'M..m..M..m..M.mm' } },
        { bars: 4, prog: 'Gm Dm A Dm', bass: 'x.x.x.x.x.x.x.xx', arp: '0.1.2.1.0.1.2.1.', fill: true, padHalf: true, crash: true,
          drums: { k: K4, s: SNARE, h: H16, p: '....M.......m.mm' } },
        { bars: 4, prog: 'Dm Bb A Dm', bass: 'x.xxx.xxx.xxx.xx', arp: '0123432101234321', lead: BOSS_A, crash: true,
          leadVoice: { duty: 0.125 }, drums: { k: 'x..xx..xx..xx.xx', s: SNARE, h: H16, o: OFF, p: 'M.m.M.m.M.m.M.mm' } }
    ]
};

// ---- FINAL BOSS: C# phrygian dominant, 150 BPM, 16 bars = 25.6 s --------------------------------------------------------------
const FIN_A = '1:2 2:2 1:2 5:2 4:2 3:2 2:2 1:2  1:2 2:2 1:2 6:2 5:2 4:2 3:2 2:2  8:2 9:2 8:2 12:2 11:2 10:2 9:2 8:2  9:4 8:4 5:4 3:4';
export const bossFinal = {
    key: 'boss-final', name: 'Final Boss', bpm: 150, tonic: 'C#5', scale: PHRYGIAN_DOM, swing: 0,
    bassOct: 1, arpOct: 4, padOct: 3, arpLen: 1, arpDuty: 0.125, arpCut: 5200, bassWave: 'sawtooth', bassCut: 1600, gain: 0.73, leadDuty: 0.25,
    kick: { punch: 180, tail: 0.24 }, tickHz: 1700, padCut: 1800,
    mix: { pad: 0.6, bass: 0.95, kick: 0.95, snare: 0.85, hat: 0.4, arp: 0.55, lead: 0.6, fx: 0.65 },
    sections: [
        { bars: 4, prog: 'C#5 D C#5 D', bass: 'x.xxx.xxx.xxx.xx', arp: '0.12.21.0.12.21.', crash: true, padHalf: true,
          drums: { k: 'x..xx..xx..xx.xx', s: SNARE, h: H16, o: OFF, p: 'M.m.M.m.M.m.M.mm' } },
        { bars: 4, prog: 'C#5 D C#5 Bm', bass: 'x.xxx.xxx.xxx.xx', arp: '0123432101234321', lead: FIN_A, leadVoice: { duty: 0.25 },
          drums: { k: 'x..xx..xx..xx.xx', s: SNARE, h: H16, o: OFF, p: 'M.m.M.m.M.m.M.mm' } },
        { bars: 4, prog: 'F#m D C#5 C#5', bass: 'x.x.x.x.x.x.x.xx', arp: '0.1.2.1.0.1.2.1.', fill: true, padHalf: true, crash: true,
          drums: { k: K4, s: SNARE, h: H16, p: '....M.......m.mm' } },
        { bars: 4, prog: 'C#5 D C#5 Bm', bass: 'x.xxx.xxx.xxx.xx', arp: '0123432101234321', lead: FIN_A, crash: true,
          leadVoice: { duty: 0.125 }, drums: { k: 'x.xxx.xxx.xxx.xx', s: SNARE, h: H16, o: OFF, p: 'M.m.M.m.M.m.M.mm' } }
    ]
};
