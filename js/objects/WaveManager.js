import Enemy, { BasicEnemy, SpreadEnemy, CircularEnemy } from './Enemy.js';

export default class WaveManager {
    constructor(scene) {
        this.scene = scene;
        this.currentWave = 0;
        this.enemiesLeft = 0;
        this.enemyGroup = scene.physics.add.group();
        this.waveConfig = [];
        this.isWaveActive = false;
        this.timeBetweenWaves = 5000; // 5 seconds between waves
        this.waveStartDelay = 2000; // Delay before starting a wave
        this.waveTimer = null; // Timer for wave duration
        this.spawnTimer = null; // Timer for enemy spawning
        
        // Initialize wave configurations
        this.initWaveConfigurations();
    }
    
    initWaveConfigurations() {
        // Define configurations for each wave
        // Format: { 
        //   duration: milliseconds to survive, 
        //   enemyTypes: [{type: EnemyClass, spawn frequency in ms}],
        //   maxActiveEnemies: maximum number of enemies active at once
        // }
        this.waveConfig = [
            // Wave 1: 30 seconds, just basic enemies, easy
            {
                duration: 30000, // 30 seconds
                enemyTypes: [{ type: BasicEnemy, frequency: 2000 }], // Spawn every 2 seconds
                maxActiveEnemies: 8
            },
            // Wave 2: 45 seconds, basic enemies, faster spawn
            {
                duration: 45000, // 45 seconds
                enemyTypes: [{ type: BasicEnemy, frequency: 1500 }], // Spawn every 1.5 seconds
                maxActiveEnemies: 10
            },
            // Wave 3: 60 seconds, basic and spread enemies
            {
                duration: 60000, // 1 minute
                enemyTypes: [
                    { type: BasicEnemy, frequency: 2000 },
                    { type: SpreadEnemy, frequency: 3500 }
                ],
                maxActiveEnemies: 12
            },
            // Wave 4: 75 seconds, increased difficulty
            {
                duration: 75000, // 1 minute 15 seconds
                enemyTypes: [
                    { type: BasicEnemy, frequency: 1500 },
                    { type: SpreadEnemy, frequency: 3000 }
                ],
                maxActiveEnemies: 15
            },
            // Wave 5: 90 seconds, introduce circular enemies
            {
                duration: 90000, // 1 minute 30 seconds
                enemyTypes: [
                    { type: BasicEnemy, frequency: 1500 },
                    { type: SpreadEnemy, frequency: 2500 },
                    { type: CircularEnemy, frequency: 5000 }
                ],
                maxActiveEnemies: 18
            },
            // Wave 6: 105 seconds, more challenging
            {
                duration: 105000, // 1 minute 45 seconds
                enemyTypes: [
                    { type: BasicEnemy, frequency: 1200 },
                    { type: SpreadEnemy, frequency: 2200 },
                    { type: CircularEnemy, frequency: 4000 }
                ],
                maxActiveEnemies: 20
            },
            // Wave 7: 120 seconds (2 minutes), increasingly difficult
            {
                duration: 120000, // 2 minutes
                enemyTypes: [
                    { type: BasicEnemy, frequency: 1200 },
                    { type: SpreadEnemy, frequency: 2000 },
                    { type: CircularEnemy, frequency: 3500 }
                ],
                maxActiveEnemies: 22
            },
            // Wave 8: 135 seconds, bullet hell
            {
                duration: 135000, // 2 minutes 15 seconds
                enemyTypes: [
                    { type: BasicEnemy, frequency: 1000 },
                    { type: SpreadEnemy, frequency: 1800 },
                    { type: CircularEnemy, frequency: 3000 }
                ],
                maxActiveEnemies: 25
            },
            // Wave 9: 150 seconds, pre-boss wave
            {
                duration: 150000, // 2 minutes 30 seconds
                enemyTypes: [
                    { type: BasicEnemy, frequency: 900 },
                    { type: SpreadEnemy, frequency: 1500 },
                    { type: CircularEnemy, frequency: 2500 }
                ],
                maxActiveEnemies: 28
            },
            // Wave 10: 180 seconds, intense final wave
            {
                duration: 180000, // 3 minutes
                enemyTypes: [
                    { type: BasicEnemy, frequency: 800 },
                    { type: SpreadEnemy, frequency: 1200 },
                    { type: CircularEnemy, frequency: 2000 }
                ],
                maxActiveEnemies: 30
            }
        ];
    }
    
