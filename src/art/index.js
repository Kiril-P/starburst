// Aggregates every sprite module. Each module default-exports an array of definitions (see bake.js).
import ships from './sprites/ships.js';
import projectiles from './sprites/projectiles.js';
import enemies from './sprites/enemies.js';
import fx from './sprites/fx.js';
import icons from './sprites/icons.js';
import ui from './sprites/ui.js';
import bosses from './sprites/bosses.js';
import enemies2 from './sprites/enemies2.js';
import enemies3 from './sprites/enemies3.js';
import pickups from './sprites/pickups.js';
import weapons from './sprites/weapons.js';
import bosses2 from './sprites/bosses2.js';
import badges from './sprites/badges.js';
import access from './sprites/access.js';
import { contrastDefs } from './highContrast.js';

export const SPRITE_MODULES = { ships, projectiles, enemies, fx, icons, ui, bosses, bosses2, enemies2, enemies3, pickups, weapons, badges };
// accessibility: reticle + generated high-contrast / colour-blind enemy bullets (art/highContrast.js)
SPRITE_MODULES.access = access;
SPRITE_MODULES.contrast = contrastDefs();
export const ALL_SPRITES = Object.values(SPRITE_MODULES).flat();
