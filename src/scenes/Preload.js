import Phaser from 'phaser';
import { W, H } from '../config.js';
import { ALL_SPRITES } from '../art/index.js';
import { bakeAll } from '../art/bake.js';
import { bakePlaceholders } from '../art/placeholder.js';
import { pxText } from '../ui/text.js';
import { installAudio } from '../systems/sfx.js';
import { save } from '../systems/Save.js';

export default class Preload extends Phaser.Scene {
    constructor() { super('Preload'); }

    preload() {
        const label = pxText(this, W / 2, H / 2 - 14, 'LOADING', { size: 8, origin: [0.5, 0.5] });
        const frame = this.add.rectangle(W / 2, H / 2 + 4, 202, 10).setStrokeStyle(1, 0x39e7ff);
        const fill = this.add.rectangle(W / 2 - 99, H / 2 + 4, 1, 6, 0x39e7ff).setOrigin(0, 0.5);
        this.load.on('progress', (v) => { fill.width = Math.max(1, Math.round(198 * v)); });
        this.load.on('complete', () => { label.destroy(); frame.destroy(); fill.destroy(); });
    }

    async create() {
        // make sure pixel fonts are really loaded before any text is drawn
        try { await Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('8px "Silkscreen"')]); } catch (e) { /* ignore */ }
        bakeAll(this, ALL_SPRITES);
        bakePlaceholders(this);
        installAudio(this.game);   // generated sfx + music (no audio files), limiter, music bus, reactivity
        const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('scene') : null;
        this.scene.launch('SysOverlay');   // FPS counter, gamepad bridge, touch controls, auto-pause
        this.scene.start(dev || (save.seenIntro ? 'MainMenu' : 'Intro'));   // story crawl on first launch only
    }
}
