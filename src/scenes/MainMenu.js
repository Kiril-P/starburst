// Title screen: logo, ship showcase/select, nav column (START / DAILY RUN / HANGAR / ACHIEVEMENTS / RECORDS / QUESTS /
// SETTINGS / DIFFICULTY), best run, credits, and the START launch sequence. Panels open as overlay scenes
// (scenes/menu/*Panel.js) on top of this one; the HANGAR is its own scene (scenes/Hangar.js).
import Phaser from 'phaser';
import { W, H, DEPTH, SHIPS } from '../config.js';
import { COLORS, PALETTE } from '../art/palette.js';
import Background from '../fx/Background.js';
import { MenuNav } from '../ui/widgets.js';
import { save } from '../systems/Save.js';
import { sfx } from '../systems/sfx.js';
import { evaluateQuests, syncQuests } from '../systems/quests.js';
import TitleLogo from './menu/TitleLogo.js';
import ShipShowcase from './menu/ShipShowcase.js';
import SkyFx from './menu/SkyFx.js';
import { createBestRun, createShipInfo } from './menu/InfoPanels.js';
import { DIFFICULTY_INFO } from './menu/data.js';
import { playTitleMusic, fadeOutTitleMusic, audioLocked } from './menu/music.js';
import { text, navButton, fmt } from './menu/helpers.js';
import { addBossGalleryEntry } from './menu/BossGallery.js';
import { setRunMode, isShipUnlocked } from '../systems/meta.js';
import { ACHIEVEMENTS, unlockedCount } from '../systems/achievements.js';
import { topRuns } from '../systems/leaderboard.js';
import { createCredits, shipInfoFor, lockFooter, denyLocked } from './menu/metaUi.js';
import { wipeTo } from './cine/wipe.js';
import { startTelemetry } from '../systems/telemetry.js';

// layout (native px)
const NAV = { x: 16, w: 160, h: 20, y: 96, step: 22 };
const SHIP_XS = [282, 404, 526];
const SHIP_Y = 172;
const STAGE_CX = 404;            // centre of the ship stage (right of the nav column)

export default class MainMenu extends Phaser.Scene {
    constructor() { super('MainMenu'); }

    init(data) {
        // attract mode ("PRESS ANY KEY") when the browser still blocks audio, or when forced (dev/testing)
        this.attract = !!data?.attract || audioLocked(this);
        this.starting = false;
        this.overlayOpen = false;
        // startGame()/openOverlay() disable input, and the scene's KeyboardPlugin keeps `enabled` across restarts:
        // without this, returning from a run left the menu deaf to the keyboard
        this.input.keyboard.enabled = true;
        this.input.enabled = true;
    }

    create() {
        startTelemetry();   // once per page load; no-op without an API / with ONLINE off (systems/telemetry.js)
        this.bg = new Background(this);
        this.sky = new SkyFx(this);
        this.logo = new TitleLogo(this, W / 2, 40);
        const shipIdx = Math.max(0, SHIPS.indexOf(save.ship));
        this.ships = new ShipShowcase(this, SHIP_XS, SHIP_Y, shipIdx, (i) => this.onShipClick(i));
        this.ships.setLocked(SHIPS.map((id) => !isShipUnlocked(id)));
        this.freshQuests = syncQuests(save).map((q) => q.id);

        this.buildNav();
        addBossGalleryEntry(this);   // BOSSES button + [B] (owned by the bosses module)
        this.bestRun = createBestRun(this, NAV.x, NAV.y + NAV.step * this.buttons.length - 5, NAV.w, 60, save);
        this.shipInfo = createShipInfo(this, STAGE_CX, 258, 300);
        this.shipInfo.show(shipInfoFor(SHIPS[shipIdx]));
        this.credits = createCredits(this, W - 8, 8);
        this.buildFooter();
        this.updateFooter();
        this.corner = text(this, W - 6, H - 5, 'V2.0', { size: 8, origin: [1, 1], color: PALETTE[2] }).setDepth(DEPTH.HUD);

        this.flash = this.add.rectangle(0, 0, W, H, COLORS.w, 0).setOrigin(0).setDepth(DEPTH.MODAL + 10);
        this.intensity = 1;
        this.t = 0;

        for (const k of ['LEFT', 'A']) this.input.keyboard.on(`keydown-${k}`, () => this.stepShip(-1));
        for (const k of ['RIGHT', 'D']) this.input.keyboard.on(`keydown-${k}`, () => this.stepShip(1));
        this.events.once('shutdown', () => this.cleanup());

        if (this.attract) this.enterAttract();
        else this.reveal(true);
    }

