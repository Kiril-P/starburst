// Difficulty modifiers. The first four come verbatim from v1 (legacy MainMenu.difficulties);
// bulletSpeed and patternDensity are v2 additions so the new patterns also respect difficulty.
import { save } from './Save.js';

export const DIFFICULTY = {
    easy: { enemyHealth: 0.7, enemyDamage: 0.7, enemySpawn: 1.3, maxEnemies: 0.7, bulletSpeed: 0.85, patternDensity: 0.75 },
    normal: { enemyHealth: 1.0, enemyDamage: 1.0, enemySpawn: 1.0, maxEnemies: 1.0, bulletSpeed: 1.0, patternDensity: 1.0 },
    hard: { enemyHealth: 1.3, enemyDamage: 1.3, enemySpawn: 0.8, maxEnemies: 1.3, bulletSpeed: 1.12, patternDensity: 1.25 }
};

/** Modifiers for the difficulty chosen in the menu (falls back to normal). */
export function currentDifficulty() {
    const id = save.difficulty in DIFFICULTY ? save.difficulty : 'normal';
    return { id, ...DIFFICULTY[id] };
}
