// Scene transitions. An always-running scene drawn above the others (just below SysOverlay) that plays one
// shared "pixel wipe": dark 8px bands sweep in from the left in a stepped diagonal with a cyan leading edge,
// the target scene is started while the screen is covered, then the bands sweep off to the right.
// Use it through wipeTo() (scenes/cine/wipe.js) so every scene change in the game looks the same.
import Phaser from 'phaser';
import { W, H } from '../config.js';
import { COLORS } from '../art/palette.js';
import { installMetaDebug } from '../systems/metaDebug.js';

const BAND = 8;
const ROWS = Math.ceil(H / BAND);
const SKEW = 0.45;          // how far (in progress units) the last band lags the first: the diagonal
const COVER_MS = 260, REVEAL_MS = 300, HOLD_MS = 50;

export default class Wipe extends Phaser.Scene {
    constructor() { super({ key: 'Wipe', active: true }); }

    create() {
        this.g = this.add.graphics();
        this.job = null;
        installMetaDebug(this.game);   // dev: window.__meta (Wipe is always running, so install it once here)
    }

    get busy() { return !!this.job; }

    /**
     * Cover the screen, run `swap()` (which starts the next scene), then reveal it.
     * opts { edge: 0xRRGGBB leading-edge colour (cyan by default; red for death), onCovered }
     */
    play(swap, opts = {}) {
        if (this.job) return false;
        this.scene.bringToTop();
        if (this.scene.get('SysOverlay')) this.scene.moveBelow('SysOverlay');   // FPS / touch stay on top
        this.job = { phase: 'cover', t: 0, swap, edge: opts.edge ?? COLORS.C };
        return true;
    }

    update(time, delta) {
        const j = this.job;
        if (!j) return;
        j.t += Math.min(delta, 50);
        if (j.phase === 'cover') {
            this.draw(Math.min(1, j.t / COVER_MS), false, j.edge);
            if (j.t >= COVER_MS) {
                j.phase = 'hold'; j.t = 0;
                try { j.swap(); } catch (e) { console.error(e); }
            }
        } else if (j.phase === 'hold') {
            // give the new scene a couple of frames to build before revealing it
            this.draw(1, false, j.edge);
            if (j.t >= HOLD_MS) { j.phase = 'reveal'; j.t = 0; }
        } else {
            this.draw(Math.min(1, j.t / REVEAL_MS), true, j.edge);
            if (j.t >= REVEAL_MS) { this.g.clear(); this.job = null; }
        }
    }

    /** p 0..1. Cover: bands grow from the left. Reveal: bands shrink toward the right (the wipe keeps moving). */
    draw(p, reveal, edge) {
        const g = this.g.clear();
        for (let r = 0; r < ROWS; r++) {
            // stepped diagonal: lower bands lag; quantised to 8px columns so the edge stays chunky
            const lag = (r / (ROWS - 1)) * SKEW;
            const k = Phaser.Math.Clamp((p * (1 + SKEW) - lag), 0, 1);
            const x = Math.round((k * (W + 16)) / 8) * 8;
            const y = r * BAND;
            if (!reveal) {
                if (x <= 0) continue;
                g.fillStyle(COLORS.k, 1).fillRect(0, y, x, BAND);
                if (x < W + 16) this.edge(g, x, y, edge, 1);
            } else {
                if (x >= W + 16) continue;
                g.fillStyle(COLORS.k, 1).fillRect(x, y, W - x, BAND);
                if (x > 0) this.edge(g, x, y, edge, -1);
            }
        }
    }

    /** 2px bright edge + 1px dim trail, on the open side of a band */
    edge(g, x, y, col, dir) {
        if (dir > 0) {
            g.fillStyle(col, 1).fillRect(x, y, 2, BAND);
            g.fillStyle(COLORS.w, 1).fillRect(x + 2, y + 3, 1, 2);
        } else {
            g.fillStyle(col, 1).fillRect(x - 2, y, 2, BAND);
            g.fillStyle(COLORS.n, 1).fillRect(x - 3, y, 1, BAND);
        }
    }
}