    startNextWave() {
        if (this.isWaveActive) return;
        
        this.currentWave++;
        
        // Check if there are more waves
        if (this.currentWave > this.waveConfig.length) {
            // Game completed - trigger victory condition
            this.scene.events.emit('game-completed');
            return;
        }
        
        // Get current wave configuration
        const waveData = this.waveConfig[this.currentWave - 1];
        
        // Clear any existing timers
        this.clearTimers();
        
        // Display wave start message
        this.displayWaveMessage(`WAVE ${this.currentWave}`);
        
        // Show wave duration in seconds
        const durationInSeconds = Math.floor(waveData.duration / 1000);
        this.displayWaveSubMessage(`Survive for ${durationInSeconds} seconds!`);
        
        // Delay the start of wave spawning
        this.scene.time.delayedCall(this.waveStartDelay, () => {
            this.isWaveActive = true;
            this.beginWaveTimer(waveData);
            this.beginEnemySpawning(waveData);
        });
        
        // Notify scene that wave has changed
        this.scene.events.emit('wave-changed', this.currentWave);
    }
    
    beginWaveTimer(waveData) {
        // Start timer for wave duration
        this.waveTimer = this.scene.time.delayedCall(waveData.duration, () => {
            this.completeWave();
        });
        
        // Create visual timer for player
        this.createWaveTimer(waveData.duration);
    }
    
    createWaveTimer(duration) {
        const width = this.scene.cameras.main.width;
        
        // Create timer container at top center
        this.timerContainer = this.scene.add.container(width / 2, 50);
        this.timerContainer.setDepth(1000);
        
        // Background for timer
        this.timerBg = this.scene.add.rectangle(0, 0, 200, 30, 0x000000, 0.6);
        this.timerBg.setStrokeStyle(2, 0xffffff);
        this.timerContainer.add(this.timerBg);
        
        // Text for timer
        const seconds = Math.floor(duration / 1000);
        this.timerText = this.scene.add.text(0, 0, `${seconds}s`, {
            font: 'bold 20px Arial',
            fill: '#ffffff'
        });
        this.timerText.setOrigin(0.5);
        this.timerContainer.add(this.timerText);
        
        // Update timer every second
        this.updateTimer(duration);
    }
    
    updateTimer(remainingTime) {
        if (!this.isWaveActive || !this.timerText) return;
        
        const seconds = Math.ceil(remainingTime / 1000);
        this.timerText.setText(`${seconds}s`);
        
        // Color changes based on time left
        if (seconds <= 10) {
            this.timerText.setColor('#ff0000'); // Red for last 10 seconds
        } else if (seconds <= 30) {
            this.timerText.setColor('#ffff00'); // Yellow for last 30 seconds
        }
        
        // Schedule next update in 1 second if time remains
        if (remainingTime > 1000) {
            this.scene.time.delayedCall(1000, () => {
                this.updateTimer(remainingTime - 1000);
            });
        }
    }
    
    beginEnemySpawning(waveData) {
        // Set up spawn timers for each enemy type with staggered starts
        waveData.enemyTypes.forEach((enemyType, index) => {
            // Stagger the initial spawn of different enemy types
            const initialDelay = index * 800;
            
            this.scene.time.delayedCall(initialDelay, () => {
                if (this.isWaveActive) {
                    this.scheduleEnemySpawn(enemyType.type, enemyType.frequency, waveData.maxActiveEnemies);
                }
            });
        });
    }
    
