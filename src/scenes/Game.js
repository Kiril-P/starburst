// STUB (owner: gameplay). Real implementation replaces this file.
import Phaser from 'phaser';
import { W, H } from '../config.js';
import Background from '../fx/Background.js';
import Fx from '../fx/Fx.js';
import Hud from '../ui/Hud.js';
import { pxText } from '../ui/text.js';

export default class Game extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
        this.bg = new Background(this);
        this.fx = new Fx(this);
        this.hud = new Hud(this);
        pxText(this, W / 2, H / 2, 'GAME (stub)', { origin: [0.5, 0.5] });
        this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameOver', { score: 1234, wave: 3, stats: { graze: 0, maxCombo: 1, kills: 0 } }));
    }
    update(t, dt) { this.bg.update(dt); }
}
