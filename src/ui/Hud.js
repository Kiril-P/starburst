// STUB (owner: ui). Real implementation replaces this file; keep the API.
//
// hud.update(state) is called every frame by the Game scene with:
// {
//   hp, maxHp,                 // numbers
//   score, combo,              // combo is the multiplier (1, 2, 3 ...), comboT01 = 0..1 time left before combo drops
//   comboT01,
//   wave, waveTimeLeft,        // seconds remaining in the wave (null for boss/no timer)
//   abilities: {               // each: { unlocked: bool, cooldown01: 0 (ready) .. 1 (just used), active: bool, key: 'SHIFT'|'Z'|'X' }
//     dash, forcefield, phase
//   }
// }
export default class Hud {
    constructor(scene) { this.scene = scene; }
    update(state) {}
    /** big centred banner, e.g. announce('WAVE 3', 'GET READY') */
    announce(title, sub = '', ms = 1800) {}
    /** small toast at top centre */
    toast(text, color = '#f4faff', ms = 1500) {}
    setVisible(v) {}
    destroy() {}
}
