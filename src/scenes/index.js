// Scene registry. Add new scenes here.
import Boot from './Boot.js';
import Preload from './Preload.js';
import MainMenu from './MainMenu.js';
import Game from './Game.js';
import GameOver from './GameOver.js';
import Victory from './Victory.js';
import { MENU_SCENES } from './menu/index.js';
import SysOverlay from './SysOverlay.js';

// SysOverlay must stay last: scenes render in list order and it draws above everything (FPS, touch controls)
export const SCENES = [Boot, Preload, MainMenu, Game, GameOver, Victory, ...MENU_SCENES, SysOverlay];
