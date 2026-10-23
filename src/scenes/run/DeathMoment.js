// The death beat between the ship blowing up and the GameOver wipe: time sinks to a crawl, cinematic letterbox
// bars close in, a red targeting ring collapses onto the wreck and "SIGNAL LOST" types out. Game.startDeath()
// already does the explosion + a short slow-mo; this deepens and holds it. Runs on the game clock (uiTween /
// onUiStep) because the scene clock is the thing being slowed.
import { W, H, DEPTH } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { onUiStep, uiTween } from '../../ui/widgets.js';
import { pxText, centerText } from '../../ui/text.js';

const BAR = 26;
const MSG = 'SIGNAL LOST';

export default class DeathMoment {
    constructor(game) {
        this.g = game;
        const p = game.player;
        this.x = Math.round(p.x); this.y = Math.round(p.y);
        const d = DEPTH.OVERLAY - 5;
        this.bars = game.add.graphics().setDepth(d);
        this.ring = game.add.graphics().setDepth(d);
        this.text = pxText(game, 0, 0, '', { font: 'TITLE', size: 8, color: PALETTE.R }).setDepth(d + 1);
        this.sub = centerText(pxText(game, 0, 0, `HULL BREACHED  //  WAVE ${game.waves.wave}`, { color: PALETTE[4], spacing: 1 }), W / 2, H - 9).setDepth(d + 1).setAlpha(0);
        this.t = 0;
        // deeper, longer crawl than the default death slow-mo (TimeControl keeps the lowest scale / latest end)
        game.fx.slowmo(0.12, 1700);
        game.hud?.setVisible?.(false);
        this.offStep = onUiStep(game, (dt) => this.step(dt));
        this.subTween = uiTween(game, { delay: 700, ms: 300, steps: 3, onUpdate: (v) => this.sub.setAlpha(v) });
    }

    step(dt) {
        this.t += dt;
        const t = this.t;
        // letterbox: stepped 2px slide over 360ms
        const b = Math.min(BAR, Math.round(((t / 360) * BAR) / 2) * 2);
        this.bars.clear().fillStyle(COLORS.k, 1).fillRect(0, 0, W, b).fillRect(0, H - b, W, b);
        if (b >= BAR) this.bars.fillStyle(COLORS.r, 1).fillRect(0, BAR - 1, W, 1).fillRect(0, H - BAR, W, 1);
        // collapsing ring of 4 corner brackets, then a steady lock-on blink
        const g = this.ring.clear();
        const k = Math.min(1, t / 900);
        const r = Math.round(70 - 56 * (1 - (1 - k) ** 3));
        if (k < 1 || Math.floor(t / 160) % 2 === 0) {
            g.fillStyle(k < 1 ? COLORS.R : COLORS.r, 1);
            const L = 6;
            for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
                const cx = this.x + sx * r, cy = this.y + sy * r;
                g.fillRect(sx < 0 ? cx : cx - L + 1, cy, L, 1);
                g.fillRect(cx, sy < 0 ? cy : cy - L + 1, 1, L);
            }
            g.fillRect(this.x - 1, this.y - r - 3, 3, 1).fillRect(this.x - 1, this.y + r + 3, 3, 1);
        }
        // typewriter title in the top bar
        const n = Math.max(0, Math.min(MSG.length, Math.floor((t - 300) / 45)));
        if (n !== this.n) {
            this.n = n;
            this.text.setText(MSG.slice(0, n));
            this.text.setPosition(Math.round(W / 2 - (MSG.length * 8) / 2), Math.round((BAR - 8) / 2));
        }
    }

    destroy() {
        this.offStep();
        this.subTween.stop();
        for (const o of [this.bars, this.ring, this.text, this.sub]) if (o.scene) o.destroy();
    }
}
