// Aggregates every sprite module. Each module default-exports an array of definitions (see bake.js).
import ships from './sprites/ships.js';
import projectiles from './sprites/projectiles.js';
import enemies from './sprites/enemies.js';
import fx from './sprites/fx.js';
import icons from './sprites/icons.js';
import ui from './sprites/ui.js';
import bosses from './sprites/bosses.js';
import access from './sprites/access.js';
import { contrastDefs } from './highContrast.js';

export const SPRITE_MODULES = { ships, projectiles, enemies, fx, icons, ui, bosses };
// accessibility: reticle + generated high-contrast / colour-blind enemy bullets (art/highContrast.js)
SPRITE_MODULES.access = access;
SPRITE_MODULES.contrast = contrastDefs();
export const ALL_SPRITES = Object.values(SPRITE_MODULES).flat();
