import Phaser from 'phaser';
import { W, H } from '../config.js';
import { ALL_SPRITES } from '../art/index.js';
import { bakeAll } from '../art/bake.js';
import { bakePlaceholders } from '../art/placeholder.js';
import { pxText } from '../ui/text.js';

// Every audio key used by the game. Files live in public/assets/audio.
const MUSIC = { 'title-music': 'title.mp3', 'main-music': 'main.mp3' };
const SFX = {
    'button-sound': 'button.mp3',
    'player-shoot': 'shoot1.mp3',
    'enemy-shoot': 'shoot2.mp3',
    'enemy-death': 'enemydeath.mp3',
    'player-death': 'playerdeath.mp3',
    'player-damaged': 'playerdamaged.mp3',
    'thruster-hum': 'thrusterhum.mp3',
    'wave-complete': 'wavecomplete.mp3',
    'dash': 'dash1.mp3',
    'dash-alt': 'dash2.mp3',
    'forcefield': 'forcefield.mp3',
    'phase-shift': 'phase_shift.mp3'
};

export default class Preload extends Phaser.Scene {
    constructor() { super('Preload'); }

    preload() {
        const label = pxText(this, W / 2, H / 2 - 14, 'LOADING', { size: 8, origin: [0.5, 0.5] });
        const frame = this.add.rectangle(W / 2, H / 2 + 4, 202, 10).setStrokeStyle(1, 0x39e7ff);
        const fill = this.add.rectangle(W / 2 - 99, H / 2 + 4, 1, 6, 0x39e7ff).setOrigin(0, 0.5);
        this.load.on('progress', (v) => { fill.width = Math.max(1, Math.round(198 * v)); });
        this.load.on('complete', () => { label.destroy(); frame.destroy(); fill.destroy(); });
        for (const [k, f] of Object.entries(MUSIC)) this.load.audio(k, `assets/audio/${f}`);
        for (const [k, f] of Object.entries(SFX)) this.load.audio(k, `assets/audio/sfx/${f}`);
    }

    async create() {
        // make sure pixel fonts are really loaded before any text is drawn
        try { await Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('8px "Silkscreen"')]); } catch (e) { /* ignore */ }
        bakeAll(this, ALL_SPRITES);
        bakePlaceholders(this);
        const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('scene') : null;
        this.scene.start(dev || 'MainMenu');
    }
}
