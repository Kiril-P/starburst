export default class Preload extends Phaser.Scene {
    constructor() {
        super('Preload');
    }

    preload() {
        // Display loading progress
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Loading bar
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 4, height / 2 - 30, width / 2, 50);
        
        // Loading text
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);
        
        // Percent text
        const percentText = this.make.text({
            x: width / 2,
            y: height / 2 - 5,
            text: '0%',
            style: {
                font: '18px monospace',
                fill: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);
        
        // Loading events
        this.load.on('progress', function (value) {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 4 + 10, height / 2 - 20, (width / 2 - 20) * value, 30);
        });
        
        this.load.on('complete', function () {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });

        // Preload audio
        this.load.audio('title-music', 'assets/audio/title.wav');
        this.load.audio('main-music', 'assets/audio/main.wav');
    }

    create() {
        // Generate placeholder textures programmatically
        this.generatePlaceholderTextures();
        
        // Go to the main menu when all assets have been loaded
        this.scene.start('MainMenu');
    }
    
    generatePlaceholderTextures() {
        // Generate a logo placeholder
        this.generateLogoPlaceholder();
        
        // Generate player ship placeholder
        this.generatePlayerShipPlaceholder();
        
        // Generate enemy ship placeholder
        this.generateEnemyPlaceholder();
        
        // Generate health bar placeholder
        this.generateHealthBarPlaceholder();
        
        // Generate particle placeholder
        this.generateParticlePlaceholder();
    }
    
    generateLogoPlaceholder() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        
        // Draw a simple logo
        graphics.fillStyle(0x880088);
        graphics.fillRect(0, 0, 200, 100);
        
        graphics.fillStyle(0xff88ff);
        graphics.fillRect(10, 10, 180, 80);
        
        graphics.lineStyle(4, 0xffffff);
        graphics.strokeRect(20, 20, 160, 60);
        
        // Generate texture
        graphics.generateTexture('logo-placeholder', 200, 100);
        graphics.destroy();
    }
    
    generatePlayerShipPlaceholder() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        
        // Draw a triangle ship shape
        graphics.fillStyle(0x00ffff);
        graphics.fillTriangle(10, 25, 20, 5, 30, 25);
        
        // Add details
        graphics.fillStyle(0x0088ff);
        graphics.fillRect(12, 18, 16, 8);
        
        graphics.fillStyle(0xffff00);
        graphics.fillRect(12, 25, 5, 3);
        graphics.fillRect(23, 25, 5, 3);
        
        // Generate texture - make even smaller
        graphics.generateTexture('player-ship', 30, 25);
        graphics.destroy();
    }
    
    generateEnemyPlaceholder() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        
        // Draw a basic enemy ship shape
        graphics.fillStyle(0xff0000);
        graphics.fillTriangle(20, 5, 40, 40, 60, 5);
        
        // Add details
        graphics.fillStyle(0x880000);
        graphics.fillRect(25, 10, 30, 15);
        
        graphics.fillStyle(0xffff00);
        graphics.fillCircle(40, 25, 5);
        
        // Generate texture
        graphics.generateTexture('enemy-basic', 80, 50);
        
        // Create spread enemy texture
        graphics.clear();
        
        // Draw spread enemy shape (slightly different)
        graphics.fillStyle(0xff00ff);
        graphics.fillTriangle(20, 5, 40, 35, 60, 5);
        
        // Add details
        graphics.fillStyle(0x880088);
        graphics.fillRect(25, 10, 30, 15);
        
        graphics.fillStyle(0x00ffff);
        graphics.fillCircle(40, 25, 5);
        
        // Generate spread enemy texture
        graphics.generateTexture('enemy-spread', 80, 50);
        
        // Create circular enemy texture
        graphics.clear();
        
        // Draw circular enemy shape
        graphics.fillStyle(0xff0000);
        graphics.fillCircle(40, 25, 20);
        
        // Add details
        graphics.fillStyle(0x880000);
        graphics.fillRect(30, 15, 20, 20);
        
        graphics.fillStyle(0xffff00);
        graphics.fillCircle(40, 25, 8);
        
        // Generate circular enemy texture
        graphics.generateTexture('enemy-circular', 80, 50);
        
        graphics.destroy();
    }
    
    generateHealthBarPlaceholder() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        
        // Draw a simple health bar
        graphics.fillStyle(0x222222);
        graphics.fillRect(0, 0, 200, 20);
        
        graphics.fillStyle(0x00ff00);
        graphics.fillRect(2, 2, 196, 16);
        
        // Generate texture
        graphics.generateTexture('health-bar-placeholder', 200, 20);
        graphics.destroy();
    }
    
    generateParticlePlaceholder() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        
        // Draw a simple particle
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(8, 8, 8);
        
        // Generate texture
        graphics.generateTexture('particle', 16, 16);
        graphics.destroy();
    }
} 