    // ---- building ---------------------------------------------------------------------------------------------
    buildNav() {
        const quests = evaluateQuests(save);
        const done = quests.filter((q) => q.done).length;
        const diff = DIFFICULTY_INFO[save.difficulty] ?? DIFFICULTY_INFO.normal;
        const daily = topRuns('daily')[0];
        const defs = [
            ['START', () => this.startGame('normal'), { double: true, labelColor: PALETTE.b }],
            ['DAILY RUN', () => this.startGame('daily'), { value: daily ? fmt(daily.score) : 'NEW', valueColor: PALETTE.A, labelColor: PALETTE.z }],
            ['HANGAR', () => this.openHangar(), {}],
            ['ACHIEVEMENTS', () => this.openOverlay('MenuAchievements'), { value: `${unlockedCount()}/${ACHIEVEMENTS.length}`, valueColor: PALETTE[4] }],
            ['RECORDS', () => this.openOverlay('MenuRecords'), {}],
            ['QUESTS', () => this.openOverlay('MenuQuests', { fresh: this.freshQuests }), { value: `${done}/${quests.length}`, valueColor: PALETTE[4] }],
            ['SETTINGS', () => this.openOverlay('MenuSettings'), {}],
            ['DIFFICULTY', () => this.openOverlay('MenuDifficulty'), { value: diff.name, valueColor: diff.css }]
        ];
        this.buttons = defs.map(([label, fn, opts], i) => {
            const b = navButton(this, NAV.x + NAV.w / 2, NAV.y + i * NAV.step, NAV.w, NAV.h, label, () => this.press(fn), opts);
            b.setDepth(DEPTH.HUD);
            b.homeX = b.x;
            return b;
        });
        this.btn = Object.fromEntries(defs.map(([label], i) => [label, this.buttons[i]]));
        if (this.freshQuests.length) this.btn.QUESTS.setValue('NEW', PALETTE.A);
    }

    buildFooter() {
        const y = H - 34;
        this.footer = this.add.container(0, 0).setDepth(DEPTH.HUD);
        const hint = text(this, STAGE_CX, y, 'SELECT SHIP', { font: 'TITLE', size: 8, origin: [0.5, 0], color: PALETTE[5] });
        const al = this.add.image(hint.x - 14, y, 'ui_arrow_l').setOrigin(0, 0);
        const ar = this.add.image(hint.x + hint.width + 6, y, 'ui_arrow_r').setOrigin(0, 0);
        const sub = text(this, STAGE_CX, y + 13, 'ENTER TO START', { size: 8, origin: [0.5, 0], color: PALETTE.C });
        const g = this.add.graphics();
        g.fillStyle(COLORS.c).fillRect(al.x - 52, y + 3, 40, 1).fillRect(ar.x + ar.width + 12, y + 3, 40, 1);
        g.fillStyle(COLORS.C).fillRect(al.x - 14, y + 3, 2, 1).fillRect(ar.x + ar.width + 12, y + 3, 2, 1);
        this.footer.add([g, al, ar, hint, sub]);
        this.footerSub = sub;
        this.footerArrows = [al, ar];
        this.press1 = text(this, STAGE_CX, H - 30, 'PRESS ANY KEY', { font: 'TITLE', size: 8, origin: [0.5, 0], color: PALETTE.w })
            .setDepth(DEPTH.HUD).setVisible(false);
    }

    updateFooter() { lockFooter(this.footerSub, STAGE_CX); }

    /** UI elements that slide/fade in on reveal and out on START. */
    get chrome() { return [...this.buttons, this.bestRun, this.shipInfo.container, this.footer, this.credits]; }

    // ---- attract / reveal ---------------------------------------------------------------------------------------
    enterAttract() {
        this.chrome.forEach((o) => o.setVisible(false));
        this.press1.setVisible(true);
        this.logo.intro(200);
        const go = () => {
            if (!this.attract) return;
            this.attract = false;
            this.input.keyboard.off('keydown', go);
            this.input.off('pointerdown', go);
            this.press1.setVisible(false);
            sfx(this, 'button-sound');
            this.reveal(false);
        };
        this.input.keyboard.on('keydown', go);
        this.input.on('pointerdown', go);
    }

    reveal(withLogo) {
        // the keypress/click that unlocked audio counts as the user gesture, so music can start now
        playTitleMusic(this);
        if (withLogo) this.logo.intro(0);
        this.chrome.forEach((o) => o.setVisible(true));
        this.buttons.forEach((b, i) => this.slideIn(b, b.homeX, 120 + i * 60));
        [this.bestRun, this.shipInfo.container, this.footer, this.credits].forEach((o, i) => {
            o.setAlpha(0);
            this.tweens.add({ targets: o, alpha: 1, duration: 300, delay: 360 + i * 80 });
        });
        // keyboard nav only once the reveal input has been consumed (otherwise ENTER on the attract screen = START)
        this.time.delayedCall(60, () => { this.nav = new MenuNav(this, this.buttons); });
    }

    slideIn(obj, homeX, delay) {
        const p = { v: 0 };
        obj.setAlpha(0);
        obj.x = homeX - 24;
        this.tweens.add({
            targets: p, v: 1, delay, duration: 260, ease: 'Cubic.easeOut',
            onUpdate: () => { obj.x = Math.round(homeX - (1 - p.v) * 24); obj.setAlpha(p.v); }
        });
    }

    // ---- interaction ------------------------------------------------------------------------------------------
    press(fn) {
        if (this.starting || this.attract || this.overlayOpen) return;
        fn();
    }

    stepShip(d) {
        if (this.starting || this.attract || this.overlayOpen) return;
        this.selectShip((this.ships.index + d + SHIPS.length) % SHIPS.length);
    }

