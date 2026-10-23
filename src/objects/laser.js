// The sniper's warning laser: a 1px amber line drawn with single-pixel rects (integer positions, no AA, no alpha).
// Tracking = sparse dots crawling toward the target, blinking between two amber steps. Locked = dense dots that
// strobe amber/pale-yellow fast: "it is about to fire down exactly this line". Amber = warning (STYLE.md).
// Each sniper lazily owns one Graphics (there are only ever a few snipers); Enemy.despawn clears it.
import { W, H, DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';

const LONG = Math.hypot(W, H);

export function drawLaser(e, x, y, a, locked, t) {
    if (!e.gfx) e.gfx = e.scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
    const g = e.gfx.clear();
    const col = locked ? ((((t / 45) | 0) & 1) ? COLORS.z : COLORS.A) : ((((t / 90) | 0) & 1) ? COLORS.A : COLORS.a);
    g.fillStyle(col, 1);
    const step = locked ? 2 : 4, c = Math.cos(a), s = Math.sin(a);
    for (let d = 4 + ((t / 30) % step); d < LONG; d += step) {
        const px = Math.round(x + c * d), py = Math.round(y + s * d);
        if (px < -1 || px > W || py < -1 || py > H) break;
        g.fillRect(px, py, 1, 1);
    }
    // a small lock reticle where the line leaves the sniper, so the source is obvious too
    if (locked) { g.fillRect(Math.round(x) - 2, Math.round(y) + 2, 5, 1); }
}
