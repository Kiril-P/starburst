// First-launch story crawl (Preload routes here while save.seenIntro is false; dev: ?scene=Intro).
// Lines type out one by one and the whole log drifts upward a pixel at a time; the logo stamps in at the end and
// the scene wipes to the title. Any key / click skips. Marked as seen as soon as it starts, so a reload never
// forces it twice.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { COLORS, PALETTE } from '../art/palette.js';
import Background from '../fx/Background.js';
import { pxText, centerText } from '../ui/text.js';
import { save } from '../systems/Save.js';
import { sfx } from '../systems/sfx.js';
import { wipeTo } from './cine/wipe.js';

// [text, colour, font] ('' = blank line)
const LOG = [
    ['FIELD LOG 2291.07  //  OUTER RIM', PALETTE[4], 'UI'],
    [''],
    ['THE SWARM CAME OUT OF THE DARK BETWEEN THE STARS.', PALETTE[6], 'UI'],
    ['IN ONE NIGHT THE MAGENTA TIDE TOOK EVERY COLONY.', PALETTE[6], 'UI'],
    ['ONE CARRIER ESCAPED. ONE WING STILL FLIES.', PALETTE[6], 'UI'],
    [''],
    ['YOU ARE THE LAST PILOT OF STARBURST WING.', PALETTE.b, 'UI'],
    ['BREAK THEIR LINES. OUTLAST THE STORM.', PALETTE.b, 'UI'],
    [''],
    ['BRING THE LIGHT HOME.', PALETTE.A, 'TITLE']
];
const LINE_H = 14, CHAR_MS = 28, LINE_GAP_MS = 380, DRIFT_MS = 70;

export default class Intro extends Phaser.Scene {
    constructor() { super('Intro'); }

    create() {
        save.seenIntro = true;
        this.done = false;
        this.leaving = false;
        this.events.once('shutdown', () => this.bg.destroy?.());
        this.bg = new Background(this, { biome: 0 });
        const top = Math.round(H / 2 - (LOG.length * LINE_H) / 2) + 10;
        this.crawl = this.add.container(0, 0).setDepth(DEPTH.HUD);
        this.lines = LOG.map(([str, color, font], i) => {
            const t = pxText(this, 0, 0, str ?? '', { color, font, spacing: font === 'TITLE' ? 1 : 0 });
            centerText(t, W / 2, top + i * LINE_H);
            t.full = str ?? '';
            t.setText('');
            this.crawl.add(t);
            return t;
        });
        this.logo = this.add.image(0, 0, 'ui_logo').setOrigin(0, 0).setDepth(DEPTH.HUD).setVisible(false);
        this.logo.setPosition(Math.round((W - this.logo.width) / 2), 24);
        // cursor block that follows the typing
        this.cursor = this.add.rectangle(0, 0, 5, 7, COLORS.C).setOrigin(0, 0);
        this.crawl.add(this.cursor);
        this.skipHint = pxText(this, W - 8, H - 14, 'ANY KEY  SKIP', { color: PALETTE[3], origin: [1, 0] }).setDepth(DEPTH.HUD);
        this.line = 0; this.chars = 0; this.wait = 600; this.t = 0; this.driftT = 0; this.drift = 0;

        this.input.keyboard.on('keydown', () => this.finish());
        this.input.on('pointerdown', () => this.finish());
    }

    update(t, dt) {
        this.bg.update(dt, 1.2);
        this.t += dt;
        this.cursor.setVisible(!this.done && Math.floor(this.t / 260) % 2 === 0);
        // slow upward drift in whole pixels
        if ((this.driftT += dt) >= DRIFT_MS) { this.driftT -= DRIFT_MS; this.drift = Math.min(this.drift + 1, 28); this.crawl.y = -this.drift; }
        if (this.done) return;
        if ((this.wait -= dt) > 0) return;
        const ln = this.lines[this.line];
        if (!ln) { this.end(); return; }
        if (this.chars < ln.full.length) {
            this.chars++;
            ln.setText(ln.full.slice(0, this.chars));
            this.wait = CHAR_MS;
            if (this.chars % 3 === 0 && ln.full[this.chars - 1] !== ' ') sfx(this, 'ui-hover', { vol: 0.15, rate: 1.6 });
            this.cursor.setPosition(Math.round(ln.x + ln.width + 2), ln.y + 1);
        } else {
            this.line++; this.chars = 0;
            this.wait = ln.full ? LINE_GAP_MS : 120;
        }
    }

    /** last line typed: stamp the logo, hold, then go to the title */
    end() {
        this.done = true;
        this.cursor.setVisible(false);
        this.logo.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.logo, alpha: 1, duration: 500 });
        sfx(this, 'wave-complete', { vol: 0.5 });
        this.time.delayedCall(2600, () => this.finish());
    }

    finish() {
        if (this.leaving) return;
        this.leaving = true;
        wipeTo(this, 'MainMenu');
    }
}
