export default class UI {
    constructor(scene) {
        this.scene = scene;
        this.score = 0;
        this.wave = 1;
        this.dashCooldown = 0;
        this.dashDuration = 0;
        this.dashLastTime = 0;
        this.dashActive = false;
        this.dashBarWidth = 120;
        this.dashBarHeight = 16;
        this.dashBarMax = 2.0; // 2 seconds
        this.isDestroyed = false;
        
        // UI theme colors
        this.colors = {
            background: 0x000000,
            backgroundAlpha: 0.6,
            border: 0x3399ff,
            borderAlpha: 0.8,
            textMain: 0xffffff,
            textSecondary: 0xaaaaaa,
            healthGood: 0x00ff88,
            healthMedium: 0xffff00,
            healthLow: 0xff3333,
            dashColor: 0xffff00,
            forcefieldColor: 0x00aaff,
            phaseShiftColor: 0x8080ff
        };
        
        // Create UI elements
        this.createHealthBar();
        this.createScoreText();
        this.createWaveText();
        this.createDashCooldownCircle();
        this.createForcefieldCooldownCircle();
        this.createPhaseShiftCooldownCircle();
        
        // Listen for events to update UI
        this.setupEventListeners();
        
        // Make sure the UI is always on top
        this.setUIDepth(1000);
        
        // Debug information
        console.log("UI initialized at:", this.scene.cameras.main.width, this.scene.cameras.main.height);
        
        // Add a listener for scene shutdown to clean up resources
        this.scene.events.once('shutdown', this.onSceneShutdown, this);
    }
    
    setUIDepth(depth) {
        // Ensure all UI elements are on top
        this.healthContainer.setDepth(depth);
        this.scoreContainer.setDepth(depth);
        this.waveContainer.setDepth(depth);
        this.dashCircleContainer.setDepth(depth);
        this.forcefieldCircleContainer.setDepth(depth);
        this.phaseShiftCircleContainer.setDepth(depth);
    }
    
    createHealthBar() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Health bar container - position at the bottom right
        this.healthContainer = this.scene.add.container(width - 140, height - 40);
        
        // Backdrop panel with border
        this.healthPanel = this.scene.add.rectangle(
            0, 
            0, 
            230, 
            35, 
            this.colors.background, 
            this.colors.backgroundAlpha
        );
        this.healthPanel.setStrokeStyle(2, this.colors.border, this.colors.borderAlpha);
        this.healthPanel.setOrigin(0.5);
        this.healthContainer.add(this.healthPanel);
        
        // Health bar background
        this.healthBarBackground = this.scene.add.rectangle(
            0,
            0,
            200,
            20,
            0x111111,
            0.9
        );
        this.healthBarBackground.setOrigin(0.5);
        this.healthContainer.add(this.healthBarBackground);
        
        // Health bar fill
        this.healthBarFill = this.scene.add.rectangle(
            -99,
            0,
            198,
            18,
            this.colors.healthGood
        );
        this.healthBarFill.setOrigin(0, 0.5);
        this.healthContainer.add(this.healthBarFill);
        
