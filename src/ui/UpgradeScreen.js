// STUB (owner: ui). Between-wave pick screen.
// options: [{ id, title, desc, icon: 'card_dash'|'card_forcefield'|'card_phase'|'card_speed'|'card_heal', tag?: 'NEW'|'UPGRADE'|'HEAL' }]
// onPick(option) is called once; the screen destroys itself afterwards.
export default class UpgradeScreen {
    constructor(scene, options, onPick) {
        this.scene = scene;
        // trivially pick the first option so the game stays playable until the real one lands
        scene.time.delayedCall(100, () => onPick(options[0]));
    }
    destroy() {}
}
