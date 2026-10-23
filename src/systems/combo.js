// Combo multiplier. Kills and grazes add "energy"; every full unit of energy raises the multiplier.
// If nothing happens within the window the multiplier steps down one level (and the window refills),
// so a chain decays gradually instead of vanishing. Taking damage resets it.
import { COMBO } from './tuning.js';

export default class Combo {
    constructor() { this.reset(); this.max = 1; }

    reset() {
        this.mult = 1;
        this.energy = 0;
        this.timer = 0;
    }

    get window() { return Math.max(COMBO.minWindowMs, COMBO.windowMs - (this.mult - 1) * COMBO.windowShrinkPerLevel); }

    /** 0..1 time left before the multiplier drops (0 when there is no chain) */
    get t01() { return this.mult > 1 || this.energy > 0 ? this.timer / this.window : 0; }

    /** Returns true when the multiplier went up. */
    add(energy) {
        this.energy += energy;
        this.timer = this.window;
        let up = false;
        while (this.energy >= 1 && this.mult < COMBO.maxMultiplier) {
            this.energy -= 1;
            this.mult++;
            up = true;
        }
        if (this.mult >= COMBO.maxMultiplier) this.energy = Math.min(this.energy, 0.99);
        if (this.mult > this.max) this.max = this.mult;
        return up;
    }

    kill(value) { return this.add(COMBO.killEnergy * (value / 100)); }
    graze() { return this.add(COMBO.grazeEnergy); }

    update(dt) {
        if (this.timer <= 0) return;
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.mult > 1) { this.mult--; this.energy = 0.5; this.timer = this.window; }
        else { this.energy = 0; this.timer = 0; }
    }
}
