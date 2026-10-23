// Graphics quality. save.quality is 'auto' | 'high' | 'low'.
//   HIGH: bloom post-FX (if the GLOW setting is on) and full particle density.
//   LOW:  no bloom, half the particles, smaller particle cap.
//   AUTO: HIGH until the Game scene measures poor frame times, then LOW (remembered in save.autoLow, so a slow
//         device starts LOW next time; picking AUTO again in Settings re-measures).
import { save } from './Save.js';

const WARMUP_MS = 3000;    // ignore loading hitches at the start of a run
const WINDOW = 90;         // frames per sample window
const SLOW_MS = 22;        // window average above this (~45 fps) counts as slow...
const SLOW_WINDOWS = 2;    // ...this many windows in a row drops AUTO to LOW

export const quality = {
    get effective() {
        const q = save.quality;
        return q === 'auto' ? (save.autoLow ? 'low' : 'high') : q;
    },
    get low() { return this.effective === 'low'; },
    get bloom() { return save.glow && !this.low; },
    get particleScale() { return this.low ? 0.5 : 1; },
    /** label for the settings row, e.g. 'AUTO (LOW)' */
    get label() {
        const q = save.quality;
        return q === 'auto' ? `AUTO (${this.effective.toUpperCase()})` : q.toUpperCase();
    }
};

/** Watches real frame times during play and flips AUTO to LOW once. onDrop() is called when that happens. */
export class AutoQuality {
    constructor(onDrop) {
        this.onDrop = onDrop;
        this.elapsed = 0; this.sum = 0; this.n = 0; this.slow = 0;
        this.done = save.quality !== 'auto' || save.autoLow;
    }

    sample(rawDelta) {
        if (this.done || document.hidden) return;
        this.elapsed += rawDelta;
        if (this.elapsed < WARMUP_MS || rawDelta > 250) return;   // >250ms = tab switch / breakpoint, not slowness
        this.sum += rawDelta;
        if (++this.n < WINDOW) return;
        this.slow = this.sum / this.n > SLOW_MS ? this.slow + 1 : 0;
        this.sum = 0; this.n = 0;
        if (this.slow >= SLOW_WINDOWS) {
            this.done = true;
            save.autoLow = true;
            this.onDrop && this.onDrop();
        }
    }
}
