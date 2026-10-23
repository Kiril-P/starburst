// Scene registry. Add new scenes here.
import Boot from './Boot.js';
import Preload from './Preload.js';
import MainMenu from './MainMenu.js';
import Game from './Game.js';
import GameOver from './GameOver.js';
import { MENU_SCENES } from './menu/index.js';
import SysOverlay from './SysOverlay.js';
import { META_SCENES } from './metaScenes.js';
import Wipe from './Wipe.js';

// SysOverlay must stay last: scenes render in list order and it draws above everything (FPS, touch controls);
// Wipe (scene transitions) sits right under it
export const SCENES = [Boot, Preload, MainMenu, Game, GameOver, ...MENU_SCENES, ...META_SCENES, Wipe, SysOverlay];
