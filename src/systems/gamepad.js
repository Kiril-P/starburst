// Gamepad support via the standard mapping, polled each frame and turned into virtual key presses (virtualKeys.js).
//   D-pad / left stick: arrows      A, RT: fire / confirm (SPACE)      B, START, BACK: ESC (back / pause)
//   LB, RB, LT: dash (SHIFT)         X: forcefield (Z)                  Y: phase shift (X)
import { setVirtualKey, releaseSource } from './virtualKeys.js';

const DEAD = 0.4;   // stick dead zone; digital output keeps menus and the ship on the same code path
const BUTTONS = [
    [0, 'fire'], [7, 'fire'], [1, 'back'], [9, 'back'], [8, 'back'],
    [4, 'dash'], [5, 'dash'], [6, 'dash'], [2, 'shield'], [3, 'phase'],
    [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']
];

export default class GamepadBridge {
    constructor() {
        this.known = new Set();
        this.want = { up: false, down: false, left: false, right: false, fire: false, back: false, dash: false, shield: false, phase: false };
    }

    poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const seen = new Set();
        for (const pad of pads) {
            if (!pad || !pad.connected || pad.mapping !== 'standard') continue;
            const src = `pad${pad.index}`;
            seen.add(src);
            this.known.add(src);
            const b = (i) => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
            // per action: any of its buttons (sources are per pad, so OR them here first)
            const want = this.want;
            for (const a in want) want[a] = false;
            for (const [i, a] of BUTTONS) if (b(i)) want[a] = true;
            const [ax, ay] = pad.axes;
            if (ax < -DEAD) want.left = true; else if (ax > DEAD) want.right = true;
            if (ay < -DEAD) want.up = true; else if (ay > DEAD) want.down = true;
            for (const a in want) setVirtualKey(a, src, want[a]);
        }
        for (const src of this.known) if (!seen.has(src)) { releaseSource(src); this.known.delete(src); }
    }
}
