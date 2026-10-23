// STUB (owner: menu). Real implementation replaces this file.
import Phaser from 'phaser';
import { W, H } from '../config.js';
import { Button } from '../ui/widgets.js';
import { pxText } from '../ui/text.js';

export default class MainMenu extends Phaser.Scene {
    constructor() { super('MainMenu'); }
    create() {
        pxText(this, W / 2, 80, 'STARBURST', { size: 24, font: 'TITLE', origin: [0.5, 0.5] });
        new Button(this, W / 2, 180, 'START', () => this.scene.start('Game'));
    }
}
