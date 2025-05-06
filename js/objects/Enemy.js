export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture = 'enemy-basic') {
        super(scene, x, y, texture);
        
        // Add enemy to the scene
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Base enemy properties
        this.health = 20;
        this.scoreValue = 100;
        this.speed = 100;
        this.bulletDamage = 10;
        this.fireRate = 2000; // ms between shots
        this.lastFired = 0;
        this.initialAttackDelay = 1000; // Default delay before first attack
        this.hasAttacked = false; // Flag to track if enemy has attacked yet
        
        // Movement variation
        this.movementType = Phaser.Math.Between(0, 2); // 0: straight, 1: sine wave, 2: zigzag
        this.startX = x; // Store initial X position for movement patterns
        this.moveTimer = 0; // Timer for movement calculations
        this.amplitude = Phaser.Math.Between(30, 70); // Movement wave amplitude
        this.frequency = Phaser.Math.FloatBetween(1.0, 2.5); // Movement wave frequency
        
        // Set up bullet group for enemy shots
        this.bullets = scene.physics.add.group({
            classType: EnemyBullet,
            maxSize: 10,
            runChildUpdate: true
        });
    }
    
    update(time, delta, playerX, playerY) {
        if (!this.active) return;
        
        // Update movement timer
        this.moveTimer += delta / 1000;
        
        // Basic movement pattern
        this.move(time, delta);
        
        // Shoot at player
        this.tryToShoot(time, playerX, playerY);
    }
    
    // Base movement pattern (to be overridden by subclasses)
    move(time, delta) {
        // Apply base downward movement
        const deltaSeconds = delta / 1000;
        this.y += this.speed * deltaSeconds;
        
        // Apply horizontal movement based on movement type
        switch (this.movementType) {
            case 0: // Straight down - no horizontal movement
                break;
                
            case 1: // Sine wave movement
                // Calculate horizontal position based on sine wave
                const xOffset = Math.sin(this.moveTimer * this.frequency) * this.amplitude;
                this.x = this.startX + xOffset;
                break;
                
            case 2: // Zigzag movement
                // Calculate horizontal position based on triangle wave
                const triangleWave = Math.abs((this.moveTimer * this.frequency) % 2 - 1) * 2 - 1;
                this.x = this.startX + triangleWave * this.amplitude;
                break;
        }
        
        // Keep enemy within screen bounds
        const halfWidth = this.width / 2;
        const screenWidth = this.scene.cameras.main.width;
        if (this.x < halfWidth) {
            this.x = halfWidth;
        } else if (this.x > screenWidth - halfWidth) {
            this.x = screenWidth - halfWidth;
        }
        
        // Deactivate if off-screen
        if (this.y > this.scene.cameras.main.height + 50) {
            this.setActive(false);
            this.setVisible(false);
        }
    }
    
    // Basic shooting pattern (can be overridden)
    tryToShoot(time, playerX, playerY) {
        // If this is the first shot, use initialAttackDelay
        if (!this.hasAttacked) {
            // Check if enough time has passed since spawning
            if (time > this.lastFired + this.initialAttackDelay) {
                this.shoot(playerX, playerY);
                this.lastFired = time;
                this.hasAttacked = true;
            }
        }
        // For subsequent shots, use regular fireRate
        else if (time > this.lastFired + this.fireRate) {
            this.shoot(playerX, playerY);
            this.lastFired = time;
        }
    }
    
    // Basic shooting implementation
    shoot(playerX, playerY) {
        const bullet = this.bullets.get(this.x, this.y + 20);
        
        if (bullet) {
            bullet.fire(this.x, this.y, playerX, playerY, this.bulletDamage);
            
            // Play shooting sound
            const volume = this.scene.soundVolume || 0.8;
            this.scene.sound.play('enemy-shoot', { volume: volume });
        }
    }
    
    damage(amount) {
        this.health -= amount;
        
        // Flash effect for taking damage
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 50,
            yoyo: true
        });
        
        // Check if enemy is destroyed
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        // Emit event to award score
        this.scene.events.emit('enemy-died', this.scoreValue);
        
        // Create explosion effect at enemy position
        this.createExplosionEffect();
        
        // Completely disable and disableBody the physics
        this.body.enable = false;
        this.disableBody(true, true);
        
        // Set inactive but still render the explosion
        this.setActive(false);
        
        // Immediate destruction - no delay
        if (this.scene && this.scene.children) {
            // Remove from any parent groups first
            if (this.parentContainer) {
                this.parentContainer.remove(this);
            }
            
            // Completely destroy the object
            this.destroy(true);
        }
    }
    
    createExplosionEffect() {
        // Create a particle explosion
        const particles = this.scene.add.particles('particle');
        
        // Configure the emitter
        const emitter = particles.createEmitter({
            x: this.x,
            y: this.y,
            speed: { min: 50, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            lifespan: { min: 300, max: 500 },
            blendMode: 'ADD',
            tint: [ 0xff0000, 0xff6600, 0xffff00 ],
            quantity: 20,
            on: false
        });
        
        // Emit all particles at once then destroy
        emitter.explode(30);
        
        // Add a bright flash at explosion center
        const flash = this.scene.add.circle(this.x, this.y, 30, 0xffffff, 0.8);
        
        // Scale and fade out the flash
        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                flash.destroy();
            }
        });
        
        // Destroy particles after animation completes
        this.scene.time.delayedCall(500, () => {
            particles.destroy();
        });
        
        // Add optional screen shake for larger enemies
        if (this.scoreValue >= 200) {
            const intensity = 0.003 + (this.scoreValue / 10000);
            this.scene.cameras.main.shake(100, intensity);
        }
        
        // Play explosion sound effect with random pitch for variety
        // const pitch = Phaser.Math.FloatBetween(0.8, 1.2);
        // this.scene.sound.play('explosion', { volume: 0.4, rate: pitch });
    }
}

