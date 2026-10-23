// The two static read-outs on the title screen: BEST RUN (bottom-left) and the selected ship's stats (under the ships).
import { DEPTH } from '../../config.js';
import { COLORS, PALETTE } from '../../art/palette.js';
import { createPanel } from '../../ui/widgets.js';
import { text, setTextKeep, fmt } from './helpers.js';
import { STAT_LABELS } from './data.js';

/** Best run panel. (x, y) = top-left corner. */
export function createBestRun(scene, x, y, w, h, save) {
    const p = createPanel(scene, x + w / 2, y + h / 2, w, h).setDepth(DEPTH.HUD);
    const left = -Math.floor(w / 2) + 8, top = -Math.floor(h / 2) + 7;
    const icon = scene.add.image(left, top, 'icon_star').setOrigin(0, 0);
    const head = text(scene, left + icon.width + 5, top + Math.floor(icon.height / 2), 'BEST RUN', { font: 'TITLE', size: 8, origin: [0, 0.5], color: PALETTE.C });
    p.add([icon, head]);
    const rowY = top + icon.height + 8;
    const sep = scene.add.rectangle(left, rowY - 4, w - 16, 1, COLORS.n).setOrigin(0, 0);
    p.add(sep);
    const best = save.highScore > 0;
    const rows = [['SCORE', best ? fmt(save.highScore) : '---'], ['WAVE', best ? String(save.highWave) : '---']];
    const valX = left + 44;
    rows.forEach(([k, v], i) => {
        const ry = rowY + i * 14;
        p.add(text(scene, left, ry + 3, k, { size: 8, color: PALETTE[4] }));
        p.add(text(scene, valX, ry, v, { font: 'TITLE', size: 8, color: best ? PALETTE.w : PALETTE[3] }).setY(ry + 2));
    });
    // thin divider between label and value columns
    p.add(scene.add.rectangle(valX - 6, rowY, 1, 24, COLORS[2]).setOrigin(0, 0));
    return p;
}

/** Ship read-out: name, one-line description and 4 segmented stat bars. (cx, y) = top centre. Returns { show(info) }. */
export function createShipInfo(scene, cx, y, w) {
    const c = scene.add.container(0, 0).setDepth(DEPTH.HUD);
    const left = Math.round(cx - w / 2);
    // backing panel so the read-out stays legible over bright nebula
    c.add(createPanel(scene, cx, y + 16, w + 20, 46));
    const name = text(scene, left, y, '', { font: 'TITLE', size: 8, color: PALETTE.w });
    const desc = text(scene, left + w, y, '', { size: 8, origin: [1, 0], color: PALETTE[4] });
    c.add([name, desc]);
    const bars = scene.add.graphics();
    c.add(bars);
    const colW = Math.floor(w / 4);
    const SEG = 10, SEG_W = 6, SEG_GAP = 1;
    const labels = STAT_LABELS.map(([, label], i) => {
        const t = text(scene, left + i * colW, y + 14, label, { size: 8, color: PALETTE[5] });
        c.add(t);
        return t;
    });
    const show = (info) => {
        setTextKeep(name, info.name);
        name.setColor(info.accentCss);
        setTextKeep(desc, info.desc);
        bars.clear();
        STAT_LABELS.forEach(([key], i) => {
            const bx = left + i * colW, by = labels[i].y + labels[i].height + 2;
            const filled = Math.round(info.stats[key] * SEG);
            for (let sgi = 0; sgi < SEG; sgi++) {
                const on = sgi < filled;
                bars.fillStyle(on ? info.accent : COLORS[1]).fillRect(bx + sgi * (SEG_W + SEG_GAP), by, SEG_W, 4);
                // top highlight row on lit segments: reads as a lit LED, not a flat block
                if (on) bars.fillStyle(sgi === filled - 1 ? COLORS.w : info.accentDark).fillRect(bx + sgi * (SEG_W + SEG_GAP), by + 3, SEG_W, 1);
            }
        });
    };
    return { container: c, show };
}
