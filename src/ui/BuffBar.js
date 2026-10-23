// Active timed power-ups for the HUD (top-left, under the wave panel): the pickup's own capsule icon + a lime
// drain bar; the icon blinks in the last 2 seconds. Driven by Hud.setBuffs(list) with list items
// { id, key, t01, warn } (same objects every frame). Redraws only when something visible changes.
import { COLORS } from '../art/palette.js';

const MAX = 4, X0 = 4, Y0 = 54, STEP = 17, BAR_W = 13;

export default class BuffBar {
    constructor(scene, root) {
        this.scene = scene;
        this.icons = [];
        for (let i = 0; i < MAX; i++) {
            const im = scene.add.image(X0 + i * STEP, Y0, 'pickup_magnet', 0).setOrigin(0, 0).setVisible(false);
            this.icons.push(im);
        }
        this.g = scene.add.graphics();
        root.add([...this.icons, this.g]);
        this.key = '';
    }

    set(list) {
        const blink = ((this.scene.game.loop.time / 140) | 0) % 2 === 0;
        let key = '';
        for (let i = 0; i < MAX; i++) {
            const b = list[i], im = this.icons[i];
            if (!b) { if (im.visible) im.setVisible(false); continue; }
            if (im.texture.key !== b.key) im.setTexture(b.key, 0);
            im.setVisible(!(b.warn && blink));
            key += b.id + Math.ceil(b.t01 * BAR_W) + ',';
        }
        if (key === this.key) return;
        this.key = key;
        const g = this.g.clear();
        for (let i = 0; i < MAX && list[i]; i++) {
            const x = X0 + i * STEP, y = Y0 + 14, w = Math.ceil(list[i].t01 * BAR_W);
            g.fillStyle(COLORS.k, 1).fillRect(x - 1, y - 1, BAR_W + 2, 4);
            g.fillStyle(COLORS.g, 1).fillRect(x, y, BAR_W, 2);
            g.fillStyle(list[i].warn ? COLORS.A : COLORS.L, 1).fillRect(x, y, w, 2);
        }
    }
}
