import Player from '../objects/Player.js';
import WaveManager from '../objects/WaveManager.js';
import UI from '../objects/UI.js';
import UpgradeScreen from '../objects/UpgradeScreen.js';

export default class Game extends Phaser.Scene {
    constructor() {
        super('Game');
        
        // Add sound debounce tracking
        this.lastPlayerHurtSound = 0;
        this.hurtSoundCooldown = 250; // ms between hurt sounds
    }

    preload() {
        // Force loading of ship sprites - using absolute paths
        this.load.image('normal_spaceship', 'assets/images/sprites/normal_spaceship.png');
        this.load.image('tank_spaceship-removebg-preview', 'assets/images/sprites/tank_spaceship-removebg-preview.png');
        this.load.image('speedy_spaceship-removebg-preview', 'assets/images/sprites/speedy_spaceship-removebg-preview.png');
        
        // Make sure the original player-ship texture is also loaded for backward compatibility
        this.load.image('player-ship', 'assets/images/player.png');
        
        // Load sound effects
        this.load.audio('player-shoot', 'assets/audio/sfx/shoot1.mp3');
        this.load.audio('enemy-shoot', 'assets/audio/sfx/shoot2.mp3');
        this.load.audio('enemy-death', 'assets/audio/sfx/enemydeath.mp3');
        this.load.audio('player-death', 'assets/audio/sfx/playerdeath.mp3');
        this.load.audio('player-damaged', 'assets/audio/sfx/playerdamaged.mp3');
        this.load.audio('thruster-hum', 'assets/audio/sfx/thrusterhum.mp3');
        this.load.audio('wave-complete', 'assets/audio/sfx/wavecomplete.mp3');
    }

    create() {
        // Stop any title music if still playing (in case of direct scene jump)
        if (this.sound.get('title-music')) {
            this.sound.stopByKey('title-music');
        }
        // Stop any main music that might be lingering
        if (this.sound.get('main-music')) {
            this.sound.stopByKey('main-music');
        }
        
        // Initialize game variables
        this.score = 0;
        this.gameOver = false;
        this.upgradeWaves = [2, 4, 6, 9]; // Waves after which upgrades are offered
        this.waitingForUpgrade = false;
        
        // Load sound volume from storage
        this.soundVolume = parseFloat(localStorage.getItem('soundVolume') || '0.8');
        
        // Make sure we have camera system initialized
        if (!this.cameras || !this.cameras.main) {
            console.log("Camera system not initialized, waiting for next frame");
            // Return early and schedule the rest of the initialization for the next frame
            this.time.delayedCall(10, () => this.finishCreate());
            return;
        }
        
        this.finishCreate();
    }
    
    finishCreate() {
        // Get music volume from storage (for the main music)
        const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.7');
        
        // Play looping main music
        this.mainMusic = this.sound.add('main-music', { loop: true, volume: musicVolume });
        this.mainMusic.play();
        
        // Initialize thruster sound with loop but paused initially
        this.thrusterSound = this.sound.add('thruster-hum', { loop: true, volume: this.soundVolume * 0.7 });
        
        // Create starfield background
        this.createStarfield();
        
        // Create player with the selected ship
        this.player = new Player(this, this.cameras.main.width / 2, this.cameras.main.height - 100);
        
        // Create wave manager
        this.waveManager = new WaveManager(this);
        
        // Create UI - create UI before other setup to ensure it's initialized properly
        this.ui = new UI(this);
        
        // Create upgrade screen
        this.upgradeScreen = new UpgradeScreen(this);
        
        // Set up input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.cursors.z = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.cursors.x = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.cursors.shift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.cursors.r = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        
        // Set up collisions
        this.setupCollisions();
        
        // Set up events
        this.setupEvents();
        
        // Start the first wave
        this.waveManager.startNextWave();
        
        // Initialize UI with initial values - adjust health based on ship type
        const healthPercent = this.player.health / this.player.maxHealth;
        this.events.emit('player-health-changed', healthPercent); // Initial health percentage
        this.events.emit('score-changed', 0); // Initial score at 0
        this.events.emit('wave-changed', 1); // Initial wave at 1
    }
    
