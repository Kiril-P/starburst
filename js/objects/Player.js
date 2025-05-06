export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        // Load the selected ship type from localStorage
        const selectedShip = localStorage.getItem('selectedShip') || 'normal';
        
        // Map ship type to correct texture key
        let textureKey;
        switch(selectedShip) {
            case 'normal':
                textureKey = 'normal_spaceship';
                break;
            case 'tank':
                textureKey = 'tank_spaceship-removebg-preview';
                break;
            case 'speedy':
                textureKey = 'speedy_spaceship-removebg-preview';
                break;
            default:
                textureKey = 'player-ship'; // Fallback
        }
        
        // Create with the mapped texture key
        super(scene, x, y, textureKey);
        
        // Add player to the scene
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Store ship type
        this.shipType = selectedShip;
        
        // Base player properties - will be adjusted based on ship type
        this.health = 100;
        this.maxHealth = 100;
        this.baseSpeed = 430;
        this.speed = this.baseSpeed;
        this.acceleration = 60;
        this.deceleration = 30;
        this.maxSpeedDiagonal = this.speed * 0.8;
        this.fireRate = 500; // Changed from 200 to 500ms (0.5 seconds)
        this.lastFired = 0;
        this.bulletDamage = 20;
        this.invulnerable = false;
        this.invulnerabilityTime = 1000;
        
        // Apply ship-specific stats
        this.applyShipStats();
        
        // Ability unlocks - all start as false
        this.hasDash = false;
        this.hasPhaseShift = false;
        this.hasForcefield = false;
        
        // Upgrade tracking
        this.availableUpgrades = ['dash', 'phase-shift', 'forcefield', 'improved-thrusters'];
        this.activeUpgrades = [];
        
        // Dash ability (disabled by default)
        this.dashCooldown = 5000; // ms between dashes (5s)
        this.dashDuration = 200; // ms dash duration (0.2s)
        this.dashSpeed = 900; // dash speed
        this.dashing = false;
        this.lastDash = -Infinity;
        this.dashDirection = { x: 0, y: 0 };
        
        // Forcefield ability (disabled by default)
        this.forcefieldCooldown = 15000; // ms (15s)
        this.lastForcefield = -Infinity;
        this.forcefieldActive = false;
        
        // Phase Shift ability (disabled by default)
        this.phaseShiftCooldown = 15000; // 15 seconds between phase shifts
        this.phaseShiftDuration = 3000; // 3 seconds of intangibility
        this.lastPhaseShift = -Infinity;
        this.phaseShiftActive = false;
        this.phaseEffectSprites = []; // Store phase effect sprites
        
        // Visual dash effect
        this.dashEffectTween = null;
        
        // Apply specific ship scale and hitbox
        this.setShipPhysics();
        
        // Set the correct rotation adjustment based on ship type
        this.setShipRotation();
        
        // Set world boundary collision
        this.setCollideWorldBounds(true);
        
        // Current velocity components
        this.velocityX = 0;
        this.velocityY = 0;
        this.facing = { x: 0, y: -1 }; // Default facing up
        this.lastMovingDirection = { x: 0, y: -1 }; // Track last movement for idle state
        
        // Create trail particle emitter
        this.createTrail();
        
        // Set up bullet group for player shots
        this.bullets = scene.physics.add.group({
            classType: PlayerBullet,
            maxSize: 30,
            runChildUpdate: true
        });
    }
    
    // Apply ship-specific stats based on selected ship type
    applyShipStats() {
        switch (this.shipType) {
            case 'tank_spaceship-removebg-preview':
            case 'tank':
                // Tank: Higher health, slower speed
                this.health = 150;
                this.maxHealth = 150;
                this.baseSpeed = 300; // Slower
                this.speed = this.baseSpeed;
                this.acceleration = 40; // Slower acceleration
                this.deceleration = 20; // Slower deceleration
                this.bulletDamage = 25; // Higher damage
                this.fireRate = 650; // Slower fire rate (0.65 seconds)
                this.bulletColor = 0xff0000; // Red bullets for tank
                break;
                
            case 'speedy_spaceship-removebg-preview':
            case 'speedy':
                // Speedy: Lower health, faster speed
                this.health = 70;
                this.maxHealth = 70;
                this.baseSpeed = 550; // Faster
                this.speed = this.baseSpeed;
                this.acceleration = 80; // Quicker acceleration
                this.deceleration = 50; // Quicker deceleration
                this.bulletDamage = 15; // Lower damage
                this.fireRate = 400; // Faster fire rate (0.4 seconds)
                this.bulletColor = 0x00ff99; // Green bullets for speedy
                break;
                
            case 'normal_spaceship':
            case 'normal':
            default:
                // Normal: Balanced stats (already set as defaults)
                this.health = 100;
                this.maxHealth = 100;
                this.baseSpeed = 430;
                this.speed = this.baseSpeed;
                this.acceleration = 60;
                this.deceleration = 30;
                this.bulletDamage = 20;
                this.fireRate = 500; // Medium fire rate (0.5 seconds)
                this.bulletColor = 0x00ffff; // Blue bullets for normal
                break;
        }
    }
    
    // Set ship-specific physics properties (scale, hitbox)
    setShipPhysics() {
        switch (this.shipType) {
            case 'tank_spaceship-removebg-preview':
            case 'tank':
                // Tank: 500x500 image
                this.setScale(0.2); // Adjusted scale for 500x500 image
                // Larger hitbox but still smaller than visual
                this.body.setSize(this.width * 0.6, this.height * 0.6);
                this.body.setOffset(this.width * 0.2, this.height * 0.2);
                break;
                
            case 'speedy_spaceship-removebg-preview':
            case 'speedy':
                // Speedy: 500x500 image
                this.setScale(0.15); // Adjusted scale for 500x500 image
                // Much smaller hitbox
                this.body.setSize(this.width * 0.4, this.height * 0.4);
                this.body.setOffset(this.width * 0.3, this.height * 0.3);
                break;
                
            case 'normal_spaceship':
            case 'normal':
            default:
                // Normal: 1000x1000 image - needs smaller scale to match others
                this.setScale(0.09); // Adjusted scale for 1000x1000 image
                // Standard hitbox
                this.body.setSize(this.width * 0.5, this.height * 0.5);
                this.body.setOffset(this.width * 0.25, this.height * 0.25);
                break;
        }
    }
    
    // Set ship-specific rotation adjustment
    setShipRotation() {
        // Different ships may need different base rotations
        // based on their sprite orientation
        switch (this.shipType) {
            case 'tank_spaceship-removebg-preview':
            case 'tank':
                this.rotationAdjustment = 0; // No adjustment needed
                break;
                
            case 'speedy_spaceship-removebg-preview':
            case 'speedy':
                this.rotationAdjustment = 0; // No adjustment needed
                break;
                
            case 'normal_spaceship':
            case 'normal':
            default:
                this.rotationAdjustment = 0; // Default value
                break;
        }
        
        // Apply initial rotation to point upward
        this.setRotation(this.rotationAdjustment);
        }
        
    createTrail() {
        // Create a particle manager
        this.particles = this.scene.add.particles('particle');
        
        // Set trail color based on ship type
        let trailTint = 0x00aaff; // Default blue
        let trailScale = 0.6; // Default size
        let trailOffset = -20; // Default position behind ship
        
        switch(this.shipType) {
            case 'tank_spaceship-removebg-preview':
            case 'tank':
                trailTint = 0xff0000; // Red for tank
                trailScale = 0.8; // Larger trail
                trailOffset = -30; // Further back due to larger ship
                break;
            case 'speedy_spaceship-removebg-preview':
            case 'speedy':
                trailTint = 0x00ff99; // Green for speedy
                trailScale = 0.5; // Smaller trail
                trailOffset = -15; // Closer due to smaller ship
                break;
            case 'normal_spaceship':
            case 'normal':
                trailTint = 0x00aaff; // Blue for normal
                trailScale = 0.6; // Medium trail
                trailOffset = -20; // Standard offset
                break;
        }
        
        // Store trail properties for later use
        this.trailProperties = {
            tint: trailTint,
            scale: trailScale,
            offset: trailOffset
        };
        
        // Create emitter configuration
        this.trailEmitter = this.particles.createEmitter({
            x: this.x,
            y: this.y,
            speed: { min: 10, max: 30 },
            angle: { min: 0, max: 360 },
            scale: { start: trailScale, end: 0 },
            lifespan: { min: 300, max: 500 },
            blendMode: 'ADD',
            tint: trailTint,
            alpha: { start: 0.6, end: 0 },
            quantity: 1,
            on: false // Start turned off
        });
    }
    
    updateRotation() {
        // Calculate target angle based on facing direction
        if (this.facing.x !== 0 || this.facing.y !== 0) {
            // Remember last moving direction for when we stop
            this.lastMovingDirection = { ...this.facing };
            
            // Calculate angle in radians from the facing vector
            const angle = Math.atan2(this.facing.y, this.facing.x);
            
            // Convert to degrees and add 90 degrees (since ship points up by default)
            const angleDegrees = Phaser.Math.RadToDeg(angle) + 90;
            
            // Set the player's rotation with adjustment for sprite orientation
            this.setRotation(Phaser.Math.DegToRad(angleDegrees) + this.rotationAdjustment);
        }
    }
    
    updateTrail() {
        // Make sure the emitter exists
        if (!this.trailEmitter) return;
        
        // Adjust emitter position based on player's rotation
        const speed = Math.sqrt(this.body.velocity.x * this.body.velocity.x + this.body.velocity.y * this.body.velocity.y);
        
        // Only emit particles if moving fast enough
        if (speed > 50) {
            // Calculate position behind the player based on rotation
            const angle = this.rotation - Math.PI/2; // Adjust for ship's default orientation
            const offsetX = Math.cos(angle) * this.trailProperties.offset; // Use ship-specific offset
            const offsetY = Math.sin(angle) * this.trailProperties.offset;
            
            // Update emitter position
            this.trailEmitter.setPosition(this.x + offsetX, this.y + offsetY);
            
            // Adjust quantity based on speed (higher speed = more particles)
            const quantity = Math.min(3, Math.max(1, Math.floor(speed / 150)));
            this.trailEmitter.setQuantity(quantity);
            
            // Start emitting if not already active
            if (!this.trailEmitter.on) {
                this.trailEmitter.on = true;
            }
        } else {
            // Stop emitting when player is still
            if (this.trailEmitter && this.trailEmitter.on) {
                this.trailEmitter.on = false;
            }
        }
    }
    
    handleImprovedMovement(cursors) {
        // Target velocity based on input
        let targetVelocityX = 0;
        let targetVelocityY = 0;
        let speed = this.baseSpeed;
        
        // Horizontal movement
        if (cursors.left.isDown) {
            targetVelocityX = -speed;
        } else if (cursors.right.isDown) {
            targetVelocityX = speed;
        }
        
        // Vertical movement
        if (cursors.up.isDown) {
            targetVelocityY = -speed;
        } else if (cursors.down.isDown) {
            targetVelocityY = speed;
        }
        
        // Normalize diagonal movement
        if (targetVelocityX !== 0 && targetVelocityY !== 0) {
            const normalizedSpeed = speed * 0.8;
            const angle = Math.atan2(targetVelocityY, targetVelocityX);
            targetVelocityX = Math.cos(angle) * normalizedSpeed;
            targetVelocityY = Math.sin(angle) * normalizedSpeed;
        }
        
        // Save facing direction if moving
        if (targetVelocityX !== 0 || targetVelocityY !== 0) {
            const mag = Math.sqrt(targetVelocityX * targetVelocityX + targetVelocityY * targetVelocityY);
            this.facing.x = targetVelocityX / mag;
            this.facing.y = targetVelocityY / mag;
        }
        
        // Apply acceleration and deceleration
        if (targetVelocityX !== 0) {
            // Accelerate
            if (Math.sign(this.velocityX) !== Math.sign(targetVelocityX)) {
                // If changing direction, decelerate faster
                this.velocityX = Phaser.Math.Linear(this.velocityX, targetVelocityX, this.deceleration * 2 / 100);
            } else {
                this.velocityX = Phaser.Math.Linear(this.velocityX, targetVelocityX, this.acceleration / 100);
            }
        } else {
            // Decelerate
            this.velocityX = Phaser.Math.Linear(this.velocityX, 0, this.deceleration / 100);
            if (Math.abs(this.velocityX) < 5) this.velocityX = 0;
        }
        
        if (targetVelocityY !== 0) {
            // Accelerate
            if (Math.sign(this.velocityY) !== Math.sign(targetVelocityY)) {
                // If changing direction, decelerate faster
                this.velocityY = Phaser.Math.Linear(this.velocityY, targetVelocityY, this.deceleration * 2 / 100);
            } else {
                this.velocityY = Phaser.Math.Linear(this.velocityY, targetVelocityY, this.acceleration / 100);
            }
        } else {
            // Decelerate
            this.velocityY = Phaser.Math.Linear(this.velocityY, 0, this.deceleration / 100);
            if (Math.abs(this.velocityY) < 5) this.velocityY = 0;
        }
        
        // Set the final velocity
        this.setVelocity(this.velocityX, this.velocityY);
    }
    
    tryDash(time) {
        if (time - this.lastDash < this.dashCooldown) return;
        
        this.dashing = true;
        this.lastDash = time;
        
        // Set invulnerable during dash
        this.invulnerable = true;
        
        // Determine dash direction based on current movement or facing
        if (this.velocityX !== 0 || this.velocityY !== 0) {
            // Normalize from current velocity
            const mag = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            this.dashDirection.x = this.velocityX / mag;
            this.dashDirection.y = this.velocityY / mag;
        } else {
            // Use facing direction
            this.dashDirection.x = this.facing.x;
            this.dashDirection.y = this.facing.y;
        }
        
        // Add visual flash effect for dash activation
        this.createDashEffect();
        
        // End dash after duration
        this.scene.time.delayedCall(this.dashDuration, () => {
            this.dashing = false;
                this.invulnerable = false;
            });
    }
    
    createDashEffect() {
        // Create a motion blur effect
        const blur = this.scene.add.rectangle(
            this.x, 
            this.y, 
            this.width * 1.5, 
            this.height * 1.5, 
            0x00ffff, 
            0.7
        );
        blur.setRotation(this.rotation);
        blur.setBlendMode(Phaser.BlendModes.ADD);
        
        // Create a white flash at player position
        const flash = this.scene.add.circle(this.x, this.y, 40, 0xffffff, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        
        // Animate both effects
        this.scene.tweens.add({
            targets: [blur, flash],
            alpha: 0,
            scaleX: 0.1,
            scaleY: 0.1,
            duration: 200,
            onComplete: () => {
                blur.destroy();
                flash.destroy();
            }
        });
        
        // Sound effect for dash
        // this.scene.sound.play('dash', { volume: 0.3 });
    }
    
    tryForcefield(time) {
        if (time - this.lastForcefield < this.forcefieldCooldown) return;
        
        this.lastForcefield = time;
        
        // Emit event for UI
        this.scene.events.emit('player-forcefield', { 
            cooldown: this.forcefieldCooldown,
            time: time 
        });
        
        // Create activation flash effect
        this.createForcefieldActivationEffect();
        
        // Clear all bullets on screen
        this.clearAllBullets();
    }
    
    clearAllBullets() {
        // Get all enemies from wave manager
        const enemies = this.scene.waveManager.getAllEnemies();
        
        // Clear all bullets from each enemy
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (enemy && enemy.bullets) {
                enemy.bullets.getChildren().forEach(bullet => {
                    if (bullet && bullet.active) {
                        bullet.setActive(false);
                        bullet.setVisible(false);
                    }
                });
            }
        }
    }
    
    createForcefieldActivationEffect() {
        // Create a bright flash that expands outward
        const flash = this.scene.add.circle(this.x, this.y, 10, 0x00ffff, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        
        // Create shockwave effect
        this.scene.tweens.add({
            targets: flash,
            scale: 25, // Larger scale for full screen effect
            alpha: 0,
            duration: 400,
            onComplete: () => {
                flash.destroy();
            }
        });
        
        // Add screen flash effect
        const screenFlash = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x00ffff,
            0.3 // Slightly stronger flash
        );
        screenFlash.setDepth(1000);
        screenFlash.setBlendMode(Phaser.BlendModes.ADD);
        
        // Fade out screen flash
        this.scene.tweens.add({
            targets: screenFlash,
            alpha: 0,
            duration: 250,
            onComplete: () => {
                screenFlash.destroy();
            }
        });
        
        // Add camera shake for impact
        this.scene.cameras.main.shake(200, 0.02);
        
        // Sound effect for forcefield
        // this.scene.sound.play('forcefield-activate', { volume: 0.4 });
    }
    
    shoot(time) {
        if (time > this.lastFired + this.fireRate) {
            // Calculate bullet spawn position based on rotation and ship type
            const angle = this.rotation - Math.PI/2; // Adjust for ship's default orientation
            
            // Adjust bullet spawn position based on ship type
            let offsetDistance = 20; // Default offset distance
            
            // Ship-specific bullet offsets
            switch(this.shipType) {
                case 'tank_spaceship-removebg-preview':
                case 'tank':
                    offsetDistance = 30; // Longer ship needs bullets to spawn further forward
                    break;
                case 'speedy_spaceship-removebg-preview':
                case 'speedy':
                    offsetDistance = 15; // Smaller ship spawns bullets closer
                    break;
            }
            
            const offsetX = Math.cos(angle) * -offsetDistance; // Offset in front of the player
            const offsetY = Math.sin(angle) * -offsetDistance;
            
            // Create a bullet from the pool
            const bullet = this.bullets.get(this.x + offsetX, this.y + offsetY);
            
            if (bullet) {
                // Fire the bullet in the direction the player is facing
                bullet.fire(this.bulletDamage, angle);
                this.lastFired = time;
                
                // Play shooting sound effect
                const volume = this.scene.soundVolume || 0.8;
                this.scene.sound.play('player-shoot', { volume: volume });
            }
        }
    }
    
    damage(amount) {
        if (this.invulnerable || this.forcefieldActive) return;
        
        this.health -= amount;
        
        // Clamp health to 0 minimum
        if (this.health < 0) this.health = 0;
        
        // Flash effect for taking damage
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 3
        });
        
        // Temporary invulnerability
        this.setInvulnerable();
        
        // Check if player is dead
        if (this.health <= 0) {
            this.die();
        }
        
        // Emit health changed event for UI updates
        // This sends the health as a percentage (0-1) for the UI to use
        this.scene.events.emit('player-health-changed', this.health / this.maxHealth);
        
        // Enhanced screen shake effect - intensity based on damage amount
        const intensity = Math.min(0.05, 0.01 + (amount / 100) * 0.04);
        const duration = Math.min(300, 100 + (amount * 5));
        this.scene.cameras.main.shake(duration, intensity);
        
        // Play damage sound effect
        // this.scene.sound.play('player-hit', { volume: 0.5 });
    }
    
    setInvulnerable() {
        this.invulnerable = true;
        // If already dashing, don't schedule end here
        if (!this.dashing) {
            this.scene.time.delayedCall(this.invulnerabilityTime, () => {
                this.invulnerable = false;
            });
        }
    }
    
    die() {
        // Play death animation
        this.setActive(false);
        this.setVisible(false);
        
        // Make sure thruster sound stops
        if (this.scene.thrusterSound && this.scene.thrusterSound.isPlaying) {
            this.scene.thrusterSound.stop();
        }
        
        // Create explosion effect at player position
        // Will add particle effect later
        
        // Notify game scene
        this.scene.events.emit('player-died');
    }
    
    reset() {
        this.health = this.maxHealth;
        this.setActive(true);
        this.setVisible(true);
        this.invulnerable = false;
        
        // Reset rotation to default
        this.setRotation(0);
        
        // Make sure trail emitter is stopped
        if (this.trailEmitter) {
            this.trailEmitter.on = false;
        }
    }
    
    // Call this when destroying the player
    destroy() {
        // Clean up trail emitter
        if (this.trailEmitter) {
            this.trailEmitter.on = false;
            this.trailEmitter = null;
        }
        
        if (this.particles) {
            this.particles.destroy();
            this.particles = null;
        }
        
        // Call the parent destroy method
        super.destroy();
    }
    
    // Helper for UI
    getDashCooldownLeft(currentTime) {
        return Math.max(0, (this.lastDash + this.dashCooldown - currentTime) / 1000);
    }
    
    getForcefieldCooldownLeft(currentTime) {
        return Math.max(0, (this.lastForcefield + this.forcefieldCooldown - currentTime) / 1000);
    }
    
    isDashing() {
        return this.dashing;
    }
    
    isForcefieldActive() {
        return this.forcefieldActive;
    }
    
    tryPhaseShift(time) {
        if (time - this.lastPhaseShift < this.phaseShiftCooldown) return;
        
        this.lastPhaseShift = time;
        this.phaseShiftActive = true;
        
        // Set player to lower depth to appear behind enemies
        const originalDepth = this.depth;
        this.setDepth(-1);
        
        // Emit event for UI
        this.scene.events.emit('player-phase-shift', { 
            cooldown: this.phaseShiftCooldown,
            duration: this.phaseShiftDuration, 
            time: time 
        });
        
        // Visual effect for phase shift
        this.createPhaseShiftEffect();
        
        // Make player alpha partially transparent
        this.scene.tweens.add({
            targets: this,
            alpha: 0.4,
            duration: 200,
            onComplete: () => {
                // Hold transparency during the effect
            }
        });
        
        // End phase shift after duration
        this.scene.time.delayedCall(this.phaseShiftDuration, () => {
            this.phaseShiftActive = false;
            
            // Restore original depth
            this.setDepth(originalDepth);
            
            // Emit end event for UI
            this.scene.events.emit('player-phase-shift-ended', {
                time: time + this.phaseShiftDuration
            });
            
            // Return to normal
            this.scene.tweens.add({
                targets: this,
                alpha: 1,
                duration: 200
            });
            
            // Clean up phase effect sprites
            this.phaseEffectSprites.forEach(sprite => {
                if (sprite) sprite.destroy();
            });
            this.phaseEffectSprites = [];
        });
    }
    
    createPhaseShiftEffect() {
        // Create a ghost/phase effect
        const phaseParticles = this.scene.add.particles('particle');
        
        // Create a ghostly trail
        const emitter = phaseParticles.createEmitter({
            x: this.x,
            y: this.y,
            follow: this,
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.5, end: 0 },
            speed: { min: 5, max: 20 },
            lifespan: 600,
            blendMode: Phaser.BlendModes.ADD,
            tint: 0x8080ff, // Blue-ish purple
            frequency: 20,
            quantity: 2
        });
        
        // Store for cleanup
        this.phaseEffectSprites.push(phaseParticles);
        
        // Add afterimage effect
        this.createPhaseAfterimage();
        
        // Add screen effect
        const screenFlash = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x8080ff,
            0.15
        );
        screenFlash.setDepth(1000);
        screenFlash.setBlendMode(Phaser.BlendModes.ADD);
        
        // Fade out screen flash
        this.scene.tweens.add({
            targets: screenFlash,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                screenFlash.destroy();
            }
        });
        
        // Optional sound effect
        // this.scene.sound.play('phase-shift', { volume: 0.4 });
    }
    
    createPhaseAfterimage() {
        // Create 3 afterimages that follow with delay
        for (let i = 1; i <= 3; i++) {
            const delay = i * 100;
            const alpha = 0.7 - (i * 0.2);
            
            // Schedule creation of afterimage
            this.scene.time.delayedCall(delay, () => {
                // Skip if phase shift ended
                if (!this.phaseShiftActive) return;
                
                const afterimage = this.scene.add.sprite(this.x, this.y, 'player-ship');
                afterimage.setAlpha(alpha);
                afterimage.setScale(this.scale);
                afterimage.setRotation(this.rotation);
                afterimage.setTint(0x8080ff);
                afterimage.setBlendMode(Phaser.BlendModes.ADD);
                
                // Store for cleanup
                this.phaseEffectSprites.push(afterimage);
                
                // Fade out and remove
                this.scene.tweens.add({
                    targets: afterimage,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        afterimage.destroy();
                        const index = this.phaseEffectSprites.indexOf(afterimage);
                        if (index > -1) {
                            this.phaseEffectSprites.splice(index, 1);
                        }
                    }
                });
            });
        }
    }
    
    getPhaseShiftCooldownLeft(currentTime) {
        return Math.max(0, (this.lastPhaseShift + this.phaseShiftCooldown - currentTime) / 1000);
    }
    
    isPhaseShiftActive() {
        return this.phaseShiftActive;
    }
    
    // New methods for upgrade system
    unlockAbility(ability) {
        switch(ability) {
            case 'dash':
                this.hasDash = true;
                this.scene.events.emit('ability-unlocked', 'dash');
                break;
            case 'phase-shift':
                this.hasPhaseShift = true;
                this.scene.events.emit('ability-unlocked', 'phase-shift');
                break;
            case 'forcefield':
                this.hasForcefield = true;
                this.scene.events.emit('ability-unlocked', 'forcefield');
                break;
            case 'improved-thrusters':
                // Permanent speed boost
                this.baseSpeed += 100;
                this.speed = this.baseSpeed;
                this.scene.events.emit('ability-unlocked', 'improved-thrusters');
                break;
            case 'full-heal':
                // Restore player to full health
                this.health = this.maxHealth;
                this.scene.events.emit('player-health-changed', this.health / this.maxHealth);
                this.scene.events.emit('ability-unlocked', 'full-heal');
                break;
        }
        
        // Add to active upgrades and remove from available
        if (ability !== 'full-heal') {
            this.activeUpgrades.push(ability);
            const index = this.availableUpgrades.indexOf(ability);
            if (index > -1) {
                this.availableUpgrades.splice(index, 1);
            }
        }
    }
    
    getAvailableUpgrades(count) {
        // For all upgrade screens, we want to offer a full heal and one other ability
        const upgrades = [];
        
        // Always add full-heal as the first option
        upgrades.push('full-heal');
        
        // If we have available upgrades, add a random one
        if (this.availableUpgrades.length > 0) {
            // Use a proper seeded random for more variety
            const seed = Date.now();
            const random = () => {
                // Simple PRNG to avoid any predictability
                const x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };
            
            // Get a truly random index
            const randomIndex = Math.floor(random() * this.availableUpgrades.length);
            upgrades.push(this.availableUpgrades[randomIndex]);
        } else {
            // If no upgrades left, add a second full heal
            upgrades.push('full-heal');
        }
        
        // If we need more options (for 3-option screens), add another random or full-heal
        if (count > 2 && this.availableUpgrades.length > 1) {
            // Get a different random upgrade
            let availableCopy = [...this.availableUpgrades];
            // Remove the one we already added
            availableCopy = availableCopy.filter(upgrade => upgrade !== upgrades[1]);
            
            const randomIndex = Math.floor(Math.random() * availableCopy.length);
            upgrades.push(availableCopy[randomIndex]);
        } else if (count > 2) {
            // Just add another full heal if we don't have enough unique upgrades
            upgrades.push('full-heal');
        }
        
        // Log for debugging
        console.log("Available upgrades:", this.availableUpgrades);
        console.log("Offering upgrade options:", upgrades);
        
        return upgrades;
    }
    
    update(time, cursors) {
        if (!this.active) return;
        
        // Handle dash - only if unlocked
        if (this.hasDash && !this.dashing && cursors.shift && Phaser.Input.Keyboard.JustDown(cursors.shift)) {
            this.tryDash(time);
        }
        
        // Handle forcefield - only if unlocked
        if (this.hasForcefield && cursors.z && Phaser.Input.Keyboard.JustDown(cursors.z)) {
            this.tryForcefield(time);
        }
        
        // Handle phase shift - only if unlocked
        if (this.hasPhaseShift && !this.phaseShiftActive && cursors.x && Phaser.Input.Keyboard.JustDown(cursors.x)) {
            this.tryPhaseShift(time);
        }
        
        // Handle movement
        if (!this.dashing) {
            this.handleImprovedMovement(cursors);
        } else {
            // During dash, maintain dash velocity
            this.setVelocity(this.dashDirection.x * this.dashSpeed, this.dashDirection.y * this.dashSpeed);
        }
        
        // Handle shooting - changed from isDown to JustDown to require clicking
        if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
            this.shoot(time);
        }
        
        // Update player rotation to face movement direction
        this.updateRotation();
        
        // Update trail emitter
        this.updateTrail();
    }
}

