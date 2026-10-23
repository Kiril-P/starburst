// Pooled one-shot `pshot_hit` sprites where player shots land. Frames are advanced by simulation time
// (not Phaser anims) so they freeze with pause / hit-stop like everything else in the playfield.
import { DEPTH } from '../config.js';

const FRAME_MS = 40;

export default class Impacts {
    constructor(scene, size = 16) {
        this.items = [];
        this.next = 0;
        const tex = scene.textures.get('pshot_hit');
        this.frames = Math.max(1, tex.frameTotal - 1);   // frameTotal includes __BASE
        for (let i = 0; i < size; i++) {
            const s = scene.add.sprite(0, 0, 'pshot_hit', 0).setDepth(DEPTH.FX).setVisible(false);
            s.t = 0;
            this.items.push(s);
        }
    }

    play(x, y) {
        const s = this.items[this.next++ % this.items.length];
        s.t = 0;
        s.setPosition(Math.round(x), Math.round(y)).setFrame(0).setVisible(true).setFlipX(Math.random() < 0.5);
    }

    update(dt) {
        const n = this.frames;
        for (const s of this.items) {
            if (!s.visible) continue;
            s.t += dt;
            const f = Math.floor(s.t / FRAME_MS);
            if (f >= n) s.setVisible(false);
            else if (n > 1 && s.frame.name !== f) s.setFrame(f);
        }
    }

    destroy() { for (const s of this.items) s.destroy(); }
}
