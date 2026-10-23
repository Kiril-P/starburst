// Synthetic keyboard input for gamepads and touch controls. Every scene already speaks keyboard (MenuNav, overlays,
// pause menu, upgrade cards, the Player's Key objects), so instead of teaching each of them about pads/touch we press
// the matching *keys*: one code path, and all menus work with a controller for free.
// Several sources can hold the same key (A and RT both fire): a key goes down when the first source presses it and up
// when the last one lets go.

const KEYS = {
    left: ['ArrowLeft', 37], right: ['ArrowRight', 39], up: ['ArrowUp', 38], down: ['ArrowDown', 40],
    fire: [' ', 32, 'Space'], dash: ['Shift', 16, 'ShiftLeft'], shield: ['z', 90, 'KeyZ'], phase: ['x', 88, 'KeyX'],
    ok: ['Enter', 13], back: ['Escape', 27]
};

const held = new Map();   // action -> Set of source ids

function dispatch(type, action) {
    const [key, keyCode, code = key] = KEYS[action];
    const e = new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true });
    // older engines ignore keyCode in the init dict; Phaser matches on keyCode
    if (e.keyCode !== keyCode) Object.defineProperty(e, 'keyCode', { get: () => keyCode });
    window.dispatchEvent(e);
}

/** press/release `action` on behalf of `source` (e.g. 'pad0', 'touch-stick') */
export function setVirtualKey(action, source, down) {
    let set = held.get(action);
    if (!set) held.set(action, (set = new Set()));
    const was = set.size > 0;
    if (down) set.add(source); else set.delete(source);
    const now = set.size > 0;
    if (now !== was) dispatch(now ? 'keydown' : 'keyup', action);
}

/** release everything a source holds (pad unplugged, touch controls hidden) */
export function releaseSource(source) {
    for (const [action, set] of held) if (set.has(source)) setVirtualKey(action, source, false);
}

/** one-shot tap: down now, up next tick */
export function tapVirtualKey(action, source) {
    setVirtualKey(action, source, true);
    setTimeout(() => setVirtualKey(action, source, false), 40);
}