class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'particle');
        
        this.speed = 700;
        this.lifespan = 2000;
        this.damage = 0;
        this._hasHit = false; // Flag to track if bullet has hit something
    }
    
    fire(damage, angle) {
        this.damage = damage;
        this.body.reset(this.x, this.y);
        
        // Reset hit flag
        this._hasHit = false;
        
        // Set bullet appearance
        this.setActive(true);
        this.setVisible(true);
        
        // Ensure the physics body is properly enabled
        this.body.enable = true;
        
        // Set the body size to match the visual appearance
        this.body.setSize(this.width * 0.8, this.height * 0.8);
        
        // Get ship-specific bullet color from player if available
        let bulletColor = 0x00ffff; // Default cyan
        if (this.scene.player && this.scene.player.bulletColor) {
            bulletColor = this.scene.player.bulletColor;
        }
        
        // Enhanced visuals for bullets - brighter tint and glow effect
        this.setTint(bulletColor);
        this.setBlendMode(Phaser.BlendModes.ADD);
        
        // Adjust bullet orientation
        if (angle !== undefined) {
            this.setRotation(angle);
            
            // Calculate velocity components from angle
            const vx = Math.cos(angle) * -this.speed;
            const vy = Math.sin(angle) * -this.speed;
        
            // Set velocity based on angle
            this.setVelocity(vx, vy);
            
            // Enhanced bullet appearance - longer trail effect
            const bulletLength = 4;
            const bulletWidth = 2.5;
            this.setScale(bulletWidth, bulletLength);
            
            // Add particle trail effect for bullets
            this.createBulletTrail();
        } else {
            // Default up direction if no angle specified (backward compatibility)
            this.setVelocityY(-this.speed);
            this.setScale(2.5, 4);
            this.createBulletTrail();
        }
        
        // Auto destroy after lifespan
        this.scene.time.delayedCall(this.lifespan, () => {
            this.deactivate();
        });
    }
    
    createBulletTrail() {
        // Only create trail if it doesn't exist yet
        if (this.trail) return;
        
        // Get ship-specific color
        let trailColor = 0x00ffff; // Default cyan
        
        // Use player's bullet color if available
        if (this.scene.player && this.scene.player.bulletColor) {
            trailColor = this.scene.player.bulletColor;
        }
        
        // Create a short trail effect using graphics
        const trail = this.scene.add.graphics();
        trail.fillStyle(trailColor, 0.7);
        
        // Store reference to the trail
        this.trail = trail;
        
        // Update the trail in the scene update loop
        this.scene.events.on('update', this.updateTrail, this);
    }
    
    updateTrail() {
        if (!this.active || !this.trail) return;
        
        // Clear previous trail
        this.trail.clear();
        
        // Get trail length based on velocity
        const speed = Math.sqrt(this.body.velocity.x * this.body.velocity.x + this.body.velocity.y * this.body.velocity.y);
        const trailLength = Math.min(speed * 0.05, 20);
        
        // Calculate trail position (behind the bullet)
        const angle = this.rotation;
        const trailX = this.x + Math.cos(angle) * trailLength/2;
        const trailY = this.y + Math.sin(angle) * trailLength/2;
        
        // Draw the trail as an elongated ellipse
        this.trail.fillStyle(this.tintTopLeft, 0.7);
        this.trail.fillEllipse(trailX, trailY, 3, trailLength);
    }
    
    deactivate() {
        // Skip if already deactivated
        if (!this.active) return;
        
        // Completely disable the bullet
        this.setActive(false);
        this.setVisible(false);
        
        // Important: Disable the physics body to prevent further collisions
        if (this.body) {
            this.body.enable = false;
        }
        
        // Clean up trail
        if (this.trail) {
            this.scene.events.off('update', this.updateTrail, this);
            this.trail.clear();
            this.trail.destroy();
            this.trail = null;
        }
    }
    
    update(time, delta) {
        // Skip update if inactive or has hit something
        if (!this.active || this._hasHit) {
            return;
        }
        
        // Deactivate when off-screen - check all screen edges
        const screenWidth = this.scene.cameras.main.width;
        const screenHeight = this.scene.cameras.main.height;
        
        if (this.y < -50 || this.y > screenHeight + 50 || 
            this.x < -50 || this.x > screenWidth + 50) {
            this.deactivate();
        }
    }
} 