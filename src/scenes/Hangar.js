// HANGAR: spend credits earned in runs. Left column = permanent upgrades (small stackable tiers, escalating
// cost, systems/meta.js META_UPGRADES), right column = ship bay (unlock NOVA DART / TITAN with credits or by
// beating their challenge, and pick the ship to fly). UP/DOWN move, LEFT/RIGHT jump between the columns,
// ENTER buys / selects, ESC back to the title. Reached from MainMenu via the wipe transition.
import Phaser from 'phaser';
import { W, H, DEPTH, SHIPS } from '../config.js';
import { COLORS, PALETTE } from '../art/palette.js';
import Background from '../fx/Background.js';
import { Button, MenuNav, createPanel } from '../ui/widgets.js';
import { save } from '../systems/Save.js';
import { sfx, uiSfx } from '../systems/sfx.js';
import { META_UPGRADES, buyUpgrade, buyShip, nextCost, isShipUnlocked, SHIP_UNLOCKS } from '../systems/meta.js';
import { checkAchievements, onUnlock } from '../systems/achievements.js';
import { playTitleMusic } from './menu/music.js';
import { text, setTextKeep } from './menu/helpers.js';
import { createCredits } from './menu/metaUi.js';
import { upgradeRow, shipRow } from './menu/hangarRows.js';
import AchievementToast from './run/AchievementToast.js';
import { wipeTo } from './cine/wipe.js';

const LEFT = { x: 14, w: 368, h: 26, y: 62, step: 29 };
const RIGHT = { x: 394, w: 232, h: 40, y: 69, step: 46 };
const INFO_Y = 280;

export default class Hangar extends Phaser.Scene {
    constructor() { super('Hangar'); }

    create() {
        this.leaving = false;
        this.input.keyboard.enabled = true;
        this.input.enabled = true;
        this.bg = new Background(this, { biome: 1 });
        this.add.rectangle(0, 0, W, H, COLORS.k, 0.35).setOrigin(0).setDepth(DEPTH.BG_NEAR + 1);
        playTitleMusic(this);

        text(this, 16, 12, 'HANGAR', { font: 'TITLE', size: 16, color: PALETTE.w }).setDepth(DEPTH.HUD);
        text(this, 16, 32, 'PERMANENT UPGRADES CARRY OVER TO EVERY RUN', { size: 8, color: PALETTE[4] }).setDepth(DEPTH.HUD);
        const rule = this.add.graphics().setDepth(DEPTH.HUD);
        rule.fillStyle(COLORS.c).fillRect(16, 44, W - 32, 1).fillStyle(COLORS.C).fillRect(16, 44, 24, 1);
        this.credits = createCredits(this, W - 16, 14);

        this.upRows = META_UPGRADES.map((u, i) => upgradeRow(this, LEFT.x + LEFT.w / 2, LEFT.y + i * LEFT.step, LEFT.w, LEFT.h, u, (uu, b) => this.buy(uu, b)));
        this.shipRows = SHIPS.map((id, i) => shipRow(this, RIGHT.x + RIGHT.w / 2, RIGHT.y + i * RIGHT.step, RIGHT.w, RIGHT.h, id, (sid, b) => this.ship(sid, b)));
        this.back = new Button(this, RIGHT.x + RIGHT.w / 2, RIGHT.y + 3 * RIGHT.step - 6, 'BACK', () => this.leave(), { w: 120, h: 20 });
        const all = [...this.upRows, ...this.shipRows, this.back];
        all.forEach((b) => b.setDepth(DEPTH.HUD));

        // focused item details
        this.infoPanel = createPanel(this, W / 2, INFO_Y + 22, W - 28, 44).setDepth(DEPTH.HUD);
        this.infoHead = text(this, 26, INFO_Y + 7, '', { font: 'TITLE', size: 8, color: PALETTE.b }).setDepth(DEPTH.HUD + 1);
        this.infoBody = text(this, 26, INFO_Y + 22, '', { size: 8, color: PALETTE[6] }).setDepth(DEPTH.HUD + 1);
        this.msg = text(this, W - 26, INFO_Y + 7, '', { size: 8, origin: [1, 0], color: PALETTE.L }).setDepth(DEPTH.HUD + 1);
        text(this, W / 2, H - 12, 'ARROWS  MOVE     ENTER  BUY / SELECT     ESC  BACK', { size: 8, origin: [0.5, 0], color: PALETTE[3] }).setDepth(DEPTH.HUD);

        this.nav = new MenuNav(this, all, { onChange: (i, b) => this.showInfo(b) });
        this.showInfo(all[0]);
        this.input.keyboard.on('keydown-ESC', () => this.leave());
        this.input.keyboard.on('keydown-BACKSPACE', () => this.leave());
        for (const k of ['LEFT', 'A']) this.input.keyboard.on(`keydown-${k}`, () => this.jump(0));
        for (const k of ['RIGHT', 'D']) this.input.keyboard.on(`keydown-${k}`, () => this.jump(1));

        this.toast = new AchievementToast(this, { y: 14 + 22 });
        this.offUnlock = onUnlock((a) => this.toast.show(a));
        this.events.once('shutdown', () => { this.offUnlock(); this.bg.destroy?.(); this.nav.destroy(); });
        checkAchievements();   // e.g. FULL FLEET earned by challenges since the last visit
    }

