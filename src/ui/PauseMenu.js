// STUB (owner: ui). Pause overlay. Game scene: `this.pause = new PauseMenu(this, { onResume, onQuit })`, `pause.show()`, `pause.hide()`, `pause.visible`.
// The Game scene is responsible for physics/time pausing; the menu only draws UI and calls the callbacks (RESUME, SETTINGS-less, QUIT TO MENU).
export default class PauseMenu {
    constructor(scene, { onResume, onQuit }) { this.scene = scene; this.onResume = onResume; this.onQuit = onQuit; this.visible = false; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    destroy() {}
}