    update(time, delta) {
        if (this.gameOver) return;
        
        // Don't update game if waiting for upgrade selection
        if (this.waitingForUpgrade) return;
        
        // Check for R key to reset/kill player
        if (Phaser.Input.Keyboard.JustDown(this.cursors.r)) {
            if (this.player && this.player.active) {
                // Set player health to 0 and trigger death
                this.player.health = 0;
                this.player.die();
            }
        }
        
        // Check for thruster sound based on movement controls
        if ((this.cursors.up.isDown || this.cursors.down.isDown || 
             this.cursors.left.isDown || this.cursors.right.isDown) && 
            !this.thrusterSound.isPlaying) {
            this.thrusterSound.play();
        } else if (!this.cursors.up.isDown && !this.cursors.down.isDown && 
                  !this.cursors.left.isDown && !this.cursors.right.isDown && 
                  this.thrusterSound.isPlaying) {
            this.thrusterSound.stop();
        }
        
        // Update player
        this.player.update(time, this.cursors);
        
        // Update wave manager
        this.waveManager.update(time, delta);
        
        // Update enemies
        const enemies = this.waveManager.getAllEnemies();
        enemies.forEach(enemy => {
            enemy.update(time, delta, this.player.x, this.player.y);
            
            // Check for bullet collisions with player
            this.physics.overlap(enemy.bullets, this.player, this.handleEnemyBulletHit, null, this);
        });

        // Check for player bullet collisions with enemies - add process callback to verify bullet is still active
        this.physics.overlap(
            this.player.bullets, 
            this.waveManager.enemyGroup, 
            this.handlePlayerBulletHit, 
            function(bullet, enemy) {
                // Only process collision if bullet is active, enabled, and hasn't hit anything yet
                // Also verify the enemy is active and can be damaged
                return bullet && bullet.active && bullet.body && bullet.body.enable && 
                       !bullet._hasHit && enemy && enemy.active;
            }, 
            this
        );
        
        // Check for direct collisions between player and enemies
        this.physics.overlap(this.player, this.waveManager.enemyGroup, this.handlePlayerEnemyCollision, null, this);
        
        // Update starfield
        this.updateStarfield(delta);
    }
    
    handlePlayerBulletHit(bullet, enemy) {
        // Disable the bullet completely - IMMEDIATELY set a flag to prevent further collisions
        bullet._hasHit = true;
        
        // Disable the bullet completely
        bullet.setActive(false);
        bullet.setVisible(false);
        
        // Disable the physics body completely
        if (bullet.body) {
            bullet.body.enable = false;
        }
        
        // Apply damage to the enemy
        enemy.damage(bullet.damage);
        
        // Create a small hit effect
        this.createBulletHitEffect(bullet.x, bullet.y);
    }
    
    handleEnemyBulletHit(player, bullet) {
        // If phase shift is active, bullets pass through the player
        if (player.phaseShiftActive) {
            // Create a small visual effect to show the bullet passing through
            this.createBulletPhaseEffect(bullet.x, bullet.y);
            return; // Skip damage
        }
        
        // Normal hit behavior
        bullet.setActive(false);
        bullet.setVisible(false);
        player.damage(bullet.damage);
        
        // Play damaged sound with debounce to prevent rapid sound repetition
        const currentTime = this.time.now;
        if (currentTime - this.lastPlayerHurtSound > this.hurtSoundCooldown) {
            this.sound.play('player-damaged', { volume: this.soundVolume });
            this.lastPlayerHurtSound = currentTime;
        }
    }
    
    handlePlayerEnemyCollision(player, enemy) {
        // If phase shift is active, player passes through enemies
        if (player.phaseShiftActive) {
            // Create a visual effect showing the player passing through
            this.createEnemyPhaseEffect(enemy.x, enemy.y);
            return; // Skip collision damage
        }
        
        player.damage(20); // Direct collision deals more damage
        enemy.damage(10);  // Enemy also takes some damage
        
        // Play damaged sound with debounce
        const currentTime = this.time.now;
        if (currentTime - this.lastPlayerHurtSound > this.hurtSoundCooldown) {
            this.sound.play('player-damaged', { volume: this.soundVolume });
            this.lastPlayerHurtSound = currentTime;
        }
    }
    
