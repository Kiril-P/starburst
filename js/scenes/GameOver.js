export default class GameOver extends Phaser.Scene {
    constructor() {
        super('GameOver');
    }

    init(data) {
        // Save the player's score to display
        this.finalScore = data.score || 0;
        this.waveReached = data.wave || 1;
        
        console.log('GameOver - Received score:', this.finalScore, 'wave:', this.waveReached); // Debug log
        
        // Save high score and wave to localStorage if they're better than previous bests
        this.saveHighScore();
    }
    
    saveHighScore() {
        // Get current high score and high wave from localStorage (default to 0 and 1)
        const currentHighScore = parseInt(localStorage.getItem('highScore') || '0');
        const currentHighWave = parseInt(localStorage.getItem('highWave') || '1');
        
        console.log('GameOver - Current stored high score:', currentHighScore, 'wave:', currentHighWave); // Debug log
        
        // Check if new score is higher than the current high score
        if (this.finalScore > currentHighScore) {
            localStorage.setItem('highScore', this.finalScore.toString());
            console.log('GameOver - New high score saved:', this.finalScore); // Debug log
        }
        
        // Check if new wave is higher than the current high wave
        if (this.waveReached > currentHighWave) {
            localStorage.setItem('highWave', this.waveReached.toString());
            console.log('GameOver - New high wave saved:', this.waveReached); // Debug log
        }
        
        // Force localStorage to persist by manually triggering storage
        try {
            // This hack can help ensure localStorage is synced in some browsers
            const testValue = localStorage.getItem('test-storage') || '0';
            localStorage.setItem('test-storage', (parseInt(testValue) + 1).toString());
        } catch (e) {
            console.error('GameOver - Error accessing localStorage:', e);
        }
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get the highest score for comparison
        const highScore = parseInt(localStorage.getItem('highScore') || '0');
        const isNewHighScore = this.finalScore >= highScore;
        
        // Game over text
        const gameOverText = this.add.text(width / 2, height / 3, 'GAME OVER', {
            font: 'bold 64px Arial',
            fill: '#ff0000',
            stroke: '#000000',
            strokeThickness: 8
        });
        gameOverText.setOrigin(0.5);
        
        // Score display
        const scoreText = this.add.text(width / 2, height / 2, `Score: ${this.finalScore}`, {
            font: '32px Arial',
            fill: '#ffffff'
        });
        scoreText.setOrigin(0.5);
        
        // Wave display
        const waveText = this.add.text(width / 2, height / 2 + 50, `Wave: ${this.waveReached}`, {
            font: '28px Arial',
            fill: '#ffffff'
        });
        waveText.setOrigin(0.5);
        
        // Add "New High Score!" text if applicable
        if (isNewHighScore && this.finalScore > 0) {
            const newHighScoreText = this.add.text(width / 2, height / 2 + 100, 'NEW HIGH SCORE!', {
                font: 'bold 28px Arial',
                fill: '#ffff00',
                stroke: '#880088',
                strokeThickness: 2
            });
            newHighScoreText.setOrigin(0.5);
            
            // Add pulsing effect to the high score text
            this.tweens.add({
                targets: newHighScoreText,
                scale: { from: 1, to: 1.2 },
                alpha: { from: 1, to: 0.8 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }
        
        // Play again button
        const playAgainButton = this.add.text(width / 2, height / 2 + 150, 'PLAY AGAIN', {
            font: 'bold 32px Arial',
            fill: '#ffffff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#880088',
        });
        playAgainButton.setOrigin(0.5);
        playAgainButton.setInteractive({ useHandCursor: true });
        
        // Button hover effects
        playAgainButton.on('pointerover', () => {
            playAgainButton.setStyle({ fill: '#ff88ff' });
        });
        
        playAgainButton.on('pointerout', () => {
            playAgainButton.setStyle({ fill: '#ffffff' });
        });
        
        // Button click events
        playAgainButton.on('pointerup', () => {
            // Stop main music if playing
            if (this.sound.get('main-music')) {
                this.sound.stopByKey('main-music');
            }
            
            // Simply start the game scene fresh without emitting the reset event
            // This avoids cleanup issues with the physics world
            this.scene.start('Game');
        });
        
        // Main menu button
        const menuButton = this.add.text(width / 2, height / 2 + 220, 'MAIN MENU', {
            font: 'bold 28px Arial',
            fill: '#ffffff',
            padding: { x: 20, y: 10 },
            backgroundColor: '#555555',
        });
        menuButton.setOrigin(0.5);
        menuButton.setInteractive({ useHandCursor: true });
        
        // Button hover effects
        menuButton.on('pointerover', () => {
            menuButton.setStyle({ fill: '#aaaaaa' });
        });
        
        menuButton.on('pointerout', () => {
            menuButton.setStyle({ fill: '#ffffff' });
        });
        
        // Button click events
        menuButton.on('pointerup', () => {
            // Stop all sounds
            this.sound.stopAll();
            
            // Clean up resources
            this.events.removeAllListeners();
            
            // Reset inputs to prevent carry-over issues
            this.input.keyboard.enabled = true;
            this.input.keyboard.resetKeys();
            
            // Start title music with correct volume from localStorage
            const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.7');
            console.log("Starting title music with volume:", musicVolume);
            
            const titleMusic = this.sound.add('title-music', { 
                loop: true, 
                volume: musicVolume 
            });
            titleMusic.play();
            
            // Start MainMenu scene and ensure this scene is removed
            this.scene.start('MainMenu');
            this.scene.remove('GameOver');
        });
    }

    shutdown() {
        console.log('GameOver shutdown');
        
        // Clean up input handlers
        this.input.keyboard.removeAllKeys();
        this.input.keyboard.enabled = true;
        
        // Stop all audio
        this.sound.stopAll();
        
        // Remove all event listeners
        this.events.removeAllListeners();
        
        // Kill any active tweens
        this.tweens.killAll();
        
        // Call parent shutdown
        super.shutdown();
    }
} 