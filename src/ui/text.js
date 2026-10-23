// Pixel text. Fonts are bitmap-style TTFs designed for multiples of 8px: only use sizes 8, 16, 24, 32.
import { FONT } from '../config.js';

/**
 * @param {Phaser.Scene} scene
 * @param {object} o  { size = 8, font = 'UI'|'TITLE', color = '#f4faff', align, origin = [0,0], shadow = '#0a0d1f'|null, spacing }
 */
export function pxText(scene, x, y, str, o = {}) {
    const size = o.size ?? 8;
    const family = o.font === 'TITLE' ? FONT.TITLE : FONT.UI;
    const t = scene.add.text(Math.round(x), Math.round(y), String(str), {
        fontFamily: family,
        fontSize: `${size}px`,
        color: o.color ?? '#f4faff',
        align: o.align ?? 'left',
        letterSpacing: o.spacing ?? 0,
        resolution: 1
    });
    if (o.shadow !== null) t.setShadow(0, 1, o.shadow ?? '#0a0d1f', 0, false, true);
    const [ox, oy] = o.origin ?? [0, 0];
    t.setOrigin(ox, oy);
    return t;
}
