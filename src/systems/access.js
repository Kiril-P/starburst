// Per-run accessibility options, applied once by Game.create via applyRunAccess(scene):
//   ASSIST MODE (Settings): slower enemy bullets, +50% hull, wider graze window. Clearly labelled on the HUD for the whole
//   run, and save.leaderboardEligible is false while it is on so a future leaderboard never receives assisted scores.
// Mouse aim lives in systems/mouseAim.js (created by Player) and bullet contrast in art/highContrast.js (BulletPool).
import { W, DEPTH } from '../config.js';
import { PLAYER } from './tuning.js';
import { save } from './Save.js';
import { pxText } from '../ui/text.js';
import { PALETTE } from '../art/palette.js';

export const ASSIST = { bulletSpeed: 0.75, hp: 1.5, graze: 1.8 };
const BASE_GRAZE = PLAYER.grazeRadius;

export function applyRunAccess(scene) {
    const on = save.assist;
    // collisions.js reads PLAYER.grazeRadius directly; reset it every run so turning assist off restores the default
    PLAYER.grazeRadius = on ? Math.round(BASE_GRAZE * ASSIST.graze) : BASE_GRAZE;
    scene.assist = on;
    if (!on) return;
    // the difficulty object is this run's private copy (currentDifficulty() builds a new one), shared with WaveManager
    scene.diff.bulletSpeed *= ASSIST.bulletSpeed;
    const p = scene.player;
    p.maxHp = p.hp = Math.round(p.maxHp * ASSIST.hp);
    // lime = help/heal; top centre sits between the wave and score panels and clear of the touch pause button
    const label = pxText(scene, Math.round(W / 2), 26, 'ASSIST MODE', { size: 8, origin: [0, 0], color: PALETTE.L });
    label.setPosition(Math.round(W / 2 - label.width / 2), 26).setDepth(DEPTH.HUD).setAlpha(0.8);
}
