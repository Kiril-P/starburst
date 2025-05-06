export default class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu');
        this.titleMusicStarted = false;
        this.scorePanel = null; // Store reference to score panel for updates
        this.settingsPanel = null; // Store reference to settings panel
        this.settingsVisible = false; // Track if settings panel is visible
        this.taskListPanel = null; // Store reference to task list panel
        this.taskListVisible = false; // Track if task list is visible
        this.shipSelectionPanel = null; // Store reference to ship selection panel
        this.shipSelectionVisible = false; // Track if ship selection panel is visible
        
        // Ship data with stats
        this.ships = [
            { 
                id: 'normal', 
                name: 'PULSAR',
                sprite: 'normal_spaceship',
                description: 'Balanced performance for all pilots',
                speed: 0.7, // 70% of max
                hp: 0.6,    // 60% of max
                fireRate: 0.7, // 70% of max (medium fire rate)
                scale: 0.5  // Display scale for menu
            },
            { 
                id: 'tank', 
                name: 'TITAN',
                sprite: 'tank_spaceship-removebg-preview',
                description: 'Heavy armor, slower movement',
                speed: 0.4, // 40% of max
                hp: 1.0,    // 100% of max
                fireRate: 0.4, // 40% of max (slow fire rate)
                scale: 0.6  // Display scale for menu
            },
            { 
                id: 'speedy', 
                name: 'NOVA DART',
                sprite: 'speedy_spaceship-removebg-preview',
                description: 'Lightning fast, reduced defenses',
                speed: 1.0, // 100% of max
                hp: 0.3,    // 30% of max
                fireRate: 1.0, // 100% of max (fastest fire rate)
                scale: 0.45 // Display scale for menu (smaller)
            }
        ];
        
        // Current selected ship index
        this.selectedShipIndex = 0;
        
        // Define tasks - stored as static property for easy reference elsewhere
        this.tasks = [
            { id: 'score25k', description: 'Reach high score of 25,000', type: 'score', target: 25000 },
            { id: 'score50k', description: 'Reach high score of 50,000', type: 'score', target: 50000 },
            { id: 'score100k', description: 'Reach high score of 100,000', type: 'score', target: 100000 },
            { id: 'wave5', description: 'Reach Wave 5', type: 'wave', target: 5 },
            { id: 'wave10', description: 'Reach Wave 10', type: 'wave', target: 10 },
            { id: 'wave25', description: 'Reach Wave 25', type: 'wave', target: 25 }
        ];
    }

    preload() {
        // Preload ship sprites if they haven't been loaded elsewhere
        if (!this.textures.exists('normal_spaceship')) {
            this.load.image('normal_spaceship', 'assets/images/sprites/normal_spaceship.png');
        }
        if (!this.textures.exists('tank_spaceship-removebg-preview')) {
            this.load.image('tank_spaceship-removebg-preview', 'assets/images/sprites/tank_spaceship-removebg-preview.png');
        }
        if (!this.textures.exists('speedy_spaceship-removebg-preview')) {
            this.load.image('speedy_spaceship-removebg-preview', 'assets/images/sprites/speedy_spaceship-removebg-preview.png');
        }
        
        // Preload button images with correct paths
        this.load.image('questsbtn', 'assets/images/sprites/questsbtn.png');
        this.load.image('startbutton', 'assets/images/sprites/startbutton.png');
        this.load.image('settingsbtn', 'assets/images/sprites/settingsbtn.png');
        
        // Preload title image
        this.load.image('title', 'assets/images/sprites/title.png');
        
        // Preload sound effects
        this.load.audio('button-sound', 'assets/audio/sfx/button.mp3');
    }

    create() {
        // Make sure to explicitly load sound settings
        this.soundVolume = parseFloat(localStorage.getItem('soundVolume') || '0.8');
        console.log("MainMenu create: Sound volume =", this.soundVolume);
        
        // Create enhanced background
        this.createEnhancedBackground();
        
        // If returning from game, ensure we recreate all UI elements properly
        if (this.isReturningFromGame) {
            // Settings panel is already destroyed in init() if returning from game
            console.log("Returning from game, recreating UI elements");
        }
        
        // Create title
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Set default depth for UI elements to ensure they appear above background elements
        const UI_DEPTH = 10;
        
        // Wait for first user interaction to play music
        this.input.once('pointerdown', () => {
            this.startTitleMusic();
        });
        this.input.keyboard.once('keydown', () => {
            this.startTitleMusic();
        });
        
        // Load selected ship from localStorage
        this.loadSelectedShip();
        
        // Game title using image - moved down and smaller
        const title = this.add.image(width / 2, height / 4, 'title');
        title.setScale(0.35);
        title.setOrigin(0.5);
        title.setDepth(UI_DEPTH);
        
        // Create pulsing effect for title
        this.tweens.add({
            targets: title,
            scale: { from: 0.35, to: 0.385 },
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Get sound volume from storage
        this.soundVolume = parseFloat(localStorage.getItem('soundVolume') || '0.8');
        
        // Play button using image with proper hitArea
        const playButton = this.add.image(width / 2, height / 2 + 80, 'startbutton');
        playButton.setScale(0.25);
        playButton.setDepth(UI_DEPTH);
        
        // Get the visible dimensions of the button with correct proportions (80% width, 40% height)
        const visibleWidth = playButton.width * 0.8;
        const visibleHeight = playButton.height * 0.4;
        
        // Set interactive area to match the visible button rather than full transparent image
        playButton.setInteractive(new Phaser.Geom.Rectangle(
            (playButton.width - visibleWidth) / 2, 
            (playButton.height - visibleHeight) / 2, 
            visibleWidth, 
            visibleHeight
        ), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        
        // Add glow effect to play button
        const playGlow = this.add.rectangle(width / 2, height / 2 + 80, 210, 80, 0xff00ff, 0.2);
        this.tweens.add({
            targets: playGlow,
            alpha: { from: 0.2, to: 0.4 },
            scale: { from: 1, to: 1.05 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // Button hover effect
        playButton.on('pointerover', () => {
            this.tweens.add({
                targets: playButton,
                scale: 0.28,
                duration: 100
            });
        });
        
        playButton.on('pointerout', () => {
            this.tweens.add({
                targets: playButton,
                scale: 0.25,
                duration: 100
            });
        });
        
        // Add click effect with sound
        playButton.on('pointerdown', () => {
            this.tweens.add({
                targets: playButton,
                scale: 0.22,
                duration: 50
            });
            this.sound.play('button-sound', { volume: this.soundVolume });
        });
        
        // Start game on button click
        playButton.on('pointerup', () => {
            this.tweens.add({
                targets: playButton,
                scale: 0.25,
                duration: 50
            });
            
            if (this.titleMusic) {
                this.titleMusic.stop();
                this.titleMusic = null;
            }
            this.scene.start('Game');
        });
        
        // Create ship showcase on the right side of the screen
        this.createShipShowcase();
        
        // Add high score display - moved to the left side of the play button and made vertical
        this.createHighScoreDisplay();
        
        // Add settings button in top right corner
        this.createSettingsButton();
        
        // Add task list button
        this.createTaskButton();
        
        // Create settings panel (initially hidden)
        this.createSettingsPanel();
        
        // Create task list panel (initially hidden)
        this.createTaskListPanel();
        
        // Create ship selection panel (initially hidden)
        this.createShipSelectionPanel();
        
        // Check if tasks need to be updated based on high score/wave
        this.checkTaskCompletion();
    }
    
    // Override scene's init to force refreshing the high score display when returning to the menu
    init() {
        // Flag to track if this is a return from another scene
        this.isReturningFromGame = false;
        
        // Check if there was a previous scene
        if (this.scene.manager.getScenes(true).length > 1) {
            this.isReturningFromGame = true;
            
            // When returning from a game, always recreate settings panel
            if (this.settingsPanel) {
                this.settingsPanel.destroy();
                this.settingsPanel = null;
            }
            
            // Update the sound volume from localStorage
            this.soundVolume = parseFloat(localStorage.getItem('soundVolume') || '0.8');
        }
        
        console.log("MainMenu init");
        
        // Load selected ship information - retrieve from localStorage
        this.selectedShipIndex = parseInt(localStorage.getItem('selectedShipIndex') || '0');
        
        // Ensure completed tasks are properly loaded
        this.completedTasks = this.getCompletedTasks();
        
        // If score panel exists, destroy it and recreate it with updated values
        if (this.scorePanel) {
            this.scorePanel.destroy();
            this.scorePanel = null;
        }
        
        // Hide settings panel if it exists
        if (this.settingsPanel) {
            this.settingsPanel.setVisible(false);
            this.settingsVisible = false;
        }
        
        // Hide task list panel if it exists
        if (this.taskListPanel) {
            this.taskListPanel.setVisible(false);
            this.taskListVisible = false;
        }
        
        // Hide ship selection panel if it exists
        if (this.shipSelectionPanel) {
            this.shipSelectionPanel.setVisible(false);
            this.shipSelectionVisible = false;
        }
    }
    
    // Load selected ship from localStorage
    loadSelectedShip() {
        try {
            const savedShip = localStorage.getItem('selectedShip');
            if (savedShip) {
                // Find the index of the saved ship
                const index = this.ships.findIndex(ship => ship.id === savedShip);
                if (index !== -1) {
                    this.selectedShipIndex = index;
                }
            }
        } catch (e) {
            console.error('Error loading selected ship:', e);
        }
    }
    
    // Save selected ship to localStorage
    saveSelectedShip() {
        try {
            const shipId = this.ships[this.selectedShipIndex].id;
            localStorage.setItem('selectedShip', shipId);
            console.log('Saved selected ship:', shipId);
            
            // Update the ship showcase
            this.updateShipShowcase();
        } catch (e) {
            console.error('Error saving selected ship:', e);
        }
    }
    
    createShipSelectionPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create a container for all ship selection elements
        this.shipSelectionPanel = this.add.container(width / 2, height / 2);
        this.shipSelectionPanel.setDepth(100);
        
        // Add panel background - increased height from 450 to 500
        const panelBg = this.add.rectangle(0, 0, 600, 500, 0x220022, 0.9);
        panelBg.setStrokeStyle(3, 0xff00ff, 0.8);
        this.shipSelectionPanel.add(panelBg);
        
        // Add title
        const title = this.add.text(0, -180, 'SELECT YOUR SHIP', {
            font: 'bold 32px Arial',
            fill: '#ffff00',
            stroke: '#880088',
            strokeThickness: 2
        });
        title.setOrigin(0.5);
        this.shipSelectionPanel.add(title);
        
        // Add close button
        const closeButton = this.add.text(280, -180, '✕', {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        this.shipSelectionPanel.add(closeButton);
        
        // Close button hover effects
        closeButton.on('pointerover', () => {
            closeButton.setStyle({ fill: '#ff5555' });
        });
        
        closeButton.on('pointerout', () => {
            closeButton.setStyle({ fill: '#ffffff' });
        });
        
        // Close button functionality
        closeButton.on('pointerup', () => {
            this.toggleShipSelectionPanel();
        });
        
        // Add ship display area
        this.createShipDisplay();
        
        // Add navigation arrows
        this.createNavigationArrows();
        
        // Initially hide the panel
        this.shipSelectionPanel.setVisible(false);
        this.shipSelectionVisible = false;
    }
    
    createShipDisplay() {
        // Container for ship display that can be updated
        this.shipDisplayContainer = this.add.container(0, 0);
        this.shipSelectionPanel.add(this.shipDisplayContainer);
        
        // Update display with current ship
        this.updateShipDisplay();
    }
    
    updateShipDisplay() {
        // Clear existing display
        this.shipDisplayContainer.removeAll(true);
        
        const currentShip = this.ships[this.selectedShipIndex];
        
        // Ship name
        const shipName = this.add.text(0, -120, currentShip.name, {
            font: 'bold 28px Arial',
            fill: '#ffffff',
            stroke: '#550055',
            strokeThickness: 2
        });
        shipName.setOrigin(0.5);
        this.shipDisplayContainer.add(shipName);
        
        // Ship description
        const shipDesc = this.add.text(0, -85, currentShip.description, {
            font: '18px Arial',
            fill: '#cccccc'
        });
        shipDesc.setOrigin(0.5);
        this.shipDisplayContainer.add(shipDesc);
        
        // Adjust ship-specific display scale based on image dimensions - INCREASED BY 50%
        let displayScale;
        
        switch(currentShip.id) {
            case 'tank':
            case 'tank_spaceship-removebg-preview':
                displayScale = 0.3; // Increased from 0.2
                break;
                
            case 'speedy':
            case 'speedy_spaceship-removebg-preview':
                displayScale = 0.24; // Increased from 0.16
                break;
                
            case 'normal':
            case 'normal_spaceship':
                displayScale = 0.12; // Increased from 0.08
                break;
                
            default:
                displayScale = 0.12;
        }
        
        // Ship sprite with adjusted scale
        const shipSprite = this.add.image(0, 0, currentShip.sprite);
        shipSprite.setScale(displayScale);
        this.shipDisplayContainer.add(shipSprite);
        
        // Add glow effect behind ship - increased size
        const glow = this.add.ellipse(0, 0, 250, 120, 0xff00ff, 0.2);
        this.shipDisplayContainer.add(glow);
        this.shipDisplayContainer.sendToBack(glow);
        
        // Add pulsing animation to glow
        this.tweens.add({
            targets: glow,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.3,
            duration: 1500,
            yoyo: true,
            repeat: -1
        });
        
        // Create stat bars
        this.createStatBars(currentShip);
        
        // Add select button - moved to position 210
        const selectBtnBg = this.add.rectangle(0, 210, 180, 50, 0x880088, 0.8);
        selectBtnBg.setStrokeStyle(2, 0xff00ff, 1);
        this.shipDisplayContainer.add(selectBtnBg);
        
        const selectBtn = this.add.text(0, 210, 'SELECT', {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        });
        selectBtn.setOrigin(0.5);
        selectBtn.setInteractive({ useHandCursor: true });
        this.shipDisplayContainer.add(selectBtn);
        
        // Button effects
        selectBtn.on('pointerover', () => {
            selectBtn.setStyle({ fill: '#ff88ff' });
            this.tweens.add({
                targets: [selectBtn, selectBtnBg],
                scale: 1.05,
                duration: 100
            });
        });
        
        selectBtn.on('pointerout', () => {
            selectBtn.setStyle({ fill: '#ffffff' });
            this.tweens.add({
                targets: [selectBtn, selectBtnBg],
                scale: 1,
                duration: 100
            });
        });
        
        // Add button press animation and sound
        selectBtn.on('pointerdown', () => {
            // Play button sound on press
            this.sound.play('button-sound', { volume: this.soundVolume });
            
            this.tweens.add({
                targets: [selectBtn, selectBtnBg],
                scale: 0.95,
                duration: 50
            });
        });
        
        selectBtn.on('pointerup', () => {
            // Save selected ship
            this.saveSelectedShip();
            
            // Visual confirmation
            this.tweens.add({
                targets: [shipSprite, glow],
                scale: 1.2,
                alpha: 0.8,
                duration: 200,
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    this.toggleShipSelectionPanel();
                }
            });
            
            // Play button sound already played on pointerdown, no need to repeat
        });
    }
    
    createStatBars(ship) {
        // Health bar
        this.createStatBar('HEALTH', ship.hp, 80, 0xff0000);
        
        // Speed bar
        this.createStatBar('SPEED', ship.speed, 120, 0x00ffff);
        
        // Fire Rate bar
        this.createStatBar('FIRE RATE', ship.fireRate, 160, 0xffaa00);
    }
    
    createStatBar(label, value, yPosition, color) {
        // Bar label - moved further left from -190 to -200
        const statLabel = this.add.text(-200, yPosition, label, {
            font: 'bold 18px Arial',
            fill: '#ffffff'
        });
        statLabel.setOrigin(0, 0.5);
        this.shipDisplayContainer.add(statLabel);
        
        // Bar background
        const barBg = this.add.rectangle(0, yPosition, 200, 20, 0x333333, 0.8);
        barBg.setStrokeStyle(1, 0xffffff, 0.4);
        this.shipDisplayContainer.add(barBg);
        
        // Bar fill - adjusted width based on value (0-1)
        const fillWidth = Math.max(5, value * 200); // At least 5px wide
        const barFill = this.add.rectangle(
            -100 + (fillWidth / 2), 
            yPosition, 
            fillWidth, 
            20, 
            color, 
            0.8
        );
        this.shipDisplayContainer.add(barFill);
        
        // Percentage text
        const percentText = this.add.text(120, yPosition, `${Math.round(value * 100)}%`, {
            font: '16px Arial',
            fill: '#ffffff'
        });
        percentText.setOrigin(0.5);
        this.shipDisplayContainer.add(percentText);
    }
    
    createNavigationArrows() {
        // Left arrow
        const leftArrow = this.add.text(-220, 0, '⟨', {
            font: 'bold 90px Arial',
            fill: '#ffaaff'
        });
        leftArrow.setOrigin(0.5);
        leftArrow.setInteractive({ useHandCursor: true });
        this.shipSelectionPanel.add(leftArrow);
        
        // Right arrow
        const rightArrow = this.add.text(220, 0, '⟩', {
            font: 'bold 90px Arial',
            fill: '#ffaaff'
        });
        rightArrow.setOrigin(0.5);
        rightArrow.setInteractive({ useHandCursor: true });
        this.shipSelectionPanel.add(rightArrow);
        
        // Arrow hover effects
        leftArrow.on('pointerover', () => {
            leftArrow.setStyle({ fill: '#ffffff' });
            this.tweens.add({
                targets: leftArrow,
                scale: 1.2,
                x: -230,
                duration: 100
            });
        });
        
        leftArrow.on('pointerout', () => {
            leftArrow.setStyle({ fill: '#ffaaff' });
            this.tweens.add({
                targets: leftArrow,
                scale: 1,
                x: -220,
                duration: 100
            });
        });
        
        rightArrow.on('pointerover', () => {
            rightArrow.setStyle({ fill: '#ffffff' });
            this.tweens.add({
                targets: rightArrow,
                scale: 1.2,
                x: 230,
                duration: 100
            });
        });
        
        rightArrow.on('pointerout', () => {
            rightArrow.setStyle({ fill: '#ffaaff' });
            this.tweens.add({
                targets: rightArrow,
                scale: 1,
                x: 220,
                duration: 100
            });
        });
        
        // Navigation functionality
        leftArrow.on('pointerup', () => {
            this.navigateShips(-1);
        });
        
        rightArrow.on('pointerup', () => {
            this.navigateShips(1);
        });
    }
    
    navigateShips(direction) {
        // Update index with wrap-around
        this.selectedShipIndex = (this.selectedShipIndex + direction + this.ships.length) % this.ships.length;
        
        // Update ship display
        this.updateShipDisplay();
        
        // Play button sound effect
        this.sound.play('button-sound', { volume: this.soundVolume * 0.3 });
    }
    
    toggleShipSelectionPanel() {
        this.shipSelectionVisible = !this.shipSelectionVisible;
        this.shipSelectionPanel.setVisible(this.shipSelectionVisible);
        
        // Add fade in/out animation
        if (this.shipSelectionVisible) {
            // Hide other panels if they're open
            if (this.settingsVisible) {
                this.toggleSettingsPanel();
            }
            if (this.taskListVisible) {
                this.toggleTaskListPanel();
            }
            
            this.shipSelectionPanel.alpha = 0;
            this.tweens.add({
                targets: this.shipSelectionPanel,
                alpha: 1,
                duration: 200
            });
        } else {
            this.tweens.add({
                targets: this.shipSelectionPanel,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    this.shipSelectionPanel.setVisible(false);
                }
            });
        }
    }
    
    createSettingsButton() {
        const width = this.cameras.main.width;
        
        // Create settings button using image - even smaller scale
        const settingsButton = this.add.image(width - 45, 60, 'settingsbtn');
        settingsButton.setScale(0.1);
        settingsButton.setDepth(10);
        
        // Make button interactive
        settingsButton.setInteractive({ useHandCursor: true });
        
        // Add hover effects
        settingsButton.on('pointerover', () => {
            this.tweens.add({
                targets: settingsButton,
                scale: 0.11,
                duration: 100
            });
        });
        
        settingsButton.on('pointerout', () => {
            this.tweens.add({
                targets: settingsButton,
                scale: 0.1,
                duration: 100
            });
        });
        
        // Toggle settings panel on click with sound
        settingsButton.on('pointerup', () => {
            this.sound.play('button-sound', { volume: this.soundVolume });
            this.toggleSettingsPanel();
        });
    }
    
    createSettingsPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Clean up existing panel if it exists
        if (this.settingsPanel) {
            this.settingsPanel.destroy();
        }
        
        // Create a container for all settings elements
        this.settingsPanel = this.add.container(width / 2, height / 2);
        this.settingsPanel.setDepth(100);
        
        // Add panel background
        const panelBg = this.add.rectangle(0, 0, 400, 300, 0x220022, 0.9);
        panelBg.setStrokeStyle(3, 0xff00ff, 0.8);
        this.settingsPanel.add(panelBg);
        
        // Add title
        const title = this.add.text(0, -120, 'SETTINGS', {
            font: 'bold 28px Arial',
            fill: '#ffff00',
            stroke: '#880088',
            strokeThickness: 2
        });
        title.setOrigin(0.5);
        this.settingsPanel.add(title);
        
        // Add close button
        const closeButton = this.add.text(180, -120, '✕', {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        this.settingsPanel.add(closeButton);
        
        // Close button hover effects
        closeButton.on('pointerover', () => {
            closeButton.setStyle({ fill: '#ff5555' });
        });
        
        closeButton.on('pointerout', () => {
            closeButton.setStyle({ fill: '#ffffff' });
        });
        
        // Close button functionality
        closeButton.on('pointerup', () => {
            this.toggleSettingsPanel();
            // Play button sound
            this.sound.play('button-sound', { volume: this.soundVolume });
        });
        
        // Always reload the volume settings from localStorage
        const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.7');
        const soundVolume = parseFloat(localStorage.getItem('soundVolume') || '0.8');
        
        console.log("Creating volume sliders with music:", musicVolume, "sound:", soundVolume);
        
        // Create music volume controls with immediate music update
        this.createVolumeSlider(
            -50, // y position
            'MUSIC VOLUME',
            musicVolume,
            (volume) => {
                localStorage.setItem('musicVolume', volume.toString());
                
                // Immediately update any active music
                if (this.titleMusic && this.titleMusic.isPlaying) {
                    console.log("Updating title music volume to:", volume);
                    this.titleMusic.setVolume(volume);
                }
                
                // Also update any other active music instances
                this.sound.getAll('title-music').forEach(music => {
                    music.setVolume(volume);
                });
            }
        );
        
        // Create sound effects volume controls
        this.createVolumeSlider(
            50, // y position
            'SOUND EFFECTS',
            soundVolume,
            (volume) => {
                localStorage.setItem('soundVolume', volume.toString());
                this.soundVolume = volume; // Update the current sound volume
                // The game scene will use this value when it starts
            }
        );
        
        // Initially hide the settings panel
        this.settingsPanel.setVisible(false);
        this.settingsVisible = false;
    }
    
    createVolumeSlider(yPosition, label, initialValue, onChangeCallback) {
        // Add label
        const sliderLabel = this.add.text(0, yPosition - 20, label, {
            font: 'bold 18px Arial',
            fill: '#ffffff'
        });
        sliderLabel.setOrigin(0.5);
        this.settingsPanel.add(sliderLabel);
        
        // Create a group for the slider components
        const sliderGroup = this.add.container(0, yPosition);
        this.settingsPanel.add(sliderGroup);
        
        // Add slider background
        const sliderBg = this.add.rectangle(0, 0, 300, 10, 0x666666);
        sliderGroup.add(sliderBg);
        
        // Add slider handle
        const sliderHandle = this.add.rectangle(
            -150 + (initialValue * 300), 
            0, 
            20, 
            30, 
            0xff00ff
        );
        sliderGroup.add(sliderHandle);
        
        // Add percentage text
        const percentText = this.add.text(0, 25, `${Math.round(initialValue * 100)}%`, {
            font: '16px Arial',
            fill: '#ffffff'
        });
        percentText.setOrigin(0.5);
        sliderGroup.add(percentText);
        
        // Make the entire slider area interactive
        const hitArea = this.add.rectangle(0, 0, 300, 40, 0xffffff, 0);
        hitArea.setInteractive({ useHandCursor: true });
        sliderGroup.add(hitArea);
        
        // Handle clicks/drags on the slider
        hitArea.on('pointerdown', (pointer) => {
            this.updateSliderPosition(pointer, sliderBg, sliderHandle, percentText, onChangeCallback, label);
            
            // Add a pointer move event to handle dragging
            this.input.on('pointermove', (movePointer) => {
                if (movePointer.isDown) {
                    this.updateSliderPosition(movePointer, sliderBg, sliderHandle, percentText, onChangeCallback, label);
                }
            });
            
            // Remove the move event when pointer is released
            this.input.once('pointerup', () => {
                this.input.off('pointermove');
            });
        });
        
        return { sliderGroup, sliderBg, sliderHandle, percentText };
    }
    
    // Helper method to update slider position and value
    updateSliderPosition(pointer, sliderBg, sliderHandle, percentText, onChangeCallback, label) {
        // Convert pointer position to world coordinates
        const worldX = pointer.x;
        
        // Get slider bounds in world coordinates
        const sliderLeft = this.settingsPanel.x - 150;
        const sliderRight = this.settingsPanel.x + 150;
        
        // Constrain position to slider bounds
        const clampedX = Phaser.Math.Clamp(worldX, sliderLeft, sliderRight);
        
        // Calculate local position relative to the slider container
        const localX = clampedX - this.settingsPanel.x;
        
        // Update handle position
        sliderHandle.x = localX;
        
        // Calculate volume (0-1)
        const volume = (clampedX - sliderLeft) / 300;
        
        // Update display percentage
        percentText.setText(`${Math.round(volume * 100)}%`);
        
        // Call callback with new volume
        onChangeCallback(volume);
        
        // Play test sound if this is the sound volume slider
        if (label.includes('SOUND')) {
            this.sound.play('button-sound', { volume: volume });
        }
    }
    
    toggleSettingsPanel() {
        this.settingsVisible = !this.settingsVisible;
        this.settingsPanel.setVisible(this.settingsVisible);
        
        // Add fade in/out animation
        if (this.settingsVisible) {
            this.settingsPanel.alpha = 0;
            this.tweens.add({
                targets: this.settingsPanel,
                alpha: 1,
                duration: 200
            });
        } else {
            this.tweens.add({
                targets: this.settingsPanel,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    this.settingsPanel.setVisible(false);
                }
            });
        }
    }

    createHighScoreDisplay() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Always reload from localStorage to get the most current values
        const highScore = parseInt(localStorage.getItem('highScore') || '0');
        const highWave = parseInt(localStorage.getItem('highWave') || '1');
        
        console.log('MainMenu - Current high score:', highScore, 'wave:', highWave); // Debug log
        
        // Format high score with commas for thousands
        const formattedHighScore = this.formatNumber(highScore);
        
        // Create container with background - moved 45px to the left and 20px up
        this.scorePanel = this.add.container(width * 0.25 - 45, height / 2 + 60);
        this.scorePanel.setDepth(10);
        
        // Add background panel with improved styling - larger size
        const bgGlow = this.add.rectangle(0, 0, 220, 190, 0xff00ff, 0.1);
        this.scorePanel.add(bgGlow);
        
        const bg = this.add.rectangle(0, 15, 200, 220, 0x330033, 0.7);
        bg.setStrokeStyle(2, 0xff00ff, 0.8);
        this.scorePanel.add(bg);
        
        // Add header text with improved styling - larger font
        const header = this.add.text(0, -65, 'BEST RUN', {
            font: 'bold 28px Arial',
            fill: '#ffff00',
            stroke: '#880088',
            strokeThickness: 2
        });
        header.setOrigin(0.5);
        this.scorePanel.add(header);
        
        // Add score text with improved styling - larger font
        const scoreText = this.add.text(0, -20, 'SCORE:', {
            font: 'bold 22px Arial',
            fill: '#ffffff'
        });
        scoreText.setOrigin(0.5);
        this.scorePanel.add(scoreText);
        
        // Apply special styling for higher scores
        let scoreColor = '#ff88ff';
        let scoreStroke = '#550055';
        let additionalEffects = false;
        
        if (highScore >= 10000) {
            scoreColor = '#ffdd00'; // Gold color for high scores
            scoreStroke = '#aa5500';
            additionalEffects = true;
        }
        
        const scoreValue = this.add.text(0, 20, formattedHighScore, {
            font: 'bold 32px Arial',
            fill: scoreColor,
            stroke: scoreStroke,
            strokeThickness: 1
        });
        scoreValue.setOrigin(0.5);
        this.scorePanel.add(scoreValue);
        
        // Add wave text with improved styling - larger font
        const waveText = this.add.text(0, 60, 'WAVE:', {
            font: 'bold 22px Arial',
            fill: '#ffffff'
        });
        waveText.setOrigin(0.5);
        this.scorePanel.add(waveText);
        
        // Apply special styling for higher waves
        let waveColor = '#ff88ff';
        let waveStroke = '#550055';
        
        if (highWave >= 8) {
            waveColor = '#ffdd00'; // Gold color for high waves
            waveStroke = '#aa5500';
        }
        
        const waveValue = this.add.text(0, 100, highWave.toString(), {
            font: 'bold 32px Arial',
            fill: waveColor,
            stroke: waveStroke,
            strokeThickness: 1
        });
        waveValue.setOrigin(0.5);
        this.scorePanel.add(waveValue);
        
        // Add pulsing glow effect to the background
        this.tweens.add({
            targets: bgGlow,
            alpha: { from: 0.1, to: 0.3 },
            scale: { from: 1, to: 1.05 },
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Add pulsing effect to the values
        this.tweens.add({
            targets: [scoreValue, waveValue],
            alpha: { from: 0.9, to: 1 },
            scale: { from: 1, to: 1.1 },
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Add special particle effect for high scores
        if (additionalEffects) {
            // Add particles around the score
            const particles = this.add.particles('particle');
            const emitter = particles.createEmitter({
                x: 0,
                y: 15,
                speed: { min: 20, max: 40 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.6, end: 0 },
                alpha: { start: 0.5, end: 0 },
                lifespan: 1000,
                quantity: 1,
                frequency: 500,
                tint: [0xffff00, 0xffaa00, 0xff00ff]
            });
            
            // Add emitter to the container and position it
            particles.x = this.scorePanel.x;
            particles.y = this.scorePanel.y;
            this.scorePanel.add(particles);
        }
    }
    
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    startTitleMusic() {
        if (this.titleMusicStarted) return;
        this.titleMusicStarted = true;
        
        try {
            // Always reload the music volume from localStorage
            const musicVolume = parseFloat(localStorage.getItem('musicVolume') || '0.7');
            console.log("Starting title music with volume:", musicVolume);
            
            // Stop any existing title music first
            this.sound.getAll('title-music').forEach(music => {
                music.stop();
            });
            
            // Create fresh title music with correct volume
            this.titleMusic = this.sound.add('title-music', { 
                loop: true, 
                volume: musicVolume 
            });
            
            this.titleMusic.play();
        } catch (e) {
            console.error('Failed to play title music:', e);
        }
    }
    
    createEnhancedBackground() {
        // Create layers for parallax effect
        this.bgLayers = {
            far: this.add.container(0, 0).setDepth(-30),
            mid: this.add.container(0, 0).setDepth(-20),
            near: this.add.container(0, 0).setDepth(-10)
        };
        
        // Add starfield with multiple layers
        this.createStarLayers();
        
        // Add nebulae
        this.createNebulae();
        
        // Add occasional meteor shower
        this.time.addEvent({
            delay: Phaser.Math.Between(8000, 15000),
            callback: this.createMeteorShower,
            callbackScope: this,
            loop: true
        });
        
        // Register update event
        this.events.on('update', this.updateBackground, this);
    }
    
    createStarLayers() {
        const { width, height } = this.cameras.main;
        this.stars = [];
        
        // Create three layers of stars with different densities and speeds
        const layerConfigs = [
            { container: this.bgLayers.far, count: 80, sizeRange: [1, 1.5], speedRange: [0.2, 0.5], alpha: [0.3, 0.6] },
            { container: this.bgLayers.mid, count: 50, sizeRange: [1.5, 2], speedRange: [0.5, 0.8], alpha: [0.5, 0.8] },
            { container: this.bgLayers.near, count: 30, sizeRange: [2, 3], speedRange: [0.8, 1.2], alpha: [0.7, 1] }
        ];
        
        layerConfigs.forEach(config => {
            for (let i = 0; i < config.count; i++) {
                const x = Phaser.Math.Between(0, width);
                const y = Phaser.Math.Between(0, height);
                const size = Phaser.Math.FloatBetween(...config.sizeRange);
                const alpha = Phaser.Math.FloatBetween(...config.alpha);
                
                // Occasionally make a star twinkle
                const twinkle = Phaser.Math.Between(0, 10) > 8;
                
                const star = this.add.circle(x, y, size, 0xffffff, alpha);
                config.container.add(star);
                
                // Add star data for animation
            this.stars.push({
                sprite: star,
                    speed: Phaser.Math.FloatBetween(...config.speedRange),
                    twinkle,
                    baseAlpha: alpha
                });
                
                // Add twinkling effect for some stars
                if (twinkle) {
                    this.tweens.add({
                        targets: star,
                        alpha: { from: alpha, to: alpha * 0.5 },
                        duration: Phaser.Math.Between(1000, 3000),
                        yoyo: true,
                        repeat: -1,
                        delay: Phaser.Math.Between(0, 2000)
                    });
                }
            }
        });
    }
    
    createNebulae() {
        const { width, height } = this.cameras.main;
        
        // Create 3-5 colorful nebulae
        const nebulaCount = Phaser.Math.Between(3, 5);
        const nebulaColors = [0x9900ff, 0x0066ff, 0xff00cc, 0x00ffaa, 0xffaa00];
        
        for (let i = 0; i < nebulaCount; i++) {
            const x = Phaser.Math.Between(width * 0.1, width * 0.9);
            const y = Phaser.Math.Between(height * 0.1, height * 0.9);
            const color = Phaser.Utils.Array.GetRandom(nebulaColors);
            
            this.createNebula(x, y, color);
        }
    }
    
    createNebula(x, y, color) {
        // Create container for nebula
        const nebula = this.add.container(x, y);
        this.bgLayers.far.add(nebula);
        
        // Create multiple overlapping shapes for nebula effect
        const blobCount = Phaser.Math.Between(6, 12);
        
        for (let i = 0; i < blobCount; i++) {
            const offsetX = Phaser.Math.Between(-100, 100);
            const offsetY = Phaser.Math.Between(-100, 100);
            const radius = Phaser.Math.Between(40, 120);
            const alpha = Phaser.Math.FloatBetween(0.03, 0.08);
            
            const blob = this.add.circle(offsetX, offsetY, radius, color, alpha);
            nebula.add(blob);
            
            // Add slow pulsing animation to each blob
            this.tweens.add({
                targets: blob,
                scaleX: { from: 0.9, to: 1.1 },
                scaleY: { from: 0.9, to: 1.1 },
                alpha: { from: alpha, to: alpha * 1.5 },
                duration: Phaser.Math.Between(5000, 10000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 3000)
            });
        }
        
        // Add subtle rotation to the entire nebula
        this.tweens.add({
            targets: nebula,
            angle: { from: 0, to: 360 },
            duration: 200000,
            repeat: -1,
            ease: 'Linear'
        });
        
        // Add slow drift motion
        this.tweens.add({
            targets: nebula,
            x: nebula.x + Phaser.Math.Between(-50, 50),
            y: nebula.y + Phaser.Math.Between(-50, 50),
            duration: 30000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        return nebula;
    }
    
    createSpaceObjects() {
        const { width, height } = this.cameras.main;
        
        // Add 2-3 planets or space objects
        const objectCount = Phaser.Math.Between(2, 3);
        
        for (let i = 0; i < objectCount; i++) {
            // Position planets at edges of screen to not interfere with UI
            let x, y;
            if (i === 0) {
                // First planet in top-left quadrant
                x = Phaser.Math.Between(width * 0.05, width * 0.25);
                y = Phaser.Math.Between(height * 0.05, height * 0.25);
            } else if (i === 1) {
                // Second planet in bottom-right quadrant
                x = Phaser.Math.Between(width * 0.75, width * 0.95);
                y = Phaser.Math.Between(height * 0.75, height * 0.95);
            } else {
                // Third planet in random edge position
                const edge = Phaser.Math.Between(0, 3);
                switch (edge) {
                    case 0: // top
                        x = Phaser.Math.Between(width * 0.3, width * 0.7);
                        y = Phaser.Math.Between(height * 0.05, height * 0.15);
                        break;
                    case 1: // right
                        x = Phaser.Math.Between(width * 0.85, width * 0.95);
                        y = Phaser.Math.Between(height * 0.3, height * 0.7);
                        break;
                    case 2: // bottom
                        x = Phaser.Math.Between(width * 0.3, width * 0.7);
                        y = Phaser.Math.Between(height * 0.85, height * 0.95);
                        break;
                    case 3: // left
                        x = Phaser.Math.Between(width * 0.05, width * 0.15);
                        y = Phaser.Math.Between(height * 0.3, height * 0.7);
                        break;
                }
            }
            
            this.createPlanet(x, y);
        }
    }
    
    createPlanet(x, y) {
        // Determine planet size based on position (further = smaller)
        const centerDist = Phaser.Math.Distance.Between(x, y, this.cameras.main.width/2, this.cameras.main.height/2);
        const maxDist = Phaser.Math.Distance.Between(0, 0, this.cameras.main.width/2, this.cameras.main.height/2);
        const sizeFactor = 1 - (centerDist / maxDist) * 0.6; // Scale from 0.4 to 1.0 based on distance
        
        const planetSize = Phaser.Math.Between(30, 60) * sizeFactor;
        
        // Random planet color
        const planetColors = [0xff9900, 0x99ffcc, 0xcc99ff, 0x9999ff, 0xffcc66];
        const baseColor = Phaser.Utils.Array.GetRandom(planetColors);
        
        // Create planet container
        const planet = this.add.container(x, y);
        this.bgLayers.mid.add(planet);
        
        // Planet body
        const body = this.add.circle(0, 0, planetSize, baseColor, 1);
        planet.add(body);
        
        // Add texture/detail to planet
        const detailType = Phaser.Math.Between(0, 3);
        
        switch (detailType) {
            case 0: // Ringed planet
                const ringWidth = planetSize * 1.8;
                const ring = this.add.ellipse(0, 0, ringWidth, ringWidth * 0.3, baseColor, 0.3);
                ring.rotation = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
                planet.add(ring);
                break;
                
            case 1: // Striped planet
                const stripeCount = Phaser.Math.Between(2, 4);
                for (let i = 0; i < stripeCount; i++) {
                    const yPos = (i - (stripeCount/2)) * (planetSize/2);
                    const stripe = this.add.rectangle(0, yPos, planetSize * 2, planetSize * 0.2, 
                        Phaser.Display.Color.ValueToColor(baseColor).darken(20).color, 0.6);
                    planet.add(stripe);
                }
                break;
                
            case 2: // Spotted planet
                const spotCount = Phaser.Math.Between(3, 8);
                for (let i = 0; i < spotCount; i++) {
                    const spotX = Phaser.Math.Between(-planetSize * 0.7, planetSize * 0.7);
                    const spotY = Phaser.Math.Between(-planetSize * 0.7, planetSize * 0.7);
                    const spotSize = planetSize * Phaser.Math.FloatBetween(0.1, 0.3);
                    const spot = this.add.circle(spotX, spotY, spotSize, 
                        Phaser.Display.Color.ValueToColor(baseColor).darken(40).color, 0.8);
                    planet.add(spot);
                }
                break;
                
            case 3: // Glowing planet
                // Add glow effect
                const glow = this.add.circle(0, 0, planetSize * 1.2, baseColor, 0.2);
                planet.add(glow);
                this.tweens.add({
                    targets: glow,
                    alpha: { from: 0.1, to: 0.3 },
                    scale: { from: 1, to: 1.1 },
                    duration: 2000,
                    yoyo: true,
                    repeat: -1
                });
                break;
        }
        
        // Add slow rotation to planet
        this.tweens.add({
            targets: planet,
            angle: 360,
            duration: Phaser.Math.Between(100000, 200000),
            repeat: -1,
            ease: 'Linear'
        });
        
        return planet;
    }
    
    createMeteorShower() {
        const { width, height } = this.cameras.main;
        const meteorCount = Phaser.Math.Between(5, 12);
        
        // Create shower origin point (off-screen)
        const originX = Phaser.Math.Between(0, 1) === 0 ? -50 : width + 50;
        const originY = Phaser.Math.Between(50, height * 0.3);
        
        // Launch meteors with staggered timing
        for (let i = 0; i < meteorCount; i++) {
            this.time.delayedCall(i * Phaser.Math.Between(100, 300), () => {
                this.createMeteor(originX, originY);
            });
        }
    }
    
    createMeteor(originX, originY) {
        const { width, height } = this.cameras.main;
        
        // Randomize meteor parameters
        const size = Phaser.Math.FloatBetween(1.5, 4);
        const speed = Phaser.Math.FloatBetween(400, 700);
        const angle = originX < 0 ? 
            Phaser.Math.DegToRad(Phaser.Math.Between(20, 60)) : 
            Phaser.Math.DegToRad(Phaser.Math.Between(120, 160));
            
        // Create meteor sprite
        const meteor = this.add.circle(originX, originY, size, 0xffffff);
        this.bgLayers.near.add(meteor);
        
        // Add trail effect with particles
        const particles = this.add.particles('particle');
        const emitter = particles.createEmitter({
            speed: 10,
            scale: { start: size * 0.5, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: 0xffaa33,
            lifespan: 300,
            blendMode: 'ADD'
        });
        
        emitter.startFollow(meteor);
        this.bgLayers.near.add(particles);
        
        // Calculate trajectory endpoint
        const targetX = originX + Math.cos(angle) * width * 1.5;
        const targetY = originY + Math.sin(angle) * height * 1.5;
        
        // Animate meteor
        this.tweens.add({
            targets: meteor,
            x: targetX,
            y: targetY,
            duration: (width + height) / speed * 1000,
            ease: 'Linear',
            onComplete: () => {
                meteor.destroy();
                particles.destroy();
            }
        });
    }
    
    updateBackground() {
        // Update stars movement
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            star.sprite.y += star.speed;
            
            // Reset stars when they move off screen
            if (star.sprite.y > this.cameras.main.height) {
                star.sprite.y = 0;
                star.sprite.x = Phaser.Math.Between(0, this.cameras.main.width);
            }
        }
    }
    
    // Keep original methods as stubs for compatibility
    createStarfield() {
        // Replaced by createEnhancedBackground
    }
    
    updateStarfield() {
        // Replaced by updateBackground
    }

    createTaskButton() {
        const width = this.cameras.main.width;
        
        // Create tasks button using image - even smaller scale 
        const taskButton = this.add.image(60, 50, 'questsbtn');
        taskButton.setScale(0.1);
        taskButton.setDepth(10);
        
        // Make button interactive
        taskButton.setInteractive({ useHandCursor: true });
        
        // Add hover effects
        taskButton.on('pointerover', () => {
            this.tweens.add({
                targets: taskButton,
                scale: 0.11,
                duration: 100
            });
        });
        
        taskButton.on('pointerout', () => {
            this.tweens.add({
                targets: taskButton,
                scale: 0.1,
                duration: 100
            });
        });
        
        // Toggle task list panel on click with sound
        taskButton.on('pointerup', () => {
            this.sound.play('button-sound', { volume: this.soundVolume });
            this.toggleTaskListPanel();
        });
    }
    
    createTaskListPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create a container for all task list elements
        this.taskListPanel = this.add.container(width / 2, height / 2);
        this.taskListPanel.setDepth(100);
        
        // Add panel background
        const panelBg = this.add.rectangle(0, 0, 500, 400, 0x220022, 0.9);
        panelBg.setStrokeStyle(3, 0xff00ff, 0.8);
        this.taskListPanel.add(panelBg);
        
        // Add title
        const title = this.add.text(0, -170, 'CHALLENGES', {
            font: 'bold 28px Arial',
            fill: '#ffff00',
            stroke: '#880088',
            strokeThickness: 2
        });
        title.setOrigin(0.5);
        this.taskListPanel.add(title);
        
        // Add close button
        const closeButton = this.add.text(230, -170, '✕', {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        this.taskListPanel.add(closeButton);
        
        // Close button hover effects
        closeButton.on('pointerover', () => {
            closeButton.setStyle({ fill: '#ff5555' });
        });
        
        closeButton.on('pointerout', () => {
            closeButton.setStyle({ fill: '#ffffff' });
        });
        
        // Close button functionality
        closeButton.on('pointerup', () => {
            this.toggleTaskListPanel();
        });
        
        // Add task items
        this.createTaskListItems();
        
        // Initially hide the task list panel
        this.taskListPanel.setVisible(false);
        this.taskListVisible = false;
    }
    
    createTaskListItems() {
        // Get completed tasks from localStorage
        const completedTasks = this.getCompletedTasks();
        
        // Starting Y position for first task
        let yPos = -120;
        
        // Add each task to the panel
        this.tasks.forEach((task, index) => {
            // Check if this task is completed
            const isCompleted = completedTasks.includes(task.id);
            
            // Create container for task
            const taskContainer = this.add.container(0, yPos + (index * 50));
            this.taskListPanel.add(taskContainer);
            
            // Checkbox or completion indicator
            const checkboxBg = this.add.rectangle(-200, 0, 30, 30, 0x550055, 0.8);
            checkboxBg.setStrokeStyle(2, 0xff00ff, 0.8);
            taskContainer.add(checkboxBg);
            
            // Add checkmark if completed
            if (isCompleted) {
                const checkmark = this.add.text(-200, 0, '✓', {
                    font: 'bold 20px Arial',
                    fill: '#00ff00'
                });
                checkmark.setOrigin(0.5);
                taskContainer.add(checkmark);
                
                // Add glow effect to checkmark
                this.tweens.add({
                    targets: checkmark,
                    alpha: { from: 0.7, to: 1 },
                    duration: 1500,
                    yoyo: true,
                    repeat: -1
                });
            }
            
            // Task description text
            const taskText = this.add.text(-170, 0, task.description, {
                font: isCompleted ? 'bold 18px Arial' : '18px Arial',
                fill: isCompleted ? '#90ff90' : '#ffffff',
                stroke: isCompleted ? '#008800' : null,
                strokeThickness: isCompleted ? 1 : 0
            });
            taskText.setOrigin(0, 0.5);
            taskContainer.add(taskText);
            
            // Progress indicator for incomplete tasks
            if (!isCompleted) {
                let progress = 0;
                
                // Calculate progress based on task type
                if (task.type === 'score') {
                    const highScore = parseInt(localStorage.getItem('highScore') || '0');
                    progress = Math.min(1, highScore / task.target);
                } else if (task.type === 'wave') {
                    const highWave = parseInt(localStorage.getItem('highWave') || '1');
                    progress = Math.min(1, highWave / task.target);
                }
                
                // Draw progress bar
                const progressBarBg = this.add.rectangle(125, 0, 100, 15, 0x333333, 0.7);
                taskContainer.add(progressBarBg);
                
                // Progress fill (at least 5% width for visibility)
                const progressWidth = Math.max(5, progress * 100);
                const progressFill = this.add.rectangle(
                    75 + (progressWidth / 2), 
                    0, 
                    progressWidth, 
                    15, 
                    0x00ff88, 
                    0.8
                );
                taskContainer.add(progressFill);
                
                // Progress percentage
                const percentText = this.add.text(125, 0, `${Math.round(progress * 100)}%`, {
                    font: '14px Arial',
                    fill: '#ffffff'
                });
                percentText.setOrigin(0.5);
                taskContainer.add(percentText);
            } else {
                // "COMPLETED" text for completed tasks
                const completedText = this.add.text(125, 0, 'COMPLETED', {
                    font: 'bold 14px Arial',
                    fill: '#00ff88'
                });
                completedText.setOrigin(0.5);
                taskContainer.add(completedText);
            }
        });
    }
    
    toggleTaskListPanel() {
        this.taskListVisible = !this.taskListVisible;
        this.taskListPanel.setVisible(this.taskListVisible);
        
        // Add fade in/out animation
        if (this.taskListVisible) {
            // Hide settings panel if it's open
            if (this.settingsVisible) {
                this.toggleSettingsPanel();
            }
            
            this.taskListPanel.alpha = 0;
            this.tweens.add({
                targets: this.taskListPanel,
                alpha: 1,
                duration: 200
            });
        } else {
            this.tweens.add({
                targets: this.taskListPanel,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    this.taskListPanel.setVisible(false);
                }
            });
        }
    }
    
    // Get completed tasks from localStorage
    getCompletedTasks() {
        try {
            const tasksData = localStorage.getItem('completedTasks');
            return tasksData ? JSON.parse(tasksData) : [];
        } catch (e) {
            console.error('Error loading completed tasks:', e);
            return [];
        }
    }
    
    // Save completed tasks to localStorage
    saveCompletedTasks(completedTasks) {
        try {
            localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
        } catch (e) {
            console.error('Error saving completed tasks:', e);
        }
    }
    
    // Check if any tasks need to be updated based on current high score/wave
    checkTaskCompletion() {
        const completedTasks = this.getCompletedTasks();
        let updatedTasks = false;
        
        // Get current high score and wave
        const highScore = parseInt(localStorage.getItem('highScore') || '0');
        const highWave = parseInt(localStorage.getItem('highWave') || '1');
        
        // Check each task
        this.tasks.forEach(task => {
            // Skip already completed tasks
            if (completedTasks.includes(task.id)) {
                return;
            }
            
            // Check if task is completed
            let isCompleted = false;
            
            if (task.type === 'score' && highScore >= task.target) {
                isCompleted = true;
            } else if (task.type === 'wave' && highWave >= task.target) {
                isCompleted = true;
            }
            
            // Add to completed tasks if newly completed
            if (isCompleted) {
                completedTasks.push(task.id);
                updatedTasks = true;
            }
        });
        
        // Save updated task list if changes were made
        if (updatedTasks) {
            this.saveCompletedTasks(completedTasks);
            
            // If task list is open, refresh it
            if (this.taskListVisible && this.taskListPanel) {
                this.recreateTaskList();
            }
        }
    }
    
    // Recreate the task list to reflect updated completion status
    recreateTaskList() {
        // Remove all task items
        if (this.taskListPanel) {
            // Keep only the first 3 items (background, title, close button)
            while (this.taskListPanel.list.length > 3) {
                this.taskListPanel.list[3].destroy();
                this.taskListPanel.list.splice(3, 1);
            }
            
            // Add updated task items
            this.createTaskListItems();
        }
    }

    // Create ship showcase on the right side of the screen
    createShipShowcase() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create container for ship showcase - moved 65px to the right and 10px up
        this.shipShowcase = this.add.container(width * 0.75 + 65, height / 2 + 70);
        this.shipShowcase.setDepth(10);
        
        // Add background panel - increased height and width
        const showcaseBg = this.add.rectangle(0, 0, 230, 250, 0x330033, 0.7);
        showcaseBg.setStrokeStyle(2, 0xff00ff, 0.8);
        this.shipShowcase.add(showcaseBg);
        
        // Get current ship data
        const selectedShipId = localStorage.getItem('selectedShip') || 'normal';
        const selectedShip = this.ships.find(ship => ship.id === selectedShipId) || this.ships[0];
        
        // Use ship-specific display scale for each ship type - INCREASED BY 40%
        let showcaseScale;
        
        switch(selectedShip.id) {
            case 'tank':
            case 'tank_spaceship-removebg-preview':
                showcaseScale = 0.32; // Increased from 0.225
                break;
                
            case 'speedy':
            case 'speedy_spaceship-removebg-preview':
                showcaseScale = 0.25; // Increased from 0.18
                break;
                
            case 'normal':
            case 'normal_spaceship':
                showcaseScale = 0.13; // Increased from 0.09
                break;
                
            default:
                showcaseScale = 0.13;
        }
        
        // Add ship sprite with proper scale
        this.showcaseSprite = this.add.image(0, -30, selectedShip.sprite);
        this.showcaseSprite.setScale(showcaseScale);
        this.shipShowcase.add(this.showcaseSprite);
        
        // Add glow behind ship - increased size
        const shipGlow = this.add.ellipse(0, -30, 120, 80, 0xff00ff, 0.2);
        this.shipShowcase.add(shipGlow);
        this.shipShowcase.sendToBack(shipGlow);
        
        // Add subtle animation
        this.tweens.add({
            targets: [this.showcaseSprite, shipGlow],
            y: '-=10',
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Ship Selection Button - moved down further
        const shipButtonBg = this.add.rectangle(0, 70, 160, 50, 0x660066, 0.8);
        shipButtonBg.setStrokeStyle(2, 0xff00ff, 0.8);
        this.shipShowcase.add(shipButtonBg);
        
        const shipButton = this.add.text(0, 70, 'SELECT SHIP', {
            font: 'bold 20px Arial',
            fill: '#ffffff',
            padding: { x: 20, y: 10 },
        });
        shipButton.setOrigin(0.5);
        shipButton.setInteractive({ useHandCursor: true });
        this.shipShowcase.add(shipButton);
        
        // Ship button hover effect
        shipButton.on('pointerover', () => {
            shipButton.setStyle({ fill: '#ff88ff' });
            this.tweens.add({
                targets: [shipButton, shipButtonBg],
                scale: 1.05,
                duration: 100
            });
        });
        
        shipButton.on('pointerout', () => {
            shipButton.setStyle({ fill: '#ffffff' });
            this.tweens.add({
                targets: [shipButton, shipButtonBg],
                scale: 1,
                duration: 100
            });
        });
        
        // Add click effect
        shipButton.on('pointerdown', () => {
            this.tweens.add({
                targets: [shipButton, shipButtonBg],
                scale: 0.95,
                duration: 50
            });
        });
        
        // Open ship selection panel on click
        shipButton.on('pointerup', () => {
            this.tweens.add({
                targets: [shipButton, shipButtonBg],
                scale: 1,
                duration: 50
            });
            this.toggleShipSelectionPanel();
        });
    }
    
    // Update the ship showcase with newly selected ship
    updateShipShowcase() {
        // Get current ship data
        const selectedShipId = localStorage.getItem('selectedShip') || 'normal';
        const selectedShip = this.ships.find(ship => ship.id === selectedShipId) || this.ships[0];
        
        // Update sprite with proper scaling
        if (this.showcaseSprite) {
            this.showcaseSprite.setTexture(selectedShip.sprite);
            
            // Use ship-specific display scale for each ship type - INCREASED BY 40%
            let showcaseScale;
            
            switch(selectedShip.id) {
                case 'tank':
                case 'tank_spaceship-removebg-preview':
                    showcaseScale = 0.32; // Increased from 0.225
                    break;
                    
                case 'speedy':
                case 'speedy_spaceship-removebg-preview':
                    showcaseScale = 0.25; // Increased from 0.18
                    break;
                    
                case 'normal':
                case 'normal_spaceship':
                    showcaseScale = 0.13; // Increased from 0.09
                    break;
                    
                default:
                    showcaseScale = 0.13;
            }
            
            this.showcaseSprite.setScale(showcaseScale);
        }
    }

    // Override the scene's shutdown method to clean up all input events
    shutdown() {
        console.log('MainMenu shutdown');
        
        // Clean up any input events
        this.input.off('pointermove');
        this.input.off('pointerup');
        
        // Clean up timers and tweens
        this.tweens.killAll();
        
        // Call the parent shutdown method
        super.shutdown();
    }
} 