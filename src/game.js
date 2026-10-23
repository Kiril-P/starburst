import Phaser from 'phaser';
import '@fontsource/press-start-2p';
import '@fontsource/silkscreen';
import { W, H } from './config.js';
import { SCENES } from './scenes/index.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#070b1a',
    pixelArt: true,       // nearest-neighbour everywhere, no antialiasing
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: SCENES
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
    window.__game = game; // debugging handle, dev only
}