// Basic enemy type
export class BasicEnemy extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy-basic');
        
        // Specific properties for this enemy type
        this.health = 20;
        this.scoreValue = 100;
        this.speed = 100;
        this.fireRate = 2000;
        this.initialAttackDelay = Phaser.Math.Between(500, 2000);
        
        // Basic enemies have simpler movement patterns (mostly straight down)
        // Choose movement type with weighted probability
        const rand = Math.random() * 10; // Scale of 10 for our weights
        if (rand < 7) { // 70% chance of straight movement
            this.movementType = 0;
        } else if (rand < 9) { // 20% chance of sine wave
            this.movementType = 1;
        } else { // 10% chance of zigzag
            this.movementType = 2;
        }
        this.amplitude = Phaser.Math.Between(20, 40); // Smaller amplitude
    }
    
    // Basic enemies just use the default movement behavior now
}

// Spread shooter enemy type
export class SpreadEnemy extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy-spread');
        
        // Spread shooter specific properties
        this.health = 30;
        this.scoreValue = 150;
        this.speed = 80;
        this.fireRate = 2500;
        this.bulletSpread = 3;
        this.spreadAngle = 15; // Degrees between bullets
        
        // Spread enemies have more diverse movement patterns
        // Choose movement type with weighted probability
        const rand = Math.random() * 10; // Scale of 10 for our weights
        if (rand < 3) { // 30% chance of straight movement
            this.movementType = 0;
        } else if (rand < 8) { // 50% chance of sine wave
            this.movementType = 1;
        } else { // 20% chance of zigzag
            this.movementType = 2;
        }
        this.amplitude = Phaser.Math.Between(40, 70); // Medium amplitude
        
        // Visual indicator for different enemy type (temporary)
        this.setTint(0xff00ff);
    }
    
    // Override the shoot method to fire a spread of bullets
    shoot(playerX, playerY) {
        // Calculate angle to player
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
        
        // Shoot multiple bullets in a spread pattern
        for (let i = 0; i < this.bulletSpread; i++) {
            // Calculate spread offset
            const spreadOffset = (i - (this.bulletSpread - 1) / 2) * (this.spreadAngle * Math.PI / 180);
            const finalAngle = angle + spreadOffset;
            
            // Create bullet
            const bullet = this.bullets.get(this.x, this.y + 20);
            
            if (bullet) {
                // Fire with calculated angle
                bullet.fireWithAngle(this.x, this.y, finalAngle, this.bulletDamage);
            }
        }
        
        // Play shooting sound (only once for all bullets)
        const volume = this.scene.soundVolume || 0.8;
        this.scene.sound.play('enemy-shoot', { volume: volume });
    }
}

