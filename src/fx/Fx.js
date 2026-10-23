// STUB (owner: fx-bg). Real implementation replaces this file; keep the method signatures.
// All coordinates are native 640x360 world pixels. Colours are 0xRRGGBB numbers unless stated.
export default class Fx {
    constructor(scene) { this.scene = scene; }
    /** pixel-art explosion + glow + debris. size: 's' | 'm' | 'l'. palette: 'fire' | 'cyan' | 'magenta' | 'lime' */
    explosion(x, y, size = 'm', palette = 'fire') {}
    /** tiny impact burst of square pixels */
    hitSpark(x, y, color = 0x39e7ff) {}
    /** expanding 1px ring (uses the `shockwave` anim). scale 1 = 96px diameter */
    shockwave(x, y, color = 0xffffff, scale = 1) {}
    debris(x, y, count = 6, tint = 0x9aaad0) {}
    /** floating text that rises and fades. color is a CSS string */
    floatText(x, y, text, color = '#f4faff', size = 8) {}
    /** camera shake in whole pixels; honours save.screenShake. strength 1 = small hit, 3 = big boom */
    shake(strength = 1, ms = 120) {}
    /** freeze-frame feel: briefly pause physics+tweens+time for ms */
    hitStop(ms = 40) {}
    /** full-screen additive flash; honours save.flashEffects */
    flash(color = 0xffffff, alpha = 0.3, ms = 80) {}
    /** spark when the player grazes a bullet */
    grazeSpark(x, y) {}
    muzzle(x, y) {}
    /** global time scale dip (0.4 = 40% speed) for dramatic moments */
    slowmo(scale = 0.4, ms = 300) {}
    update(dt) {}
    destroy() {}
}