        // Health text
        this.healthText = this.scene.add.text(
            -90,
            -0,
            'HP',
            {
                font: 'bold 15px Arial',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.healthText.setOrigin(0, 0.5);
        this.healthContainer.add(this.healthText);
        
        // Health percentage
        this.healthPercentText = this.scene.add.text(
            0,
            0,
            '100%',
            {
                font: 'bold 14px Arial',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.healthPercentText.setOrigin(0.5);
        this.healthContainer.add(this.healthPercentText);
    }
    
    createScoreText() {
        // Score container - position at the top right
        const width = this.scene.cameras.main.width;
        this.scoreContainer = this.scene.add.container(width - 110, 30);
        
        // Score background with border
        this.scoreBackground = this.scene.add.rectangle(
            0,
            0,
            190,
            40,
            this.colors.background,
            this.colors.backgroundAlpha
        );
        this.scoreBackground.setStrokeStyle(2, this.colors.border, this.colors.borderAlpha);
        this.scoreBackground.setOrigin(0.5);
        this.scoreContainer.add(this.scoreBackground);
        
        // Score text
        this.scoreText = this.scene.add.text(
            0,
            0,
            'SCORE: 0',
            {
                font: 'bold 22px Arial',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.scoreText.setOrigin(0.5);
        this.scoreContainer.add(this.scoreText);
        
        // Score increase indicator
        this.scoreIncreaseText = this.scene.add.text(
            0,
            -30,
            '',
            {
                font: 'bold 20px Arial',
                fill: '#ffff00',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.scoreIncreaseText.setOrigin(0.5);
        this.scoreContainer.add(this.scoreIncreaseText);
    }
    
    createWaveText() {
        // Wave container - position at the top left
        this.waveContainer = this.scene.add.container(100, 30);
        
        // Wave background with border
        this.waveBackground = this.scene.add.rectangle(
            0,
            0,
            170,
            40,
            this.colors.background,
            this.colors.backgroundAlpha
        );
        this.waveBackground.setStrokeStyle(2, this.colors.border, this.colors.borderAlpha);
        this.waveBackground.setOrigin(0.5);
        this.waveContainer.add(this.waveBackground);
        
        // Wave text
        this.waveText = this.scene.add.text(
            0,
            0,
            'WAVE: 1',
            {
                font: 'bold 22px Arial',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        this.waveText.setOrigin(0.5);
        this.waveContainer.add(this.waveText);
    }
    
    createDashCooldownCircle() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const radius = 28;
        // Container bottom left
        this.dashCircleContainer = this.scene.add.container(40, height - 40);
        // Background circle
        this.dashCircleBg = this.scene.add.graphics();
        this.dashCircleBg.lineStyle(4, 0x222222, 1);
        this.dashCircleBg.strokeCircle(0, 0, radius);
        this.dashCircleContainer.add(this.dashCircleBg);
        // Cooldown arc (drawn in update)
        this.dashCircleArc = this.scene.add.graphics();
        this.dashCircleContainer.add(this.dashCircleArc);
        // Keybind text
        this.dashCircleText = this.scene.add.text(0, 0, 'SHIFT', {
            font: 'bold 16px Arial',
            fill: '#ffffff',
            align: 'center'
        });
        this.dashCircleText.setOrigin(0.5);
        this.dashCircleContainer.add(this.dashCircleText);
        // Ready glow
        this.dashCircleGlow = this.scene.add.graphics();
        this.dashCircleContainer.add(this.dashCircleGlow);
        this.dashCircleGlow.setVisible(false);
        
        // Locked icon overlay
        this.dashLockedOverlay = this.scene.add.rectangle(0, 0, radius * 2, radius * 2, 0x000000, 0.7);
        this.dashLockedOverlay.setOrigin(0.5);
        this.dashCircleContainer.add(this.dashLockedOverlay);
        
        // Lock icon
        this.dashLockIcon = this.scene.add.text(0, 0, '🔒', {
            font: 'bold 20px Arial',
            fill: '#ffffff'
        });
        this.dashLockIcon.setOrigin(0.5);
        this.dashCircleContainer.add(this.dashLockIcon);
        
        // For update
        this.dashCircleContainer.setDepth(1000);
        this.scene.events.on('update', this.updateDashCircle, this);
    }
    
    createForcefieldCooldownCircle() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const radius = 28;
        // Container bottom left, next to dash
        this.forcefieldCircleContainer = this.scene.add.container(100, height - 40);
        // Background circle
        this.forcefieldCircleBg = this.scene.add.graphics();
        this.forcefieldCircleBg.lineStyle(4, 0x222222, 1);
        this.forcefieldCircleBg.strokeCircle(0, 0, radius);
        this.forcefieldCircleContainer.add(this.forcefieldCircleBg);
        // Cooldown arc (drawn in update)
        this.forcefieldCircleArc = this.scene.add.graphics();
        this.forcefieldCircleContainer.add(this.forcefieldCircleArc);
        // Keybind text
        this.forcefieldCircleText = this.scene.add.text(0, 0, 'Z', {
            font: 'bold 16px Arial',
            fill: '#ffffff',
            align: 'center'
        });
        this.forcefieldCircleText.setOrigin(0.5);
        this.forcefieldCircleContainer.add(this.forcefieldCircleText);
        // Ready glow
        this.forcefieldCircleGlow = this.scene.add.graphics();
        this.forcefieldCircleContainer.add(this.forcefieldCircleGlow);
        this.forcefieldCircleGlow.setVisible(false);
        
        // Locked icon overlay
        this.forcefieldLockedOverlay = this.scene.add.rectangle(0, 0, radius * 2, radius * 2, 0x000000, 0.7);
        this.forcefieldLockedOverlay.setOrigin(0.5);
        this.forcefieldCircleContainer.add(this.forcefieldLockedOverlay);
        
        // Lock icon
        this.forcefieldLockIcon = this.scene.add.text(0, 0, '🔒', {
            font: 'bold 20px Arial',
            fill: '#ffffff'
        });
        this.forcefieldLockIcon.setOrigin(0.5);
        this.forcefieldCircleContainer.add(this.forcefieldLockIcon);
        
        // For update
        this.forcefieldCircleContainer.setDepth(1000);
        this.scene.events.on('update', this.updateForcefieldCircle, this);
    }
    
    createPhaseShiftCooldownCircle() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const radius = 28;
        
        // Container bottom left, next to forcefield
        this.phaseShiftCircleContainer = this.scene.add.container(160, height - 40);
        
        // Background circle
        this.phaseShiftCircleBg = this.scene.add.graphics();
        this.phaseShiftCircleBg.lineStyle(4, 0x222222, 1);
        this.phaseShiftCircleBg.strokeCircle(0, 0, radius);
        this.phaseShiftCircleContainer.add(this.phaseShiftCircleBg);
        
        // Cooldown arc (drawn in update)
        this.phaseShiftCircleArc = this.scene.add.graphics();
        this.phaseShiftCircleContainer.add(this.phaseShiftCircleArc);
        
        // Keybind text
        this.phaseShiftCircleText = this.scene.add.text(0, 0, 'X', {
            font: 'bold 16px Arial',
            fill: '#ffffff',
            align: 'center'
        });
        this.phaseShiftCircleText.setOrigin(0.5);
        this.phaseShiftCircleContainer.add(this.phaseShiftCircleText);
        
        // Ready glow
        this.phaseShiftCircleGlow = this.scene.add.graphics();
        this.phaseShiftCircleContainer.add(this.phaseShiftCircleGlow);
        this.phaseShiftCircleGlow.setVisible(false);
        
        // Locked icon overlay
        this.phaseShiftLockedOverlay = this.scene.add.rectangle(0, 0, radius * 2, radius * 2, 0x000000, 0.7);
        this.phaseShiftLockedOverlay.setOrigin(0.5);
        this.phaseShiftCircleContainer.add(this.phaseShiftLockedOverlay);
        
        // Lock icon
        this.phaseShiftLockIcon = this.scene.add.text(0, 0, '🔒', {
            font: 'bold 20px Arial',
            fill: '#ffffff'
        });
        this.phaseShiftLockIcon.setOrigin(0.5);
        this.phaseShiftCircleContainer.add(this.phaseShiftLockIcon);
        
        // For update
        this.phaseShiftCircleContainer.setDepth(1000);
        this.scene.events.on('update', this.updatePhaseShiftCircle, this);
    }
    
    setupEventListeners() {
        // Listen for health changes
        this.scene.events.on('player-health-changed', this.updateHealthBar, this);
        
        // Listen for score changes
        this.scene.events.on('score-changed', this.updateScore, this);
        
        // Listen for wave changes
        this.scene.events.on('wave-changed', this.updateWave, this);
        
        // Listen for player dash
        this.scene.events.on('player-dash', this.onPlayerDash, this);
        
        // Listen for player forcefield
        this.scene.events.on('player-forcefield', this.onPlayerForcefield, this);
        
        // Listen for forcefield ended event
        this.scene.events.on('player-forcefield-ended', this.onPlayerForcefieldEnded, this);
        
        // Listen for player phase shift
        this.scene.events.on('player-phase-shift', this.onPlayerPhaseShift, this);
        
        // Listen for player phase shift ended
        this.scene.events.on('player-phase-shift-ended', this.onPlayerPhaseShiftEnded, this);
        
        // Listen for ability unlocks
        this.scene.events.on('ability-unlocked', this.onAbilityUnlocked, this);
        
        // Log when an event listener is triggered
        console.log("UI event listeners set up");
    }
    
    updateHealthBar(healthPercent) {
        console.log("UI Health update:", healthPercent);
        // Update health bar fill width based on percentage (0-1)
        const newWidth = 198 * healthPercent;
        this.healthBarFill.width = newWidth;
        
        // Update health percentage text
        const healthPercDisplay = Math.floor(healthPercent * 100);
        this.healthPercentText.setText(`${healthPercDisplay}%`);
        
        // Change color based on health level and animate
        if (healthPercent > 0.6) {
            this.healthBarFill.fillColor = this.colors.healthGood; // Green
        } else if (healthPercent > 0.3) {
            this.healthBarFill.fillColor = this.colors.healthMedium; // Yellow
        } else {
            this.healthBarFill.fillColor = this.colors.healthLow; // Red
            
            // Pulse animation for low health
            if (!this.healthPulseTween) {
                this.healthPulseTween = this.scene.tweens.add({
                    targets: this.healthBarFill,
                    alpha: { from: 1, to: 0.5 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
            }
        }
        
        // Stop pulse animation if health is above danger threshold
        if (healthPercent > 0.3 && this.healthPulseTween) {
            this.healthPulseTween.stop();
            this.healthPulseTween = null;
            this.healthBarFill.alpha = 1;
        }
        
        // Shake the health bar slightly when damaged
        this.scene.tweens.add({
            targets: this.healthPanel,
            scaleX: { from: 1.1, to: 1 },
            scaleY: { from: 1.1, to: 1 },
            duration: 100,
            ease: 'Bounce.Out'
        });
    }
    
    updateScore(score) {
        console.log("UI Score update:", score);
        // Calculate score increase
        const increase = score - this.score;
        this.score = score;
        
        // Update score text
        this.scoreText.setText(`SCORE: ${score.toLocaleString()}`);
        
        // Add a small scale animation for score changes
        this.scene.tweens.add({
            targets: this.scoreBackground,
            scale: { from: 1.2, to: 1 },
            duration: 200,
            ease: 'Cubic.easeOut'
        });
        
        // Show score increase if it's a positive change
        if (increase > 0) {
            this.scoreIncreaseText.setText(`+${increase.toLocaleString()}`);
            
            // Animate the score increase text
            this.scene.tweens.add({
                targets: this.scoreIncreaseText,
                y: { from: -30, to: -50 },
                alpha: { from: 1, to: 0 },
                scale: { from: 1, to: 1.5 },
                duration: 1000,
                onComplete: () => {
                    this.scoreIncreaseText.y = -30;
                    this.scoreIncreaseText.alpha = 1;
                    this.scoreIncreaseText.scale = 1;
                    this.scoreIncreaseText.setText('');
                }
            });
        }
    }
    
    updateWave(wave) {
        console.log("UI Wave update:", wave);
        this.wave = wave;
        this.waveText.setText(`WAVE: ${wave}`);
        
        // Add a small scale animation for wave changes
        this.scene.tweens.add({
            targets: this.waveBackground,
            scale: { from: 1.2, to: 1 },
            duration: 200,
            ease: 'Cubic.easeOut'
        });
        
        // Flash the wave background
        this.scene.tweens.add({
            targets: this.waveBackground,
            fillColor: { from: 0x880088, to: this.colors.background },
            alpha: { from: 0.8, to: this.colors.backgroundAlpha },
            duration: 500,
            ease: 'Sine.easeOut'
        });
    }
    
    onPlayerDash(data) {
        // Show glow when dashing
        this.dashCircleGlow.clear();
        this.dashCircleGlow.lineStyle(6, 0xffff00, 0.7);
        this.dashCircleGlow.strokeCircle(0, 0, 32);
        this.dashCircleGlow.setVisible(true);
        this.scene.time.delayedCall(data.duration, () => {
            this.dashCircleGlow.setVisible(false);
        });
    }
    
    onPlayerForcefield(data) {
        // Show glow when active
        this.forcefieldCircleGlow.clear();
        this.forcefieldCircleGlow.lineStyle(6, 0x00ffff, 0.7);
        this.forcefieldCircleGlow.strokeCircle(0, 0, 32);
        this.forcefieldCircleGlow.setVisible(true);
        
        // Hide the glow after a short flash
        this.scene.time.delayedCall(300, () => {
            this.forcefieldCircleGlow.setVisible(false);
        });
    }
    
    onPlayerForcefieldEnded(data) {
        // Hide the glow when forcefield ends
        this.forcefieldCircleGlow.setVisible(false);
        
        // Force update the cooldown arc immediately
        this.updateForcefieldCircle();
    }
    
    onPlayerPhaseShift(data) {
        // Show glow when phase shift is active
        this.phaseShiftCircleGlow.clear();
        this.phaseShiftCircleGlow.lineStyle(6, 0x8080ff, 0.7);
        this.phaseShiftCircleGlow.strokeCircle(0, 0, 32);
        this.phaseShiftCircleGlow.setVisible(true);
    }
    
    onPlayerPhaseShiftEnded(data) {
        // Hide the glow when phase shift ends
        this.phaseShiftCircleGlow.setVisible(false);
        
        // Force update the cooldown arc immediately
        this.updatePhaseShiftCircle();
    }
    
    onAbilityUnlocked(ability) {
        console.log("UI: Ability unlocked:", ability);
        
        // Update the UI to unlock the relevant ability icon
        switch(ability) {
            case 'dash':
                if (this.dashLockedOverlay) {
                    this.dashLockedOverlay.setVisible(false);
                }
                if (this.dashLockIcon) {
                    this.dashLockIcon.setVisible(false);
                }
                break;
            case 'forcefield':
                if (this.forcefieldLockedOverlay) {
                    this.forcefieldLockedOverlay.setVisible(false);
                }
                if (this.forcefieldLockIcon) {
                    this.forcefieldLockIcon.setVisible(false);
                }
                break;
            case 'phase-shift':
                if (this.phaseShiftLockedOverlay) {
                    this.phaseShiftLockedOverlay.setVisible(false);
                }
                if (this.phaseShiftLockIcon) {
                    this.phaseShiftLockIcon.setVisible(false);
                }
                break;
        }
        
        // Create a visual notification
        this.showAbilityUnlockedNotification(ability);
    }
    
    showAbilityUnlockedNotification(ability) {
        let abilityName, color;
        
        switch(ability) {
            case 'dash':
                abilityName = 'DASH (SHIFT)';
                color = 0xffff00;
                break;
            case 'forcefield':
                abilityName = 'FORCEFIELD (Z)';
                color = 0x00aaff;
                break;
            case 'phase-shift':
                abilityName = 'PHASE SHIFT (X)';
                color = 0x8080ff;
                break;
            case 'improved-thrusters':
                abilityName = 'IMPROVED THRUSTERS';
                color = 0xff8800;
                break;
            case 'full-heal':
                abilityName = 'EMERGENCY REPAIR';
                color = 0x00ff00;
                break;
            default:
                abilityName = 'NEW ABILITY';
                color = 0xffffff;
        }
        
        // Create notification at the top of the screen
        const notification = this.scene.add.container(
            this.scene.cameras.main.width / 2,
            80
        );
        notification.setDepth(1000);
        
        // Background
        const bg = this.scene.add.rectangle(0, 0, 300, 50, 0x000000, 0.7);
        bg.setStrokeStyle(2, color);
        notification.add(bg);
        
        // Title
        const title = this.scene.add.text(0, -10, 'ABILITY UNLOCKED', {
            font: 'bold 18px Arial',
            fill: '#ffffff'
        });
        title.setOrigin(0.5);
        notification.add(title);
        
        // Ability name
        const nameText = this.scene.add.text(0, 15, abilityName, {
            font: 'bold 22px Arial',
            fill: '#' + color.toString(16).padStart(6, '0')
        });
        nameText.setOrigin(0.5);
        notification.add(nameText);
        
        // Animate in
        notification.setAlpha(0);
        notification.y = 0;
        
        this.scene.tweens.add({
            targets: notification,
            y: 80,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Wait and fade out
                this.scene.time.delayedCall(2500, () => {
                    this.scene.tweens.add({
                        targets: notification,
                        y: 0,
                        alpha: 0,
                        duration: 300,
                        ease: 'Back.easeIn',
                        onComplete: () => {
                            notification.destroy();
                        }
                    });
                });
            }
        });
    }
    
    updateDashCircle() {
        // Guard clauses to prevent errors during scene transitions
        if (this.isDestroyed || !this.scene || !this.scene.player || !this.dashCircleText) return;
        
        try {
            const player = this.scene.player;
            
            // Check if ability is unlocked
            if (!player.hasDash) {
                return;
            }
            
            const now = this.scene.time.now;
            const cooldownLeft = player.getDashCooldownLeft(now);
            const percent = 1 - Math.min(1, cooldownLeft / 5.0);
            
            // Draw arc
            this.dashCircleArc.clear();
            if (percent < 1) {
                this.dashCircleArc.lineStyle(5, 0x00ff00, 1);
                this.dashCircleArc.beginPath();
                this.dashCircleArc.arc(0, 0, 32, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * percent), false);
                this.dashCircleArc.strokePath();
            } else {
                // Full circle when ready
                this.dashCircleArc.lineStyle(5, 0x00ff00, 1);
                this.dashCircleArc.strokeCircle(0, 0, 32);
            }
            
            // Keybind color
            if (player.isDashing()) {
                this.dashCircleText.setColor('#ffff00');
            } else if (cooldownLeft <= 0.01) {
                this.dashCircleText.setColor('#00ff00');
            } else {
                this.dashCircleText.setColor('#ffffff');
            }
        } catch (e) {
            console.error("Error in updateDashCircle:", e);
            // Unregister this update handler if there's an error
            if (this.scene) {
                this.scene.events.off('update', this.updateDashCircle, this);
            }
        }
    }
    
    updateForcefieldCircle() {
        // Guard clauses to prevent errors during scene transitions
        if (this.isDestroyed || !this.scene || !this.scene.player || !this.forcefieldCircleText) return;
        
        try {
            const player = this.scene.player;
            
            // Check if ability is unlocked
            if (!player.hasForcefield) {
                return;
            }
            
            const now = this.scene.time.now;
            const cooldownLeft = player.getForcefieldCooldownLeft(now);
            const percent = 1 - Math.min(1, cooldownLeft / 15.0); // 15 seconds cooldown
            
            // Draw arc
            this.forcefieldCircleArc.clear();
            if (percent < 1) {
                this.forcefieldCircleArc.lineStyle(5, 0x00aaff, 1);
                this.forcefieldCircleArc.beginPath();
                this.forcefieldCircleArc.arc(0, 0, 32, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * percent), false);
                this.forcefieldCircleArc.strokePath();
            } else {
                // Full circle when ready
                this.forcefieldCircleArc.lineStyle(5, 0x00aaff, 1);
                this.forcefieldCircleArc.strokeCircle(0, 0, 32);
            }
            
            // Keybind color
            if (cooldownLeft <= 0.01) {
                this.forcefieldCircleText.setColor('#00aaff');
            } else {
                this.forcefieldCircleText.setColor('#ffffff');
            }
        } catch (e) {
            console.error("Error in updateForcefieldCircle:", e);
            // Unregister this update handler if there's an error
            if (this.scene) {
                this.scene.events.off('update', this.updateForcefieldCircle, this);
            }
        }
    }
    
    updatePhaseShiftCircle() {
        // Guard clauses to prevent errors during scene transitions
        if (this.isDestroyed || !this.scene || !this.scene.player || !this.phaseShiftCircleText) return;
        
        try {
            const player = this.scene.player;
            
            // Check if ability is unlocked
            if (!player.hasPhaseShift) {
                return;
            }
            
            const now = this.scene.time.now;
            const cooldownLeft = player.getPhaseShiftCooldownLeft(now);
            const percent = 1 - Math.min(1, cooldownLeft / 15.0); // 15 seconds cooldown
            
            // Draw arc
            this.phaseShiftCircleArc.clear();
            if (percent < 1) {
                this.phaseShiftCircleArc.lineStyle(5, 0x8080ff, 1);
                this.phaseShiftCircleArc.beginPath();
                this.phaseShiftCircleArc.arc(0, 0, 32, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * percent), false);
                this.phaseShiftCircleArc.strokePath();
            } else {
                // Full circle when ready
                this.phaseShiftCircleArc.lineStyle(5, 0x8080ff, 1);
                this.phaseShiftCircleArc.strokeCircle(0, 0, 32);
            }
            
            // Keybind color
            if (player.isPhaseShiftActive()) {
                this.phaseShiftCircleText.setColor('#8080ff');
            } else if (cooldownLeft <= 0.01) {
                this.phaseShiftCircleText.setColor('#8080ff');
            } else {
                this.phaseShiftCircleText.setColor('#ffffff');
            }
        } catch (e) {
            console.error("Error in updatePhaseShiftCircle:", e);
            // Unregister this update handler if there's an error
            if (this.scene) {
                this.scene.events.off('update', this.updatePhaseShiftCircle, this);
            }
        }
    }
    
    onSceneShutdown() {
        console.log("UI cleanup on scene shutdown");
        this.isDestroyed = true;
        
        // Remove all event listeners
        this.scene.events.off('player-health-changed', this.updateHealthBar, this);
        this.scene.events.off('score-changed', this.updateScore, this);
        this.scene.events.off('wave-changed', this.updateWave, this);
        this.scene.events.off('player-dash', this.onPlayerDash, this);
        this.scene.events.off('player-forcefield', this.onPlayerForcefield, this);
        this.scene.events.off('player-forcefield-ended', this.onPlayerForcefieldEnded, this);
        this.scene.events.off('player-phase-shift', this.onPlayerPhaseShift, this);
        this.scene.events.off('player-phase-shift-ended', this.onPlayerPhaseShiftEnded, this);
        this.scene.events.off('update', this.updateDashCircle, this);
        this.scene.events.off('update', this.updateForcefieldCircle, this);
        this.scene.events.off('update', this.updatePhaseShiftCircle, this);
        
        // Null out references to scene objects
        this.scene = null;
    }
    
    getScore() {
        return this.score;
    }
    
    getWave() {
        return this.wave;
    }
} 