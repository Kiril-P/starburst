// One call for every scene change: wipeTo(this, 'GameOver', data). Blocks the source scene's input during the
// cover so a double press can't start two transitions; falls back to a plain scene.start if the Wipe scene
// isn't running (e.g. a tool booting one scene directly).
export function wipeTo(scene, key, data, opts = {}) {
    const wipe = scene.scene.get('Wipe');
    if (scene.input) { scene.input.enabled = false; if (scene.input.keyboard) scene.input.keyboard.enabled = false; }
    // a scene's input plugin keeps `enabled` across restarts, so hand it back before leaving (RETRY reuses it)
    const go = () => {
        if (scene.input) { scene.input.enabled = true; if (scene.input.keyboard) scene.input.keyboard.enabled = true; }
        scene.scene.start(key, data);
    };
    if (!wipe || !wipe.sys.isActive() || !wipe.g) { go(); return; }
    if (!wipe.play(go, opts)) go();
}

/** true while a wipe is on screen (scenes can ignore input meanwhile) */
export function wiping(scene) {
    const w = scene.scene.get('Wipe');
    return !!(w && w.busy);
}
