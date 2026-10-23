// GameOver "BUILD" panel: the run's weapons as their upgrade-card emblems + level, right of the stats panel.
// Kept out of GameOver.js so that scene only needs one call: addBuildSummary(scene, data.build).
// build: [{ id, title, icon, lv, max, kind: 'primary'|'secondary'|'synergy' }] (Arsenal.summary()).
import { DEPTH } from '../config.js';
import { COLORS } from '../art/palette.js';
import { pxText, centerText } from './text.js';
import { TEXT, nine, uiTween } from './widgets.js';

const X = 456, Y = 100, PW = 172, COLS = 4, CELL = 40, ROW_H = 48;

export function addBuildSummary(scene, build, delay = 700) {
    if (!build || !build.length) return null;
    const items = build.slice(0, 8);
    const rows = Math.ceil(items.length / COLS);
    const ph = 22 + rows * ROW_H;
    const c = scene.add.container(0, 0).setDepth(DEPTH.OVERLAY).setAlpha(0);
    c.add(nine(scene, X, Y, 'ui_panel', PW, ph).setAlpha(0.92));
    c.add(pxText(scene, X + 10, Y + 7, 'BUILD', { color: TEXT.dim, spacing: 1 }));
    c.add(scene.add.rectangle(X + 10, Y + 18, PW - 20, 1, COLORS.n).setOrigin(0, 0));
    items.forEach((b, i) => {
        const cx = X + 10 + (i % COLS) * CELL + 18, y = Y + 24 + Math.floor(i / COLS) * ROW_H;
        c.add(scene.add.image(cx - 16, y, b.icon).setOrigin(0, 0));
        const label = b.kind === 'synergy' ? 'SYN' : b.lv >= b.max ? 'MAX' : `LV${b.lv}`;
        const col = b.kind === 'synergy' ? TEXT.amber : b.kind === 'primary' ? TEXT.cyanHi : TEXT.light;
        c.add(centerText(pxText(scene, 0, 0, label, { color: col }), cx, y + 39));
    });
    uiTween(scene, { delay, ms: 200, steps: 4, onUpdate: (v) => c.setAlpha(v) });
    return c;
}
