export default class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Load any assets needed for the loading screen
        this.load.image('logo', 'assets/images/logo-placeholder.png');
    }

    create() {
        // Initialize any game settings
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        
        // Proceed to the Preload scene
        this.scene.start('Preload');
    }
} 