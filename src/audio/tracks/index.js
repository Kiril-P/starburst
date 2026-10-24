// Registry of every loopable track, by the key playMusic() takes.
import title from './title.js';
import { sector1, sector2, sector3, sector4 } from './sectors.js';
import { boss, bossFinal } from './boss.js';

export const TRACKS = Object.fromEntries([title, sector1, sector2, sector3, sector4, boss, bossFinal].map((t) => [t.key, t]));
export const TRACK_KEYS = Object.keys(TRACKS);
/** gameplay track for a sector index (0-based; sectors past the fourth repeat the themes like the backdrops do) */
export const sectorTrack = (sector) => `sector${(Math.max(0, sector) % 4) + 1}`;
