// TITLE THEME - "Starburst". A minor, 110 BPM, 16 bars (34.9 s). Heroic synthwave: pulsing octave bass, rolling
// arp, a lead that states the theme twice with a lifted bridge between. Plays at full intensity (menus).
import { MINOR, K4, SNARE, H8, OFF } from './scales.js';

const THEME = '8:4 7:2 5:2 3:4 5:4  6:4 8:2 6:2 5:4 3:4  5:2 6:2 8:4 10:4 9:2 8:2  7:6 5:2 2:4 4:4';
const BRIDGE = '10:4 8:2 6:2 8:8  9:4 7:2 9:2 11:8  8:2 9:2 10:4 12:4 10:2 9:2  11:4 9:4 7:4 5:4';
const ARP = '0123432101234321';

export default {
    key: 'title-music', name: 'Title Theme', bpm: 110, tonic: 'A4', scale: MINOR, swing: 0,
    bassOct: 1, arpOct: 4, padOct: 3, gain: 0.77, leadDuty: 0.5,
    mix: { pad: 0.5, bass: 0.85, kick: 0.85, snare: 0.65, hat: 0.4, arp: 0.5, lead: 0.55, fx: 0.5 },
    sections: [
        { bars: 4, prog: 'Am F C G', bass: 'x.......x.......', arp: '0.1.2.1.0.1.2.3.', crash: true,
          drums: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' } },
        { bars: 4, prog: 'Am F C G', bass: 'x.o.x.o.x.o.x.o.', arp: ARP, lead: THEME, crash: true,
          drums: { k: K4, s: SNARE, h: H8, o: OFF } },
        { bars: 4, prog: 'F G Am Em', bass: 'x.x.o.x.x.x.o.x.', arp: ARP, lead: BRIDGE, leadVoice: { duty: 0.25 },
          drums: { k: K4, s: SNARE, h: H8, o: OFF, p: '..............t.' }, fill: true },
        { bars: 4, prog: 'Am F C G', bass: 'x.o.x.o.x.o.x.o.', arp: ARP, crash: true, fill: true,
          lead: THEME.replace('7:6 5:2 2:4 4:4', '7:4 9:4 11:4 12:4'),
          drums: { k: K4, s: SNARE, h: 'xxxxxxxxxxxxxxxx', o: OFF } }
    ]
};
