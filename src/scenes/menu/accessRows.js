// Accessibility / controls rows appended to the SETTINGS panel (kept here so SettingsPanel only spreads them in).
// Row kinds as in SettingsPanel: 'toggle', 'choice' (cycles def.options, shows def.text()), 'link' (opens a sub-panel).
import { save } from '../../systems/Save.js';

const AIM_TEXT = { move: 'MOVEMENT', mouse: 'MOUSE' };
const CONTRAST_TEXT = { off: 'NORMAL', hc: 'CONTRAST', cb: 'ORANGE' };

/** Open a sub-panel on top of `sc` and hand the keyboard / pointer back to it when the sub-panel stops. */
export function openSubPanel(sc, key) {
    sc.input.keyboard.enabled = false;
    sc.input.enabled = false;
    sc.scene.launch(key);
    sc.scene.get(key).events.once('shutdown', () => {
        if (!sc.sys.isActive()) return;
        sc.input.keyboard.enabled = true;
        sc.input.enabled = true;
    });
}

export const ACCESS_ROWS = [
    { label: 'CONTROLS', kind: 'link', text: () => 'REBIND', open: (sc) => openSubPanel(sc, 'MenuControls') },
    { label: 'AIM', kind: 'choice', options: ['move', 'mouse'], get: () => save.aimMode, text: () => AIM_TEXT[save.aimMode], set: (v) => { save.aimMode = v; } },
    // white cores + dark outline; ORANGE also recolours every hostile bullet (orange vs cyan survives colour blindness)
    { label: 'ENEMY BULLETS', kind: 'choice', options: ['off', 'hc', 'cb'], get: () => save.bulletContrast, text: () => CONTRAST_TEXT[save.bulletContrast], set: (v) => { save.bulletContrast = v; } },
    // slower bullets, +50% hull, wider graze; labelled in-game and flagged off-leaderboard (systems/access.js)
    { label: 'ASSIST MODE', kind: 'toggle', get: () => save.assist, set: (v) => { save.assist = v; } }
];