    scheduleEnemySpawn(EnemyType, frequency, maxActiveEnemies) {
        if (!this.isWaveActive) return;
        
        // Add some randomness to the next spawn time (±30% of the frequency)
        const randomVariation = frequency * 0.3;
        const randomizedFrequency = Math.max(300, frequency + Phaser.Math.Between(-randomVariation, randomVariation));
        
        // Always schedule the next spawn regardless of current enemy count
        this.spawnTimer = this.scene.time.delayedCall(randomizedFrequency, () => {
            if (this.isWaveActive) {
                this.scheduleEnemySpawn(EnemyType, frequency, maxActiveEnemies);
            }
        });
        
        // Only spawn a new enemy if below max limit
        if (this.enemyGroup.getLength() < maxActiveEnemies) {
            // Spawn the enemy at a random x position at the top of the screen
            const x = Phaser.Math.Between(80, this.scene.cameras.main.width - 80);
            const y = -30; // Just above the visible screen
            
            // Create enemy and add to group
            const enemy = new EnemyType(this.scene, x, y);
            
            // Assign a random initial attack delay to prevent synchronized attacks
            if (enemy.initialAttackDelay !== undefined) {
                // Override the enemy's initial attack delay with a random value
                enemy.initialAttackDelay = Phaser.Math.Between(300, 1500);
            }
            
            this.enemyGroup.add(enemy);
        }
    }
    
    completeWave() {
        // Don't increment wave counter here, as it's already incremented in startNextWave
        // this.currentWave++;

        // Kill all remaining enemies with a visual effect
        this.clearAllEnemies();
        
        // Increase difficulty
        this.increaseDifficulty();
        
        // Add visual feedback
        this.createWaveCompleteFlash();
        
        // Reset the wave timer and update wave configuration
        this.resetWaveTimer();
        
        // Emit wave completed event with the current wave number
        this.scene.events.emit('wave-completed', this.currentWave);
        
        // Display wave completed message
        this.displayWaveMessage(`WAVE ${this.currentWave} COMPLETED!`);
    }
    
    createWaveCompleteFlash() {
        // Create a full-screen flash for wave completion
        const flash = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0xffff00,
            0.3
        );
        
