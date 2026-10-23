// Rebindable gameplay keys. Each action has two slots (primary, alternate) holding KeyboardEvent.code values, so
// bindings follow the physical key position (WASD stays WASD on AZERTY) and persist via Save as plain JSON.
//
// GameInput tracks held keys itself instead of using Phaser Key objects: Phaser keys are fixed to one keyCode, and
// pad / touch input arrives as synthetic key events (systems/virtualKeys.js) that must keep meaning their *action*
// (pad A = fire) whatever the keyboard bindings are. Synthetic events carry `virtualAction` and are mapped by action.
// Menus are not rebindable: they keep arrows / WASD / ENTER / ESC (gamepad and touch rely on those).
import { save } from './Save.js';
import { virtualDown } from './virtualKeys.js';

export const ACTIONS = ['up', 'down', 'left', 'right', 'fire', 'dash', 'shield', 'phase'];
export const ACTION_LABEL = {
    up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
    fire: 'FIRE', dash: 'DASH', shield: 'FORCEFIELD', phase: 'PHASE SHIFT'
};
export const DEFAULT_BINDINGS = {
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    fire: ['Space', null], dash: ['ShiftLeft', 'ShiftRight'], shield: ['KeyZ', null], phase: ['KeyX', null]
};
// ESC pauses and F toggles fullscreen everywhere; binding them would make one press do two things
export const RESERVED = new Set(['Escape', 'KeyF']);

/** Current bindings: saved slots merged over the defaults (so actions added later still get keys). */
export function getBindings() {
    const saved = save.bindings || {};
    const out = {};
    for (const a of ACTIONS) {
        const s = saved[a];
        out[a] = Array.isArray(s) && s.length === 2 ? s.map((c) => (typeof c === 'string' && !RESERVED.has(c) ? c : null)) : [...DEFAULT_BINDINGS[a]];
    }
    return out;
}

export function setBindings(b) { save.bindings = b; }
export function resetBindings() { save.bindings = null; }

/** Bind `code` to action/slot, clearing it from wherever else it was used (a key does one thing). Returns the new map. */
export function bindKey(action, slot, code) {
    const b = getBindings();
    for (const a of ACTIONS) b[a] = b[a].map((c) => (c === code ? null : c));
    b[action][slot] = code;
    setBindings(b);
    return b;
}

export function clearKey(action, slot) {
    const b = getBindings();
    b[action][slot] = null;
    setBindings(b);
    return b;
}

const NAMES = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Space: 'SPACE',
    ShiftLeft: 'SHIFT', ShiftRight: 'R.SHIFT', ControlLeft: 'CTRL', ControlRight: 'R.CTRL', AltLeft: 'ALT', AltRight: 'R.ALT',
    MetaLeft: 'META', MetaRight: 'R.META', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP', CapsLock: 'CAPS',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
    Minus: '-', Equal: '=', Backquote: '`'
};

/** Short display name for a KeyboardEvent.code ('KeyZ' -> 'Z', 'Numpad4' -> 'NUM4'). */
export function keyName(code) {
    if (!code) return '---';
    if (NAMES[code]) return NAMES[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM' + code.slice(6).toUpperCase().slice(0, 3);
    return code.toUpperCase().slice(0, 7);
}

/** HUD label for an action: its primary key, else the alternate. */
export function actionKeyName(action, b = getBindings()) {
    return keyName(b[action][0] || b[action][1]);
}

/** Gameplay input for one run. isDown(action) polls; onPress(action, fn) fires on the press edge (taps shorter than a frame count). */
export class GameInput {
    constructor() {
        this.bindings = getBindings();
        this.byCode = new Map();
        for (const a of ACTIONS) for (const c of this.bindings[a]) if (c) this.byCode.set(c, a);
        this.held = new Set();
        this.handlers = {};
        this.onDown = (e) => {
            if (e.virtualAction) { if (!e.repeat) this.emit(e.virtualAction); return; }
            const a = this.byCode.get(e.code);
            if (!a) return;
            e.preventDefault();   // SPACE / arrows must not scroll an embedding page (itch.io iframe)
            this.held.add(e.code);
            if (!e.repeat) this.emit(a);
        };
        this.onUp = (e) => { if (!e.virtualAction) this.held.delete(e.code); };
        this.onBlur = () => this.held.clear();   // keyups are lost while the window is unfocused
        window.addEventListener('keydown', this.onDown);
        window.addEventListener('keyup', this.onUp);
        window.addEventListener('blur', this.onBlur);
        // Phaser-Key-like views ({ isDown }) so code written against the old keys keeps working
        this.keys = {};
        for (const a of ACTIONS) { const self = this; this.keys[a] = { get isDown() { return self.isDown(a); } }; }
    }

    isDown(action) {
        const s = this.bindings[action];
        return (!!s[0] && this.held.has(s[0])) || (!!s[1] && this.held.has(s[1])) || virtualDown(action);
    }

    onPress(action, fn) { this.handlers[action] = fn; }

    emit(action) { const h = this.handlers[action]; if (h) h(); }

    label(action) { return actionKeyName(action, this.bindings); }

    destroy() {
        window.removeEventListener('keydown', this.onDown);
        window.removeEventListener('keyup', this.onUp);
        window.removeEventListener('blur', this.onBlur);
        this.handlers = {};
    }
}
