// Achievements: ~20 one-off goals, each with its own 16x16 badge (`ach_<id>`, art/sprites/badges.js).
// test(r, life) gets a run snapshot r (see scenes/run/RunMeta.js snapshot()) and the lifetime counters;
// outside a run (hangar purchases, GameOver settle) r may be a partial object, so tests default missing fields.
// Unlocks persist in save.achievements as { id: timestamp }. Quests (systems/quests.js) stay separate.
import { save } from './Save.js';
import { SHIPS } from '../config.js';
import { isShipUnlocked } from './meta.js';

// tier colour of the badge rim: amber = milestone, cyan = skill, lime = survival, magenta = boss/hostile
export const ACHIEVEMENTS = [
    { id: 'first_blood', title: 'FIRST CONTACT', desc: 'DESTROY YOUR FIRST ENEMY', test: (r) => r.kills >= 1 },
    { id: 'exterminator', title: 'EXTERMINATOR', desc: 'DESTROY 150 ENEMIES IN ONE RUN', test: (r) => r.kills >= 150 },
    { id: 'grazer', title: 'CLOSE SHAVE', desc: 'GRAZE 50 BULLETS IN ONE RUN', test: (r) => r.graze >= 50 },
    { id: 'needle', title: 'THREAD THE NEEDLE', desc: 'GRAZE 300 BULLETS IN ONE RUN', test: (r) => r.graze >= 300 },
    { id: 'combo8', title: 'CHAIN REACTION', desc: 'REACH A X8 COMBO', test: (r) => r.maxCombo >= 8 },
    { id: 'combo16', title: 'OVERDRIVE', desc: 'REACH THE MAX X16 COMBO', test: (r) => r.maxCombo >= 16 },
    { id: 'wave5', title: 'SECTOR ONE', desc: 'REACH WAVE 5', test: (r) => r.wave >= 5 },
    { id: 'wave10', title: 'DEEP SPACE', desc: 'REACH WAVE 10', test: (r) => r.wave >= 10 },
    { id: 'wave20', title: 'EVENT HORIZON', desc: 'REACH WAVE 20', test: (r) => r.wave >= 20 },
    { id: 'boss1', title: 'GIANT SLAYER', desc: 'DEFEAT A BOSS', test: (r) => r.bosses >= 1 },
    { id: 'boss3', title: 'TRIPLE CROWN', desc: 'DEFEAT 3 BOSSES IN ONE RUN', test: (r) => r.bosses >= 3 },
    { id: 'score50k', title: 'HIGH ROLLER', desc: 'SCORE 50,000 IN ONE RUN', test: (r) => r.score >= 50000 },
    { id: 'score250k', title: 'LEGEND', desc: 'SCORE 250,000 IN ONE RUN', test: (r) => r.score >= 250000 },
    { id: 'untouchable', title: 'UNTOUCHABLE', desc: 'CLEAR A WAVE WITHOUT TAKING DAMAGE', test: (r) => !!r.cleanWave },
    { id: 'clutch', title: 'LAST BREATH', desc: 'CLEAR A WAVE WITH 10% HULL OR LESS', test: (r) => !!r.clutchWave },
    { id: 'speedy5', title: 'NEEDLE PILOT', desc: 'REACH WAVE 5 FLYING THE NOVA DART', test: (r) => r.ship === 'speedy' && r.wave >= 5 },
    { id: 'tank5', title: 'IRON WALL', desc: 'REACH WAVE 5 FLYING THE TITAN', test: (r) => r.ship === 'tank' && r.wave >= 5 },
    { id: 'hard5', title: 'NO MERCY', desc: 'REACH WAVE 5 ON HARD', test: (r) => r.difficulty === 'hard' && r.mode !== 'daily' && r.wave >= 5 },
    { id: 'daily', title: 'DAILY PILOT', desc: 'FINISH A DAILY RUN', test: (r, l) => (l.dailies ?? 0) >= 1 },
    { id: 'veteran', title: 'VETERAN', desc: 'FLY 10 RUNS', test: (r, l) => (l.runs ?? 0) >= 10 },
    { id: 'investor', title: 'INVESTOR', desc: 'BUY 5 HANGAR UPGRADES', test: (r, l) => (l.purchases ?? 0) >= 5 },
    { id: 'fleet', title: 'FULL FLEET', desc: 'UNLOCK EVERY SHIP', test: () => SHIPS.every(isShipUnlocked) }
];

export const isUnlocked = (id) => id in save.achievements;
export const unlockedCount = () => ACHIEVEMENTS.filter((a) => isUnlocked(a.id)).length;

// Unlocked during the current run (GameOver lists them). Reset by beginSession() when a run starts.
let session = [];
const listeners = new Set();

export function beginSession() { session = []; }
export const sessionUnlocks = () => session.slice();

/** fn(achievement) on every unlock, anywhere. Returns an unsubscribe function. */
export function onUnlock(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const RUN_DEFAULTS = { score: 0, wave: 0, kills: 0, graze: 0, maxCombo: 1, bosses: 0 };

/** Evaluate every locked achievement; persists and announces the new ones. Returns them. */
export function checkAchievements(run = {}) {
    const have = save.achievements;
    const r = { ...RUN_DEFAULTS, ...run };
    const life = save.lifetime;
    const fresh = ACHIEVEMENTS.filter((a) => !(a.id in have) && a.test(r, life));
    if (!fresh.length) return fresh;
    const now = Date.now();
    for (const a of fresh) have[a.id] = now;
    save.achievements = have;
    session.push(...fresh);
    for (const a of fresh) for (const fn of listeners) fn(a);
    return fresh;
}

/** dev: unlock / reset everything */
export function debugUnlock(id) {
    const have = save.achievements;
    for (const a of ACHIEVEMENTS) if (!id || a.id === id) have[a.id] = Date.now();
    save.achievements = have;
}