    /** LEFT/RIGHT: hop between the upgrade column and the ship column, keeping the row roughly level */
    jump(side) {
        const i = this.nav.i, nUp = this.upRows.length;
        const inShips = i >= nUp;
        if (side === 1 && !inShips) this.nav.focus(nUp + Math.min(Math.floor(i / 2), this.shipRows.length));
        else if (side === 0 && inShips) this.nav.focus(Math.min((i - nUp) * 2, nUp - 1));
    }

    showInfo(b) {
        if (!b.info) { setTextKeep(this.infoHead, 'BACK TO THE TITLE'); setTextKeep(this.infoBody, ''); return; }
        const [head, body, col] = b.info();
        setTextKeep(this.infoHead, head);
        this.infoHead.setColor(col);
        setTextKeep(this.infoBody, body);
    }

    say(str, col) {
        setTextKeep(this.msg, str);
        this.msg.setColor(col);
        this.msgT?.remove();
        this.msgT = this.time.delayedCall(1600, () => setTextKeep(this.msg, ''));
    }

    afterPurchase(b) {
        sfx(this, 'upgrade', { vol: 0.7 });
        this.credits.refresh();
        [...this.upRows, ...this.shipRows].forEach((r) => r.refresh2());
        this.showInfo(b);
        this.cameras.main.flash(90, 57, 231, 255);
        checkAchievements();
    }

    denied(reason) {
        sfx(this, 'button-sound', { vol: 0.5, rate: 0.6 });
        this.say(reason, PALETTE.R);
        this.tweens.add({ targets: this.credits.val, alpha: 0.3, duration: 70, yoyo: true, repeat: 2 });
    }

    buy(u, b) {
        if (nextCost(u.id) === null) { uiSfx(this, 'back'); this.say('ALREADY MAXED', PALETTE[4]); return; }
        if (!buyUpgrade(u.id)) { this.denied('NOT ENOUGH CREDITS'); return; }
        this.say(`${u.title} UPGRADED`, PALETTE.L);
        this.afterPurchase(b);
    }

    ship(id, b) {
        if (isShipUnlocked(id)) {
            save.ship = id;
            this.shipRows.forEach((r) => r.refresh2());
            this.say('SHIP SELECTED', PALETTE.L);
            return;
        }
        if (!buyShip(id)) { this.denied(`NEED ${SHIP_UNLOCKS[id].cost} CR`); return; }
        save.ship = id;
        this.say('SHIP UNLOCKED', PALETTE.L);
        this.afterPurchase(b);
    }

    leave() {
        if (this.leaving) return;
        this.leaving = true;
        uiSfx(this, 'back');
        wipeTo(this, 'MainMenu');
    }

    update(t, dt) { this.bg.update(dt, 0.8); }
}
