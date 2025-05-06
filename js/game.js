import Boot from './scenes/Boot.js';
import Preload from './scenes/Preload.js';
import MainMenu from './scenes/MainMenu.js';
import Game from './scenes/Game.js';
import GameOver from './scenes/GameOver.js';

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#000',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [Boot, Preload, MainMenu, Game, GameOver]
};

// Create the game instance
const game = new Phaser.Game(config); 