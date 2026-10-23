// Settings > AIM: MOUSE. The ship faces the cursor and the left button fires (keyboard fire still works); movement keys
// only move. Until the mouse is actually used the ship keeps v1 movement-aiming, so a player who picked MOUSE but plays
// on the keyboard isn't stuck facing up. Touch pointers are ignored (touch / gamepad keep their own controls).
// A pixel reticle replaces the OS cursor while the ship is controllable; menus on top (pause, upgrade) get it back.
import { DEPTH } from '../config.js';

const MIN_DIST = 6;   // closer than this the angle jitters; keep the last aim

export default class MouseAim {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.used = false;
        this.firing = false;
        this.reticle = scene.add.image(-20, -20, 'reticle').setDepth(DEPTH.FX_TOP + 1).setVisible(false);
        this.cursorHidden = false;
        this.onMove = (p) => { if (!p.wasTouch) this.used = true; };
        scene.input.on('pointermove', this.onMove);
        scene.input.on('pointerdown', this.onMove);
        // runs even while Game.update returns early (paused), so the cursor comes back for the pause menu
        scene.events.on('postupdate', this.sync, this);
    }

    /** true while the mouse owns the aim (Player then skips movement-aiming) */
    get active() { return this.used && !this.scene.input.activePointer.wasTouch; }

    /** called from Player.update: point the ship at the cursor and report the fire button */
    update() {
        const pl = this.player, ptr = this.scene.input.activePointer;
        this.firing = false;
        if (!this.active) return false;
        const dx = ptr.worldX - pl.x, dy = ptr.worldY - pl.y;
        if (dx * dx + dy * dy > MIN_DIST * MIN_DIST) pl.aim = Math.atan2(dy, dx);
        this.firing = ptr.isDown && ptr.leftButtonDown();
        return true;
    }

    sync() {
        const sc = this.scene, pl = this.player;
        const show = this.active && pl.alive && pl.controllable && !sc.paused && !sc.upgradeScreen && !sc.dying;
        const ptr = sc.input.activePointer;
        this.reticle.setVisible(show);
        if (show) this.reticle.setPosition(Math.round(ptr.worldX), Math.round(ptr.worldY));
        if (show !== this.cursorHidden) {
            this.cursorHidden = show;
            sc.input.setDefaultCursor(show ? 'none' : '');
        }
    }

    destroy() {
        const sc = this.scene;
        sc.input.off('pointermove', this.onMove);
        sc.input.off('pointerdown', this.onMove);
        sc.events.off('postupdate', this.sync, this);
        if (this.cursorHidden) sc.input.setDefaultCursor('');
        this.reticle.destroy();
    }
}