    setupCollisions() {
        // We now handle collisions in the update method using physics.overlap
        // This is more reliable than using physics.add.collider for fast-moving objects
    }
    
    setupEvents() {
        // Enemy defeated
        this.events.on('enemy-died', (points) => {
            // Update score
            this.score += points;
            this.events.emit('score-changed', this.score);
            
            // Play enemy death sound
            this.sound.play('enemy-death', { volume: this.soundVolume });
            
            // Notify wave manager
            this.waveManager.enemyDefeated();
        });
        
        // Enemy escaped (passed the player)
        this.events.on('enemy-escaped', () => {
            // Optional: Reduce score or player lives
            // this.score -= 50; // Penalty for letting enemy escape
            // this.events.emit('score-changed', this.score);
        });
        
        // Player died
        this.events.on('player-died', () => {
            this.gameOver = true;
            
            // Make absolutely sure thruster sound is stopped
            if (this.thrusterSound && this.thrusterSound.isPlaying) {
                this.thrusterSound.stop();
            }
            
            // Play player death sound
            this.sound.play('player-death', { volume: this.soundVolume });
            
            // Wait 2 seconds before showing game over screen
            this.time.delayedCall(2000, () => {
                if (this.mainMusic) {
                    this.mainMusic.stop();
                }
                
                // Save high score if this score is higher
                const currentHighScore = parseInt(localStorage.getItem('highScore') || '0');
                if (this.score > currentHighScore) {
                    localStorage.setItem('highScore', this.score.toString());
                }
                
                // Save high wave if this wave is higher
                const currentHighWave = parseInt(localStorage.getItem('highWave') || '1');
                if (this.waveManager.getCurrentWave() > currentHighWave) {
                    localStorage.setItem('highWave', this.waveManager.getCurrentWave().toString());
                }
                
                this.scene.start('GameOver', { score: this.score, wave: this.waveManager.getCurrentWave() });
            });
        });
        
        // Wave completed
        this.events.on('wave-completed', (waveNumber) => {
            // Play wave completion sound
            this.sound.play('wave-complete', { volume: this.soundVolume });
            
            // Wait a few seconds before showing upgrades to give player time to see the wave completion message
            this.time.delayedCall(2500, () => {
                // Show upgrades after every wave completion instead of specific waves
                this.showUpgrades();
            });
            
            // Note: We no longer check upgradeWaves.includes(waveNumber) since we want upgrades every wave
        });
        
        // Upgrade selection complete
        this.events.on('upgrade-selection-complete', () => {
            this.waitingForUpgrade = false;
            
            // Add a short delay before starting the next wave
            // This gives the player a moment to see what upgrade they got
            this.time.delayedCall(1500, () => {
                // Now that the player has selected an upgrade, start the next wave
                // This ensures the wave only starts after player has made a selection
                this.waveManager.startNextWave();
            });
        });
        
        // Update UI when ability is unlocked
        this.events.on('ability-unlocked', (ability) => {
            console.log(`Ability unlocked: ${ability}`);
            // Could update UI to show new ability
        });
        
        // Debugging: print when UI events are fired
        this.events.on('player-health-changed', (value) => {
            console.log('Health changed:', value);
        });
        
        this.events.on('score-changed', (value) => {
            console.log('Score changed:', value);
        });
    }
    
    createStarfield() {
        this.stars = [];
        
        // Create nebula backgrounds (large colored clouds)
        this.createNebulas();
        
        // Create 3 depth layers of stars for parallax effect
        for (let i = 0; i < 200; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            
            // Different sizes and speeds for different depths
            const depth = Phaser.Math.Between(0, 2);
            let size, speed, alpha;
            
            switch (depth) {
                case 0: // Far stars
                    size = 1;
                    speed = 0.5;
                    alpha = 0.5;
                    break;
                case 1: // Mid stars
                    size = 1.5;
                    speed = 1;
                    alpha = 0.7;
                    break;
                case 2: // Close stars
                    size = 2;
                    speed = 2;
                    alpha = 1;
                    break;
            }
            
            // Create star as a small circle
            const star = this.add.circle(x, y, size, 0xffffff, alpha);
            
            // Store star with its properties
            this.stars.push({
                sprite: star,
                speed: speed,
                depth: depth
            });
            
            // Set actual render depth
            star.setDepth(depth);
        }
    }
    