// Circular shooter enemy type
export class CircularEnemy extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemy-circular');
        
        // Circular shooter specific properties
        this.health = 40;
        this.scoreValue = 200;
        this.speed = 50;
        this.fireRate = 3000;
        this.bulletCount = 8; // Number of bullets in the circular pattern
        
        // Circular enemies have more complex movement patterns
        // Choose movement type with weighted probability
        const rand = Math.random() * 10; // Scale of 10 for our weights
        if (rand < 2) { // 20% chance of straight movement
            this.movementType = 0;
        } else if (rand < 5) { // 30% chance of sine wave
            this.movementType = 1;
        } else { // 50% chance of zigzag
            this.movementType = 2;
        }
        this.amplitude = Phaser.Math.Between(50, 90); // Larger amplitude
        this.frequency = Phaser.Math.FloatBetween(1.5, 3.0); // Higher frequency
        
        // Visual indicator for different enemy type (temporary)
        this.setTint(0xff0000);
    }
    
    // Override shoot method to fire bullets in a circle
    shoot(playerX, playerY) {
        const angleStep = (2 * Math.PI) / this.bulletCount;
        
        // Shoot bullets in a circular pattern
        for (let i = 0; i < this.bulletCount; i++) {
            const angle = i * angleStep;
            
            // Create bullet
            const bullet = this.bullets.get(this.x, this.y);
            
            if (bullet) {
                // Fire with calculated angle
                bullet.fireWithAngle(this.x, this.y, angle, this.bulletDamage);
            }
        }
        
        // Play shooting sound (only once for all bullets)
        const volume = this.scene.soundVolume || 0.8;
        this.scene.sound.play('enemy-shoot', { volume: volume });
    }
}

class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'particle');
        
        this.speed = 300;
        this.lifespan = 2000;
        this.damage = 0;
    }
    
    fire(fromX, fromY, toX, toY, damage) {
        this.damage = damage;
        this.body.reset(fromX, fromY);
        
        // Set bullet appearance
        this.setActive(true);
        this.setVisible(true);
        this.setTint(0xff0000);
        this.setScale(1.5);
        
        // Calculate angle to player
        const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
        
        // Set velocity based on angle
        this.scene.physics.velocityFromRotation(angle, this.speed, this.body.velocity);
        
        // Auto destroy after lifespan
        this.scene.time.delayedCall(this.lifespan, () => {
            this.setActive(false);
            this.setVisible(false);
        });
    }
    
    fireWithAngle(fromX, fromY, angle, damage) {
        this.damage = damage;
        this.body.reset(fromX, fromY);
        
        // Set bullet appearance
        this.setActive(true);
        this.setVisible(true);
        this.setTint(0xff0000);
        this.setScale(1.5);
        
        // Set velocity based on provided angle
        this.scene.physics.velocityFromRotation(angle, this.speed, this.body.velocity);
        
        // Auto destroy after lifespan
        this.scene.time.delayedCall(this.lifespan, () => {
            this.setActive(false);
            this.setVisible(false);
        });
    }
    
    update(time, delta) {
        // Deactivate when off-screen
        if (this.y < -50 || this.y > this.scene.cameras.main.height + 50 ||
            this.x < -50 || this.x > this.scene.cameras.main.width + 50) {
            this.setActive(false);
            this.setVisible(false);
        }
    }
} 