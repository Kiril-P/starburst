// STUB (owner: fx-bg). Real implementation replaces this file; keep the method signatures.
import { W, H, DEPTH } from '../config.js';

export default class Background {
    /** @param opts { biome: 0..N } */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.rect = scene.add.rectangle(0, 0, W, H, 0x070b1a).setOrigin(0).setDepth(DEPTH.BG);
    }
    /** @param dt ms since last frame, @param intensity 1 = calm drift, >1 = faster streaks (boss/dash) */
    update(dt, intensity = 1) {}
    /** crossfade to another palette/biome (0..N) */
    setBiome(i, fadeMs = 1500) {}
    /** brief brightness pulse for beats / big hits, strength 0..1 */
    pulse(strength = 0.5) {}
    destroy() { this.rect.destroy(); }
}