    onShipClick(i) {
        if (this.starting || this.attract || this.overlayOpen) return;
        // clicking the already-selected ship launches, like pressing ENTER
        if (i === this.ships.index) this.startGame('normal');
        else this.selectShip(i);
    }

    selectShip(i) {
        if (i === this.ships.index) return;
        save.ship = SHIPS[i];
        this.ships.select(i);
        this.shipInfo.show(shipInfoFor(SHIPS[i]));
        this.updateFooter();
        sfx(this, 'button-sound', { vol: 0.6, rate: 1.2 });
    }

    openOverlay(key, data = {}) {
        this.overlayOpen = true;
        this.input.keyboard.enabled = false;
        this.input.enabled = false;
        this.scene.launch(key, data);
        this.scene.get(key).events.once('shutdown', () => {
            // re-enable next frame so the closing keypress isn't seen again here
            this.time.delayedCall(30, () => {
                this.input.keyboard.enabled = true;
                this.input.enabled = true;
                this.overlayOpen = false;
            });
            if (key === 'MenuDifficulty') {
                const d = DIFFICULTY_INFO[save.difficulty] ?? DIFFICULTY_INFO.normal;
                this.btn.DIFFICULTY.setValue(d.name, d.css);
            }
            if (key === 'MenuQuests' && this.freshQuests.length) {
                this.freshQuests = [];
                const q = evaluateQuests(save);
                this.btn.QUESTS.setValue(`${q.filter((x) => x.done).length}/${q.length}`, PALETTE[4]);
            }
        });
    }

    // ---- START ------------------------------------------------------------------------------------------------
    openHangar() {
        this.starting = true;   // blocks other menu input during the wipe
        wipeTo(this, 'Hangar');
    }

    startGame(mode = 'normal') {
        if (this.starting) return;
        if (!isShipUnlocked(save.ship)) { denyLocked(this, this.btn.HANGAR); return; }
        setRunMode(mode);
        this.starting = true;
        this.input.keyboard.enabled = false;
        this.input.enabled = false;
        fadeOutTitleMusic(this, 800);
        // chrome slides away left / fades
        this.chrome.forEach((o, i) => {
            const x0 = o.x;
            const p = { v: 0 };
            this.tweens.add({
                targets: p, v: 1, duration: 240, delay: i * 30, ease: 'Cubic.easeIn',
                onUpdate: () => { o.setAlpha(1 - p.v); if (this.buttons.includes(o)) o.x = Math.round(x0 - p.v * 30); }
            });
        });
        this.tweens.add({ targets: [this.logo.logo, this.logo.halo, this.corner], alpha: 0, duration: 400, delay: 150 });

        this.time.delayedCall(100, () => sfx(this, 'thruster-hum', { vol: 0.7 }));
        this.time.delayedCall(320, () => sfx(this, 'dash', { vol: 0.9 }));
        // warp ramps up while the ship climbs
        const w = { v: 0 };
        this.tweens.add({
            targets: w, v: 1, duration: 650, delay: 220, ease: 'Quad.easeIn',
            onUpdate: () => { this.sky.setWarp(w.v); this.intensity = 1 + w.v * 9; }
        });
        this.shakeUntil = this.time.now + 700;
        this.ships.launch(() => this.finishStart());
    }

    finishStart() {
        // white flash (or a fade to black when flashes are disabled), then hand over to the Game scene
        const flash = save.flashEffects;
        this.flash.setFillStyle(flash ? COLORS.w : COLORS.k, 0);
        this.tweens.add({
            targets: this.flash, fillAlpha: 1, duration: flash ? 90 : 220,
            onComplete: () => this.time.delayedCall(flash ? 60 : 80, () => {
                this.sound.getAll('title-music').forEach((s) => s.stop());
                this.scene.start('Game');
            })
        });
    }

    update(t, dt) {
        this.t += dt;
        this.bg.update(dt, this.intensity);
        this.sky.update(dt);
        this.logo.update(dt);
        this.ships.update(dt);
        // whole-pixel camera rumble during the launch (honours the screen-shake setting)
        const cam = this.cameras.main;
        if (this.starting && t < this.shakeUntil && save.screenShake > 0) {
            const a = Math.max(1, Math.round(save.screenShake));
            cam.setScroll(Phaser.Math.Between(-a, a), Phaser.Math.Between(-a, a));
        } else if (cam.scrollX || cam.scrollY) cam.setScroll(0, 0);
        if (this.attract) this.press1.setVisible(Math.floor(this.t / 500) % 2 === 0);
        else if (!this.starting) {
            // gentle blink on the arrows + "ENTER TO START"
            const on = Math.floor(this.t / 600) % 2 === 0;
            this.footerSub.setColor(on ? PALETTE.C : PALETTE.c);
            this.footerArrows.forEach((a, i) => { a.x = (a.baseX ??= a.x) + (on ? (i ? 1 : -1) : 0); });
        }
    }

    cleanup() {
        this.bg.destroy?.();
        this.sky.destroy();
        this.nav = null;
    }
}
