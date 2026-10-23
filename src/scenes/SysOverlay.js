// Always-on scene drawn above every other scene (last in the scene list). Owns the app-level odds and ends that
// don't belong to any one screen:
//   - optional FPS counter (Settings > SHOW FPS)
//   - gamepad -> virtual keys bridge (systems/gamepad.js), so every menu and the ship work with a controller
//   - auto-pause the run when the window loses focus / the tab is hidden
//   - on-screen touch controls during a run on touch devices (ui/TouchControls.js)
//   - F toggles fullscreen
import Phaser from 'phaser';
import { W, DEPTH } from '../config.js';
import { save } from '../systems/Save.js';
import { pxText } from '../ui/text.js';
import GamepadBridge from '../systems/gamepad.js';
import TouchControls, { touchWanted } from '../ui/TouchControls.js';

export default class SysOverlay extends Phaser.Scene {
    constructor() { super({ key: 'SysOverlay', active: false }); }

    create() {
        this.fps = pxText(this, W / 2, 2, '', { size: 8, origin: [0, 0], color: '#b7ff4a' }).setDepth(DEPTH.MODAL + 100);
        this.fpsT = 0;
        this.pads = new GamepadBridge();
        this.touch = touchWanted() ? new TouchControls(this) : null;
        // window blur covers alt-tab and clicking outside; 'hidden' covers tab switches (Phaser also stops the loop)
        this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
        this.game.events.on(Phaser.Core.Events.HIDDEN, this.autoPause, this);
        this.input.keyboard.on('keydown-F', () => this.scale.toggleFullscreen());
    }

    /** the live Game scene, if a run is on screen */
    get run() {
        const g = this.scene.get('Game');
        return g && g.sys.isActive() ? g : null;
    }

    autoPause() {
        const g = this.run;
        if (g && !g.paused && !g.dying && !g.upgradeScreen && g.setPaused) g.setPaused(true);
    }

    update(t, dt) {
        this.pads.poll();
        if (this.touch) {
            const g = this.run;
            const live = !!(g && !g.paused && !g.dying && !g.upgradeScreen && g.player && g.player.alive);
            this.touch.setVisible(live);
            if (live) { this.touch.setUnlocked(g.player.levels); this.touch.update(); }
        }
        const show = save.showFps;
        this.fps.setVisible(show);
        if (show && (this.fpsT -= dt) <= 0) {
            this.fpsT = 250;
            const f = Math.round(this.game.loop.actualFps);
            this.fps.setText(`${f} FPS`).setColor(f >= 55 ? '#b7ff4a' : f >= 40 ? '#ffb547' : '#ff6a5c');
            this.fps.x = Math.round(W / 2 - this.fps.width / 2);
        }
    }
}
