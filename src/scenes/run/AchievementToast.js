// "ACHIEVEMENT UNLOCKED" card that slides in at the top-right, one at a time from a queue. Scene-agnostic (Game,
// Hangar, GameOver) and animated on the game clock (ui/anim.js) so hit-stop / slow-mo / pause don't freeze it
// halfway off-screen.
import { W, DEPTH } from '../../config.js';
import { PALETTE } from '../../art/palette.js';
import { nine, uiTween, uiDelay } from '../../ui/widgets.js';
import { pxText } from '../../ui/text.js';
import { sfx } from '../../systems/sfx.js';

const CW = 176, CH = 30, MARGIN = 6;
const HOLD_MS = 2600;

export default class AchievementToast {
    /** opts { y = 40, depth } */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.y = opts.y ?? 40;
        this.queue = [];
        this.busy = false;
        this.c = scene.add.container(W, this.y).setDepth(opts.depth ?? DEPTH.HUD + 20).setVisible(false);
        this.bg = nine(scene, 0, 0, 'ui_panel_active', CW, CH).setAlpha(0.94);
        this.icon = scene.add.image(7, 7, 'ach_locked').setOrigin(0, 0);
        this.head = pxText(scene, 29, 5, 'ACHIEVEMENT UNLOCKED', { color: PALETTE.A });
        this.title = pxText(scene, 29, 16, '', { font: 'TITLE', color: PALETTE.w });
        this.c.add([this.bg, this.icon, this.head, this.title]);
        this.anims = [];
        scene.events.once('shutdown', () => this.destroy());
    }

    /** a: achievement { id, title } */
    show(a) {
        this.queue.push(a);
        if (!this.busy) this.next();
    }

    next() {
        const a = this.queue.shift();
        if (!a || !this.c.scene) { this.busy = false; return; }
        this.busy = true;
        this.icon.setTexture(this.scene.textures.exists(`ach_${a.id}`) ? `ach_${a.id}` : 'ach_locked');
        this.title.setText(a.title);
        const x0 = W + 2, x1 = W - CW - MARGIN;
        this.c.setVisible(true).setX(x0);
        sfx(this.scene, 'level-up', { vol: 0.5 });
        this.anims.push(uiTween(this.scene, {
            ms: 220, steps: 8, onUpdate: (v) => this.c.setX(Math.round(x0 + (x1 - x0) * v)),
            onComplete: () => this.anims.push(uiDelay(this.scene, HOLD_MS, () => this.anims.push(uiTween(this.scene, {
                ms: 180, steps: 6, ease: 'in', onUpdate: (v) => this.c.setX(Math.round(x1 + (x0 - x1) * v)),
                onComplete: () => { this.c.setVisible(false); this.next(); }
            }))))
        }));
        // blink the header twice so the eye catches it during a busy fight
        let n = 0;
        this.anims.push(uiTween(this.scene, { ms: 600, steps: 6, ease: 'linear', onUpdate: () => this.head.setColor(n++ % 2 ? PALETTE.z : PALETTE.A) }));
    }

    destroy() {
        this.anims.forEach((a) => a.stop());
        this.anims = [];
        this.queue = [];
        if (this.c.scene) this.c.destroy();
    }
}
