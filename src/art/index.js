// Aggregates every sprite module. Each module default-exports an array of definitions (see bake.js).
import ships from './sprites/ships.js';
import projectiles from './sprites/projectiles.js';
import enemies from './sprites/enemies.js';
import fx from './sprites/fx.js';
import icons from './sprites/icons.js';
import ui from './sprites/ui.js';
import bosses from './sprites/bosses.js';
import bosses2 from './sprites/bosses2.js';

export const SPRITE_MODULES = { ships, projectiles, enemies, fx, icons, ui, bosses, bosses2 };
export const ALL_SPRITES = Object.values(SPRITE_MODULES).flat();
