// Scene registry. Add new scenes here.
import Boot from './Boot.js';
import Preload from './Preload.js';
import MainMenu from './MainMenu.js';
import Game from './Game.js';
import GameOver from './GameOver.js';
import { MENU_SCENES } from './menu/index.js';

export const SCENES = [Boot, Preload, MainMenu, Game, GameOver, ...MENU_SCENES];