    createNebulas() {
        // Create a container for all nebula elements
        this.nebulas = [];
        
        // Create 3-5 colorful nebulas with different properties
        const nebulaColors = [0x3333aa, 0x5544aa, 0x442266, 0x661166, 0x993366];
        
        // Create several nebulas with random properties
        for (let i = 0; i < 4; i++) {
            // Random position within the screen but not in center (where gameplay happens)
            const xOffset = Phaser.Math.Between(-100, 100);
            const x = (i % 2 === 0) 
                ? Phaser.Math.Between(0, this.cameras.main.width * 0.3) + xOffset
                : Phaser.Math.Between(this.cameras.main.width * 0.7, this.cameras.main.width) + xOffset;
            
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            
            // Generate a random nebula cloud
            const nebulaSize = Phaser.Math.Between(150, 350);
            const nebulaAlpha = Phaser.Math.FloatBetween(0.05, 0.15);
            const color = Phaser.Utils.Array.GetRandom(nebulaColors);
            
            // Create the nebula as a gradient circle
            const nebula = this.add.circle(x, y, nebulaSize, color, nebulaAlpha);
            
            // Apply a blur filter for a softer look
            nebula.setBlendMode(Phaser.BlendModes.ADD);
            
            // Give each nebula a random slow drift - reduce speed range by 50%
            const speed = Phaser.Math.FloatBetween(0.05, 0.15);
            
            // Store nebula with its properties
            this.nebulas.push({
                sprite: nebula,
                speed: speed,
                initialY: y
            });
            
            // Set to background (below stars)
            nebula.setDepth(-1);
        }
    }
    
    updateStarfield(delta) {
        // Move stars to create parallax scrolling effect
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            star.sprite.y += star.speed * (delta / 16); // Normalize for ~60fps
            
            // Reset star position when it moves off screen
            if (star.sprite.y > this.cameras.main.height) {
                star.sprite.y = 0;
                star.sprite.x = Phaser.Math.Between(0, this.cameras.main.width);
            }
        }
        
