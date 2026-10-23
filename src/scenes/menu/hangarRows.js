// Row widgets for the HANGAR scene: a permanent-upgrade row (icon, name, effect, tier pips, price) and a ship bay
// row (ship sprite, name, unlock status). Both are widgets Buttons with custom content on the lifting face so
// they behave like every other button (hover, focus ring, keyboard press via MenuNav).
import { COLORS, PALETTE } from '../../art/palette.js';
import { Button } from '../../ui/widgets.js';
import { save } from '../../systems/Save.js';
import { metaLevel, maxLevel, nextCost, isShipUnlocked, SHIP_UNLOCKS } from '../../systems/meta.js';
import { SHIP_INFO } from './data.js';
import { text, setTextKeep, fmt } from './helpers.js';

const PIP = 6, PIP_GAP = 2;

/** u: META_UPGRADES entry. Returns the Button with .refresh() */
export function upgradeRow(scene, x, y, w, h, u, onPress) {
    const b = new Button(scene, x, y, '', () => onPress(u, b), { w, h, arrows: false });
    const f = b.face, L = -(w >> 1), R = w >> 1;
    const icon = scene.add.image(L + 6, -8, u.icon).setOrigin(0, 0);
    const name = text(scene, L + 28, -9, u.title, { font: 'TITLE', size: 8, color: PALETTE[6] });
    const desc = text(scene, L + 28, 1, '', { size: 8, color: PALETTE[4] });
    const pips = scene.add.graphics();
    const cost = text(scene, R - 8, -4, '', { font: 'TITLE', size: 8, origin: [1, 0], color: PALETTE.A });
    const coin = scene.add.image(0, -8, 'icon_credit').setOrigin(0, 0);
    f.add([icon, name, desc, pips, cost, coin]);
    b.refresh2 = () => {
        const lv = metaLevel(u.id), max = maxLevel(u.id), price = nextCost(u.id);
        setTextKeep(desc, lv ? `NOW: ${u.desc(lv)}` : 'NEXT: ' + u.desc(1));
        desc.setColor(lv ? PALETTE.b : PALETTE[4]);
        // tier pips, right of the name column: lit = owned
        pips.clear();
        const px0 = R - 116 - max * (PIP + PIP_GAP);
        for (let i = 0; i < max; i++) {
            const on = i < lv;
            pips.fillStyle(on ? COLORS.C : COLORS[1]).fillRect(px0 + i * (PIP + PIP_GAP), -3, PIP, PIP);
            pips.fillStyle(on ? COLORS.b : COLORS[2]).fillRect(px0 + i * (PIP + PIP_GAP), -3, PIP, 1);
        }
        if (price === null) { setTextKeep(cost, 'MAX'); cost.setColor(PALETTE.L); coin.setVisible(false); }
        else {
            setTextKeep(cost, fmt(price));
            cost.setColor(save.credits >= price ? PALETTE.A : PALETTE.r);
            coin.setVisible(true).setX(cost.x - coin.width - 3);
        }
        return b;
    };
    b.info = () => {
        const lv = metaLevel(u.id), price = nextCost(u.id);
        if (price === null) return [`${u.title}  -  MAXED`, u.desc(lv), PALETTE.L];
        return [`${u.title}  -  TIER ${lv + 1}/${maxLevel(u.id)}`, `${lv ? u.desc(lv) + '  >  ' : ''}${u.desc(lv + 1)}`, PALETTE.b];
    };
    return b.refresh2();
}

/** id: ship id. Returns the Button with .refresh2() / .info() */
export function shipRow(scene, x, y, w, h, id, onPress) {
    const b = new Button(scene, x, y, '', () => onPress(id, b), { w, h, arrows: false });
    const f = b.face, L = -(w >> 1), R = w >> 1, info = SHIP_INFO[id];
    const ship = scene.add.image(L + 8, 0, `ship_${id}`, 0).setOrigin(0, 0);
    ship.y = -Math.floor(ship.height / 2);
    const name = text(scene, L + 44, -12, info.name, { font: 'TITLE', size: 8, color: info.accentCss });
    const cls = text(scene, R - 8, -12, info.cls, { size: 8, origin: [1, 0], color: PALETTE[4] });
    const status = text(scene, L + 44, 0, '', { size: 8, color: PALETTE[5] });
    const lock = scene.add.image(L + 8 + (ship.width >> 1) - 8, -8, 'icon_lock').setOrigin(0, 0);
    f.add([ship, name, cls, status, lock]);
    b.refresh2 = () => {
        const open = isShipUnlocked(id), u = SHIP_UNLOCKS[id];
        lock.setVisible(!open);
        ship.setTint(open ? 0xffffff : COLORS[2]);
        if (open) {
            const sel = save.ship === id;
            setTextKeep(status, sel ? 'SELECTED' : 'READY  -  PRESS TO SELECT');
            status.setColor(sel ? PALETTE.L : PALETTE[5]);
        } else {
            setTextKeep(status, `UNLOCK ${fmt(u.cost)} CR`);
            status.setColor(save.credits >= u.cost ? PALETTE.A : PALETTE.r);
        }
        return b;
    };
    b.info = () => {
        const u = SHIP_UNLOCKS[id];
        if (isShipUnlocked(id)) return [`${info.name}  -  ${info.cls}`, info.desc, info.accentCss];
        return [`${info.name}  -  LOCKED`, `${u.challenge}  OR  BUY FOR ${fmt(u.cost)} CREDITS`, PALETTE.A];
    };
    return b.refresh2();
}
