// Pixel-perfect canvas scaling. Phaser's FIT mode picks any fractional scale, and at e.g. 1.25x or 2.13x
// nearest-neighbour makes some art pixels one screen pixel wider than their neighbours (wobbly text, uneven outlines).
// So we prefer the largest *integer* zoom whenever it still fills most of the window, and fall back to FIT only when
// the integer size would waste too much space (small windows, phones). Re-evaluated on resize and fullscreen changes.
import Phaser from 'phaser';
import { W, H } from '../config.js';
import { installRotateHint } from './rotateHint.js';

const MIN_FILL = 0.85;   // integer zoom must reach this fraction of the FIT size, otherwise FIT wins

export function installPixelScaling(game) {
    const sm = game.scale;
    const apply = () => {
        const parent = sm.parent || document.body;
        const pw = parent.clientWidth || window.innerWidth, ph = parent.clientHeight || window.innerHeight;
        const fit = Math.min(pw / W, ph / H);
        const k = Math.floor(fit);
        // touch screens are small and held close: always use the whole screen there
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const integer = !coarse && k >= 1 && k / fit >= MIN_FILL;
        const mode = integer ? Phaser.Scale.NONE : Phaser.Scale.FIT;
        sm.scaleMode = mode;
        // the Size object keeps the boot mode's aspect rule (and NONE mode overwrites its ratio) otherwise
        sm.displaySize.setAspectMode(mode);
        sm.displaySize.setAspectRatio(W / H);
        sm.zoom = integer ? k : 1;
        sm._resetZoom = true;                 // NONE mode only writes the canvas CSS size when this is set
        sm.getParentBounds();
        sm.refresh();
    };
    // run after Phaser's own resize handling so we get the final parent size
    const later = () => setTimeout(apply, 0);
    window.addEventListener('resize', later);
    sm.on(Phaser.Scale.Events.ENTER_FULLSCREEN, later);
    sm.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, later);
    game.events.once(Phaser.Core.Events.READY, apply);
    installRotateHint(game);   // phones held upright: ask to rotate (and pause a running round)
    return apply;
}