        // Add a pulsing fade-out animation
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 1000,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                flash.destroy();
            }
        });
    }
    
    clearTimers() {
        // Clear any existing timers
        if (this.waveTimer) {
            this.waveTimer.remove();
            this.waveTimer = null;
        }
        
        if (this.spawnTimer) {
            this.spawnTimer.remove();
            this.spawnTimer = null;
        }
    }
    
    displayWaveMessage(text) {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Create wave text
        const waveText = this.scene.add.text(width / 2, height / 2, text, {
            font: 'bold 64px Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        });
        waveText.setOrigin(0.5);
        waveText.setDepth(1000); // Ensure it's on top
        
        // Animate the text
        this.scene.tweens.add({
            targets: waveText,
            alpha: { from: 0, to: 1 },
            duration: 500,
            yoyo: true,
            hold: 1000,
            onComplete: () => {
                waveText.destroy();
            }
        });
    }
    
    displayWaveSubMessage(text) {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Create wave sub-text
        const subText = this.scene.add.text(width / 2, height / 2 + 70, text, {
            font: '32px Arial',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
        });
        subText.setOrigin(0.5);
        subText.setDepth(1000); // Ensure it's on top
        
        // Animate the text
        this.scene.tweens.add({
            targets: subText,
            alpha: { from: 0, to: 1 },
            duration: 500,
            yoyo: true,
            hold: 1000,
            onComplete: () => {
                subText.destroy();
            }
        });
    }
    
    enemyDefeated() {
        // We don't need to track enemies for wave completion anymore,
        // but we'll keep this method for score updates and other possible uses
    }
    
    // Fisher-Yates shuffle algorithm
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    getAllEnemies() {
        return this.enemyGroup.getChildren();
    }
    
    getCurrentWave() {
        return this.currentWave;
    }
    
    getWaveDuration() {
        if (this.currentWave <= 0 || this.currentWave > this.waveConfig.length) {
            return 0;
        }
        return this.waveConfig[this.currentWave - 1].duration;
    }
    
    getRemainingTime() {
        if (!this.waveTimer || !this.isWaveActive) {
            return 0;
        }
        
        const elapsed = this.waveTimer.getElapsed();
        const duration = this.getWaveDuration();
        return Math.max(0, duration - elapsed);
    }
    
    reset() {
        // Clear any existing enemies
        this.enemyGroup.clear(true, true);
        
        // Clear timers
        this.clearTimers();
        
        // Clean up timer display
        if (this.timerContainer) {
            this.timerContainer.destroy();
            this.timerContainer = null;
        }
        
        // Reset wave data
        this.currentWave = 0;
        this.enemiesLeft = 0;
        this.isWaveActive = false;
    }
    
    update(time, delta) {
        // Check for enemies that have moved off-screen
        if (this.enemyGroup && this.enemyGroup.getChildren().length > 0) {
            this.enemyGroup.getChildren().forEach(enemy => {
                // Check if enemy has moved beyond the bottom of the screen
                if (enemy.y > this.scene.cameras.main.height + 50) {
                    // Remove from group and destroy
                    this.enemyGroup.remove(enemy);
                    enemy.destroy();
                    
                    // Optional: Emit event for scoring/lives
                    this.scene.events.emit('enemy-escaped');
                }
            });
        }
    }
    
    clearAllEnemies() {
        // Get all current enemies
        const enemies = this.getAllEnemies();
        
        // Clear all enemy bullets
        this.clearAllEnemyBullets(enemies);
        
        // Create destruction effects for each enemy
        enemies.forEach(enemy => {
            if (enemy && enemy.active) {
                // Create an explosion effect at the enemy's position
                this.createEnemyDestructionEffect(enemy.x, enemy.y);
                
                // Deactivate the enemy
                enemy.setActive(false);
                enemy.setVisible(false);
            }
        });
        
        // Clear the enemy group
        this.enemyGroup.clear(true, true);
    }
    
    clearAllEnemyBullets(enemies) {
        // Loop through all enemies and clear their bullets
        enemies.forEach(enemy => {
            if (enemy && enemy.bullets) {
                enemy.bullets.getChildren().forEach(bullet => {
                    if (bullet && bullet.active) {
                        // Create a small fade-out effect for each bullet
                        this.createBulletFadeEffect(bullet.x, bullet.y);
                        
                        // Deactivate the bullet
                        bullet.setActive(false);
                        bullet.setVisible(false);
                    }
                });
                
                // Clear the bullet group
                enemy.bullets.clear(true, true);
            }
        });
    }
    
    createBulletFadeEffect(x, y) {
        // Create a small particle effect for bullet fade
        const particles = this.scene.add.particles('particle');
        
        // Create a subtle particle effect
        const emitter = particles.createEmitter({
            x: x,
            y: y,
            speed: { min: 10, max: 30 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 300,
            blendMode: Phaser.BlendModes.ADD,
            tint: 0xffffaa, // Light yellow color
            quantity: 3
        });
        
        // Single burst
        emitter.explode(3, x, y);
        
        // Destroy particles after effect completes
        this.scene.time.delayedCall(300, () => {
            particles.destroy();
        });
    }
    
    createEnemyDestructionEffect(x, y) {
        // Create a particle effect for enemy destruction
        const particles = this.scene.add.particles('particle');
        
        // Create particle emitter for explosion effect
        const emitter = particles.createEmitter({
            x: x,
            y: y,
            speed: { min: 50, max: 150 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            blendMode: Phaser.BlendModes.ADD,
            tint: [0xff0000, 0xff5500, 0xffaa00, 0xffff00], // Fire colors
            quantity: 10,
            angle: { min: 0, max: 360 } // Explode in all directions
        });
        
        // Stop emitting after a burst
        this.scene.time.delayedCall(100, () => {
            emitter.stop();
        });
        
        // Destroy the particles after they fade out
        this.scene.time.delayedCall(600, () => {
            particles.destroy();
        });
    }
    
    increaseDifficulty() {
        // This method increases difficulty parameters for the next wave
        // It's called when a wave is completed
        
        // You can adjust various parameters here to make the game harder
        // For example, increase enemy speed, bullet speed, etc.
        
        // Emit an event to inform the game that difficulty has increased
        this.scene.events.emit('difficulty-increased', this.currentWave);
    }
    
    resetWaveTimer() {
        // Clear the wave timer if it exists
        if (this.waveTimer) {
            this.waveTimer.remove();
            this.waveTimer = null;
        }
        
        // Remove the timer display
        if (this.timerContainer) {
            this.timerContainer.destroy();
            this.timerContainer = null;
        }
        
        // Set wave to inactive to prepare for next wave
        this.isWaveActive = false;
        
        // Don't automatically schedule the next wave
        // The Game scene will call startNextWave when ready after upgrade selection
        // This prevents the next wave from starting while player is choosing upgrades
    }
} 