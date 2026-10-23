// Small meta-progression read-outs shared by the title screen and the hangar.
import { DEPTH } from '../../config.js';
import { PALETTE } from '../../art/palette.js';
import { sfx } from '../../systems/sfx.js';
import { save } from '../../systems/Save.js';
import { isShipUnlocked, SHIP_UNLOCKS } from '../../systems/meta.js';
import { SHIP_INFO } from './data.js';
import { text, fmt } from './helpers.js';

/** Credits counter (coin icon + amber number + CR), right-aligned at (rx, y). Returns a container with refresh(). */
export function createCredits(scene, rx, y) {
    const c = scene.add.container(0, 0).setDepth(DEPTH.HUD);
    const unit = text(scene, rx, y + 4, 'CR', { size: 8, origin: [1, 0], color: PALETTE.a });
    const val = text(scene, rx, y + 4, '', { font: 'TITLE', size: 8, color: PALETTE.A });
    const icon = scene.add.image(0, y, 'icon_credit').setOrigin(0, 0);
    c.add([icon, val, unit]);
    c.refresh = () => {
        val.setText(fmt(save.credits));
        val.x = Math.round(unit.x - 4 - val.width);
        icon.x = val.x - icon.width - 3;
        return c;
    };
    c.val = val;
    return c.refresh();
}

/** SHIP_INFO for the read-out under the showcase; locked ships explain how to unlock them instead. */
export function shipInfoFor(id) {
    const info = SHIP_INFO[id];
    if (isShipUnlocked(id)) return info;
    const u = SHIP_UNLOCKS[id];
    return { ...info, desc: `LOCKED: ${u.challenge} OR ${fmt(u.cost)} CR` };
}

/** title-screen footer line under the ships: start hint, or where to unlock the selected ship */
export function lockFooter(t, cx) {
    t.setText(isShipUnlocked(save.ship) ? 'ENTER TO START' : 'LOCKED  -  SEE HANGAR');
    t.x = Math.round(cx - t.width / 2);
}

/** START with a locked ship: refuse with a low buzz + shake, and flash the price on the HANGAR button */
export function denyLocked(scene, hangarBtn) {
    sfx(scene, 'button-sound', { vol: 0.5, rate: 0.6 });
    const u = SHIP_UNLOCKS[save.ship];
    scene.cameras.main.shake(120, 0.004 * save.screenShake);
    hangarBtn.setValue(u ? `${fmt(u.cost)} CR` : '', PALETTE.R);
    scene.time.delayedCall(1200, () => hangarBtn.setValue('', PALETTE.R));
}
