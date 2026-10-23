// STUB (owner: ui). Real implementation replaces this file.
// Receives data: { score, wave, stats: { graze, maxCombo, kills } }
import Phaser from 'phaser';
import { W, H } from '../config.js';
import { Button } from '../ui/widgets.js';
import { pxText } from '../ui/text.js';
import { save } from '../systems/Save.js';

export default class GameOver extends Phaser.Scene {
    constructor() { super('GameOver'); }
    create(data) {
        const r = save.recordRun(data.score, data.wave);
        pxText(this, W / 2, 60, `GAME OVER  ${data.score}`, { origin: [0.5, 0.5] });
        new Button(this, W / 2 - 60, 200, 'RETRY', () => this.scene.start('Game'));
        new Button(this, W / 2 + 60, 200, 'MENU', () => this.scene.start('MainMenu'));
    }
}