        // Update nebula positions (much slower than stars)
        if (this.nebulas) {
            for (let i = 0; i < this.nebulas.length; i++) {
                const nebula = this.nebulas[i];
                // Reduce speed by 50% to make nebulae linger longer
                nebula.sprite.y += nebula.speed * (delta / 16) * 0.5;
                
                // Reset position when off screen
                if (nebula.sprite.y > this.cameras.main.height + 200) {
                    nebula.sprite.y = -200;
                    nebula.sprite.x = Phaser.Math.Between(0, this.cameras.main.width);
                }
            }
        }
    }
    
    // Update collision handling during the game
    updateCollisionGroups() {
        // Get all current enemies and update collision with player bullets
        const enemies = this.waveManager.getAllEnemies();
        
        // Reset collider for player bullets - use the same approach as in update method
        this.physics.overlap(
            this.player.bullets, 
            this.waveManager.enemyGroup, 
            this.handlePlayerBulletHit, 
            function(bullet, enemy) {
                // Only process collision if bullet is active and hasn't hit anything
                return bullet.active && bullet.body && bullet.body.enable && !bullet._hasHit;
            }, 
            this
        );
        
        // Reset collider for enemy bullets
        enemies.forEach(enemy => {
            this.physics.overlap(enemy.bullets, this.player, this.handleEnemyBulletHit, null, this);
        });
    }

    shutdown() {
        console.log("Game scene shutting down");
        
        // Stop background music
        if (this.mainMusic) {
            this.mainMusic.stop();
            this.mainMusic = null;
        }
        
        // Make absolutely sure thruster sound is stopped
        if (this.thrusterSound) {
            this.thrusterSound.stop();
            this.thrusterSound = null;
        }
        
        // Clean up active game objects
        if (this.waveManager) {
            this.waveManager.reset();
        }
        
        // Stop all other sounds that might be playing
        this.sound.stopAll();
        
        // Clean up player particle effects (ensures the emitters are properly destroyed)
        if (this.player && this.player.destroy) {
            this.player.destroy();
        }
        
        // Clean up UI if it exists
        if (this.ui) {
            this.ui = null;
        }
        
        // Clean up stars if they exist
        if (this.stars) {
            this.stars.forEach(star => {
                if (star.sprite) {
                    star.sprite.destroy();
                }
            });
            this.stars = null;
        }
        
        // Clean up nebulas if they exist
        if (this.nebulas) {
            this.nebulas.forEach(nebula => {
                if (nebula.sprite) {
                    nebula.sprite.destroy();
                }
            });
            this.nebulas = null;
        }
        
        // Remove all event listeners
        this.events.removeAllListeners();
        
        // Clean up physics - check if physics exists to avoid errors
        if (this.physics && this.physics.world) {
            // Safely destroy colliders if they exist
            if (this.physics.world.colliders) {
                this.physics.world.colliders.destroy();
            }
        }
        
        // Clean up input
        if (this.input && this.input.keyboard) {
            if (this.cursors && this.cursors.z) {
                this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.Z);
            }
            if (this.cursors && this.cursors.x) {
                this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.X);
            }
            if (this.cursors && this.cursors.r) {
                this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.R);
            }
        }
        this.cursors = null;
    }
    
    // Also implement scene transition hooks
    init() {
        console.log("Game scene init");
    }

    createBulletPhaseEffect(x, y) {
        // Create a small flash effect when bullets pass through the player during phase shift
        const phaseEffect = this.add.circle(x, y, 5, 0x8080ff, 0.7);
        phaseEffect.setBlendMode(Phaser.BlendModes.ADD);
        
        // Fade out and grow slightly
        this.tweens.add({
            targets: phaseEffect,
            alpha: 0,
            scale: 2,
            duration: 150,
            onComplete: () => {
                phaseEffect.destroy();
            }
        });
    }

    createEnemyPhaseEffect(x, y) {
        // Create a larger flash effect when player passes through an enemy
        const phaseEffect = this.add.circle(x, y, 15, 0x8080ff, 0.5);
        phaseEffect.setBlendMode(Phaser.BlendModes.ADD);
        
        // Add some particle effects
        const particles = this.add.particles('particle');
        const emitter = particles.createEmitter({
            x: x,
            y: y,
            speed: { min: 20, max: 40 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 300,
            quantity: 5,
            blendMode: Phaser.BlendModes.ADD,
            tint: 0x8080ff
        });
        
        // Stop emitting after a single burst
        this.time.delayedCall(50, () => {
            emitter.stop();
        });
        
        // Fade out and clean up
        this.tweens.add({
            targets: phaseEffect,
            alpha: 0,
            scale: 3,
            duration: 200,
            onComplete: () => {
                phaseEffect.destroy();
                // Give particles time to fade out before destroying
                this.time.delayedCall(300, () => {
                    particles.destroy();
                });
            }
        });
    }

    createBulletHitEffect(x, y) {
        // Create a small particle burst at hit location
        const particles = this.add.particles('particle');
        const emitter = particles.createEmitter({
            x: x,
            y: y,
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 200,
            quantity: 5,
            blendMode: 'ADD',
            tint: 0x00ffff
        });
        
        // One-time emission then destroy
        emitter.explode();
        
        // Remove particles after they're done
        this.time.delayedCall(300, () => {
            particles.destroy();
        });
    }

    showUpgrades() {
        this.waitingForUpgrade = true;
        
        // We only need 2 options now - a full heal and one upgrade
        const upgrades = this.player.getAvailableUpgrades(2);
        
        // Make sure to shuffle the upgrades array to prevent positional bias
        this.shuffleArray(upgrades);
        
        // Show upgrade screen
        this.upgradeScreen.showUpgrades(upgrades);
    }
    
    shuffleArray(array) {
        // Fisher-Yates shuffle algorithm
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

// Register shutdown and destroy events
// (at the end of the file, outside the class)
Phaser.Scene.prototype.shutdown = Phaser.Scene.prototype.shutdown || function() {};
Phaser.Scene.prototype.onShutdownOrDestroy = Phaser.Scene.prototype.onShutdownOrDestroy || function() {}; 