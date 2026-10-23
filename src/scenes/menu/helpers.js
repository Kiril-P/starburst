// Small pixel-perfect helpers shared by the menu modules.
import { pxText } from '../../ui/text.js';
import { PALETTE, COLORS } from '../../art/palette.js';
import { Button } from '../../ui/widgets.js';

/**
 * pxText anchored by (ax, ay) but always placed on whole pixels: origin-0.5 on an odd-width text would land on a half pixel,
 * so we compute the top-left corner ourselves.
 */
export function text(scene, x, y, str, o = {}) {
    const [ax, ay] = o.origin ?? [0, 0];
    const t = pxText(scene, 0, 0, str, { ...o, origin: [0, 0] });
    t.anchorX = ax; t.anchorY = ay;
    placeText(t, x, y);
    return t;
}

/** Re-place a text made by text() after setText changed its size. */
export function placeText(t, x, y) {
    t.setPosition(Math.round(x - t.width * (t.anchorX ?? 0)), Math.round(y - t.height * (t.anchorY ?? 0)));
    t.ax = x; t.ay = y;
    return t;
}

export function setTextKeep(t, str) {
    t.setText(str);
    return placeText(t, t.ax, t.ay);
}

export const fmt = (n) => Math.floor(n).toLocaleString('en-US');

/** Image placed so its top-left corner is on a whole pixel (sprites are centre-origin by default). */
export function pxImage(scene, x, y, key, frame) {
    const img = frame === undefined ? scene.add.image(0, 0, key) : scene.add.image(0, 0, key, frame);
    img.setOrigin(0, 0);
    img.setPosition(Math.round(x - img.width / 2), Math.round(y - img.height / 2));
    return img;
}

/**
 * A widgets Button with a LEFT-aligned label, optional right-aligned value text and a chevron, e.g. "DIFFICULTY   NORMAL >".
 * The widget's own (centred) label is left empty; ours goes into the button's lifting face (or the button itself)
 * so it moves with hover/press. setFocused is wrapped so our label/chevron react to focus + hover.
 * Returns the Button with extra .label and .setValue(str, css).
 */
export function navButton(scene, x, y, w, h, label, onClick, { value = '', valueColor = PALETTE.C, chevron = true, double = false, labelColor = PALETTE[5] } = {}) {
    const btn = new Button(scene, x, y, '', onClick, { w, h });
    const face = btn.face ?? btn;
    const left = -(w >> 1) + 10, right = (w >> 1) - 8;
    const lbl = text(scene, left, 0, label, { font: 'TITLE', size: 8, origin: [0, 0.5], color: labelColor });
    face.add(lbl);
    let chev = null, chev2 = null;
    if (chevron) {
        chev = scene.add.image(0, 0, 'ui_arrow_r').setOrigin(0, 0);
        chev.setPosition(right - chev.width, -(chev.height >> 1));
        face.add(chev);
        // hero button (START): ">>" with a dimmer second chevron trailing
        if (double) { chev2 = scene.add.image(chev.x - chev.width + 2, chev.y, 'ui_arrow_r').setOrigin(0, 0); face.add(chev2); }
    }
    const chevX = chev ? chev.x : 0;
    const val = text(scene, chev2 ? chev2.x - 5 : chev ? chev.x - 5 : right, 0, value, { origin: [1, 0.5], color: valueColor, size: 8 });
    face.add(val);
    let hover = false;
    const apply = () => {
        const hot = btn.focused || hover;
        lbl.setColor(hot ? PALETTE.w : labelColor);
        lbl.x = left + (btn.focused ? 2 : 0);
        if (chev) { chev.x = chevX + (hot ? 2 : 0); chev.setTint(hot ? COLORS.b : COLORS[4]); }
        if (chev2) { chev2.x = chevX - chev.width + 2 + (hot ? 1 : 0); chev2.setTint(hot ? COLORS.C : COLORS[3]); }
    };
    const orig = btn.setFocused.bind(btn);
    btn.setFocused = (f) => { orig(f); btn.focused = f; apply(); return btn; };
    btn.on('pointerover', () => { hover = true; apply(); });
    btn.on('pointerout', () => { hover = false; apply(); });
    btn.focused = false;
    apply();
    btn.label = lbl;
    btn.setValue = (str, css) => { setTextKeep(val, str); if (css) val.setColor(css); return btn; };
    return btn;
}

/** Whole-pixel sine bob: returns an integer offset in [-amp, amp]. */
export const bob = (t, periodMs, amp, phase = 0) => Math.round(Math.sin((t / periodMs) * Math.PI * 2 + phase) * amp);
