export default class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu');
        console.log('MainMenu loaded - Stats updated: Titan 20% fire, 30% speed, Pulsar 60% fire, 60% speed');
        this.titleMusicStarted = false;
        this.scorePanel = null; // Store reference to score panel for updates
        this.settingsPanel = null; // Store reference to settings panel
        this.settingsVisible = false; // Track if settings panel is visible
        this.taskListPanel = null; // Store reference to task list panel
        this.taskListVisible = false; // Track if task list is visible
        this.shipSelectionPanel = null; // Store reference to ship selection panel
        this.shipSelectionVisible = false; // Track if ship selection panel is visible
        this.difficultySelectionPanel = null; // Store reference to difficulty selection panel
        this.difficultySelectionVisible = false; // Track if difficulty selection panel is visible
        this.activeNotifications = []; // Track active quest notifications
        
        // Difficulty settings
        this.difficulties = [
            {
                id: 'easy',
                name: 'EASY',
                description: 'Fewer enemies, lower health, less damage',
                enemyHealthMod: 0.7,
                enemyDamageMod: 0.7,
                enemySpawnMod: 1.3,  // Higher value = slower spawns
                maxEnemiesMod: 0.7   // Lower value = fewer enemies
            },
            {
                id: 'normal',
                name: 'NORMAL',
                description: 'Standard challenge for most players',
                enemyHealthMod: 1.0,
                enemyDamageMod: 1.0,
                enemySpawnMod: 1.0,
                maxEnemiesMod: 1.0
            },
            {
                id: 'hard',
                name: 'HARD',
                description: 'More enemies, higher health, more damage',
                enemyHealthMod: 1.3,
                enemyDamageMod: 1.3,
                enemySpawnMod: 0.8,  // Lower value = faster spawns
                maxEnemiesMod: 1.3    // Higher value = more enemies
            }
        ];
        
        // Load selected difficulty (default to Normal)
        this.selectedDifficultyIndex = parseInt(localStorage.getItem('selectedDifficultyIndex') || '1');
        
        // Ship data with stats
        this.ships = [
            { 
                id: 'normal', 
                name: 'PULSAR',
                sprite: 'normal_spaceship',
                description: 'Balanced performance for all pilots',
                speed: 0.6, // 60% of max (reduced from 0.7)
                hp: 0.6,    // 60% of max
                fireRate: 0.6, // 60% of max (reduced from 0.7)
                damage: 0.6, // 60% of max (20 damage)
                scale: 0.5  // Display scale for menu
            },
            { 
                id: 'tank', 
                name: 'TITAN',
                sprite: 'tank_spaceship-removebg-preview',
                description: 'Heavy armor, slower movement',
                speed: 0.3, // 30% of max (reduced from 0.4)
                hp: 1.0,    // 100% of max
                fireRate: 0.2, // 20% of max (reduced from 0.4)
                damage: 0.8, // 80% of max (25 damage)
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
                damage: 0.5, // 50% of max (15 damage)
                scale: 0.45 // Display scale for menu (smaller)
            }
        ];
        
        // Current selected ship index
        this.selectedShipIndex = 0;
        
        // Define tasks - stored as static property for easy reference elsewhere
        this.tasks = [
            { id: 'score5k', description: 'Reach high score of 5,000', type: 'score', target: 5000 },
            { id: 'wave4', description: 'Complete Wave 4', type: 'waveCompleted', target: 4 },
            { id: 'score15k', description: 'Reach high score of 15,000', type: 'score', target: 15000 },
            { id: 'wave7', description: 'Complete Wave 7', type: 'waveCompleted', target: 7 },
            { id: 'score25k', description: 'Reach high score of 25,000', type: 'score', target: 25000 },
            { id: 'wave10', description: 'Complete Wave 10', type: 'waveCompleted', target: 10 }
        ];
    }

    preload() {
        // Preload ship sprites if they haven't been loaded elsewhere
        if (!this.textures.exists('normal_spaceship')) {
            this.load.image('normal_spaceship', 'assets/images/sprites/ships/normal_spaceship.png');
        }
        if (!this.textures.exists('tank_spaceship-removebg-preview')) {
            this.load.image('tank_spaceship-removebg-preview', 'assets/images/sprites/ships/tank_spaceship-removebg-preview.png');
        }
        if (!this.textures.exists('speedy_spaceship-removebg-preview')) {
            this.load.image('speedy_spaceship-removebg-preview', 'assets/images/sprites/ships/speedy_spaceship-removebg-preview.png');
        }
        
        // Preload button images with correct paths
        this.load.image('questsbtn', 'assets/images/sprites/buttons/questsbtn.png');
        this.load.image('startbutton', 'assets/images/sprites/buttons/startbutton.png');
        this.load.image('settingsbtn', 'assets/images/sprites/buttons/settingsbtn.png');
        this.load.image('difficultybtn', 'assets/images/sprites/buttons/difficultybtn.png');
        this.load.image('quest', 'assets/images/sprites/quests/quest.png');
        this.load.image('questcomplete', 'assets/images/sprites/quests/questcomplete.png');
        
        // Preload title image
        this.load.image('title', 'assets/images/sprites/title.png');
        
        // Preload sound effects
        this.load.audio('button-sound', 'assets/audio/sfx/button.mp3');
        
        // Setup fallback for quest icons if they don't load
        this.load.on('filecomplete', this.checkAndCreateFallbackTextures, this);
    }
    
    // Create fallback textures for quest icons if needed
    checkAndCreateFallbackTextures(key) {
        // Only run this after the create method has been called
        if (this.scene.isActive('MainMenu')) {
            if (key === 'quest' && !this.textures.exists('quest')) {
                this.createFallbackQuestTexture();
            }
            if (key === 'questcomplete' && !this.textures.exists('questcomplete')) {
                this.createFallbackQuestCompleteTexture();
            }
        }
    }
    
    // Create a fallback texture for the incomplete quest icon
    createFallbackQuestTexture() {
        const graphics = this.make.graphics();
        
        // Create a purple circle with a border
        graphics.fillStyle(0x550055, 1);
        graphics.fillCircle(15, 15, 15);
        graphics.lineStyle(2, 0xff00ff, 1);
        graphics.strokeCircle(15, 15, 15);
        
        // Draw a question mark
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(15, 8, 3);
        graphics.fillRect(12, 11, 3, 7);
        graphics.fillRect(15, 18, 3, 3);
        
        graphics.generateTexture('quest', 30, 30);
        graphics.destroy();
        
        console.log('Created fallback quest texture');
    }
    
    // Create a fallback texture for the completed quest icon
    createFallbackQuestCompleteTexture() {
        const graphics = this.make.graphics();
        
        // Create a green circle with a border
        graphics.fillStyle(0x005500, 1);
        graphics.fillCircle(15, 15, 15);
        graphics.lineStyle(2, 0x00ff00, 1);
        graphics.strokeCircle(15, 15, 15);
        
        // Draw a checkmark
        graphics.lineStyle(4, 0xffffff, 1);
        graphics.beginPath();
        graphics.moveTo(8, 15);
        graphics.lineTo(13, 20);
        graphics.lineTo(22, 10);
        graphics.strokePath();
        
        graphics.generateTexture('questcomplete', 30, 30);
        graphics.destroy();
        
        console.log('Created fallback quest complete texture');
    }

    create() {
        // Make sure to explicitly load sound settings
        this.soundVolume = parseFloat(localStorage.getItem('soundVolume') || '0.8');
        console.log("MainMenu create: Sound volume =", this.soundVolume);
        
        // First, forcefully clean up any leftover UI elements from previous sessions
        this.forceRemoveAllQuestElements();
        
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
        
        // Load selected difficulty from localStorage
        this.loadSelectedDifficulty();
        
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
        const playButton = this.add.image(width / 2, height / 2 + 120, 'startbutton');
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
        const playGlow = this.add.rectangle(width / 2, height / 2 + 120, 210, 80, 0xff00ff, 0.2);
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
        
        // Add difficulty button next to the task list button
        this.createDifficultyButton();
        
        // Create settings panel (initially hidden)
        this.createSettingsPanel();
        
        // Create task list panel (initially hidden)
        this.createTaskListPanel();
        
        // Create ship selection panel (initially hidden)
        this.createShipSelectionPanel();
        
        // Create difficulty selection panel (initially hidden)
        this.createDifficultySelectionPanel();
        
        // Schedule another cleanup after a short delay to catch any elements that might be created after the main UI is set up
        this.time.delayedCall(100, this.forceRemoveAllQuestElements, [], this);
        this.time.delayedCall(500, this.forceRemoveAllQuestElements, [], this);
        this.time.delayedCall(1000, this.forceRemoveAllQuestElements, [], this);
        
        // Check if tasks need to be updated based on high score/wave
        this.checkTaskCompletion();
    }
    
    // Aggressive cleanup of quest elements - will search and destroy all quest-related UI elements
    forceRemoveAllQuestElements() {
        console.log("Force removing all quest elements");
        
        // First try to clean up using existing methods
        this.cleanupNotifications();
        
        if (this.questNotification) {
            this.questNotification.destroy();
            this.questNotification = null;
        }

        // Now scan the ENTIRE scene for ANY quest-related elements
        const purpleTints = [0xff00ff, 0x880088, 0x550055, 0xaa00aa, 0xdd00dd];
        
        // Find all objects in the scene
        const objects = this.children.list;
        
        objects.forEach(obj => {
            // Skip any background elements by checking depth
            if (obj.depth !== undefined && obj.depth < 0) {
                return; // Skip background elements (they have negative depth)
            }
            
            // Skip bg layers or star containers explicitly
            if ((obj.type === 'Container' && 
                 (obj === this.bgLayers?.far || 
                  obj === this.bgLayers?.mid || 
                  obj === this.bgLayers?.near))) {
                return;
            }
            
            // Skip any object that belongs to background
            if (this.isBackgroundElement(obj)) {
                return;
            }
            
            // Skip star particles
            if (obj.type === 'Particle' || 
                (obj.texture && obj.texture.key === 'particle')) {
                return;
            }
            
            // Check for quest textures directly
            if (obj.texture && (obj.texture.key === 'quest' || obj.texture.key === 'questcomplete')) {
                console.log("Found quest texture:", obj.texture.key);
                obj.destroy();
                return;
            }
            
            // Check for purple-tinted objects that are likely quest-related
            if (obj.tintTopLeft && purpleTints.includes(obj.tintTopLeft)) {
                // Skip if it's the play button glow
                if (obj === this.playGlow) return;
                
                console.log("Found purple tinted object");
                obj.destroy();
                return;
            }
            
            // Check for purple fill colors - ONLY for small objects likely to be quest indicators
            if (obj.fillColor && purpleTints.includes(obj.fillColor)) {
                // Skip the play button glow which is also purple
                if (obj === this.playGlow) return;
                
                // Only remove small purple objects that are likely quest indicators
                const isSmall = obj.width < 50 && obj.height < 50;
                
                // Skip if it's part of essential UI (settings, ship selection, etc.)
                if (isSmall && !this.isEssentialUIElement(obj)) {
                    console.log("Found small purple fill color object");
                    obj.destroy();
                    return;
                }
            }
            
            // If it's a container, check its children, but ONLY for small containers
            if (obj.type === 'Container') {
                // Don't check essential UI containers to avoid breaking the UI
                if (this.isEssentialUIComponent(obj)) {
                    return;
                }
                
                // Only check small containers that are likely notifications
                const isSmallContainer = !obj.width || obj.width < 200;
                const isTopAreaContainer = obj.y < 100;
                
                if (isSmallContainer && isTopAreaContainer) {
                    console.log("Found small top container, checking for quest elements");
                    
                    // Check if this container includes quest-related elements
                    const hasQuestElements = this.containerHasQuestElements(obj);
                    if (hasQuestElements) {
                        console.log("Found container with quest elements");
                        obj.destroy();
                        return;
                    }
                    
                    // If it's a standalone notification in the top area
                    if (obj.y < 100 && (!obj.width || obj.width < 100)) {
                        console.log("Found probable notification container at y=", obj.y);
                        obj.destroy();
                        return;
                    }
                }
            }
        });
    }
    
    // Check if an element is part of the background
    isBackgroundElement(obj) {
        // Check if it belongs to any background layer
        if (this.bgLayers) {
            for (const layer of Object.values(this.bgLayers)) {
                if (this.isChildOfContainer(obj, layer)) {
                    return true;
                }
            }
        }
        
        // Check for particles, stars, or nebula elements
        if (this.stars && this.stars.some(star => star.sprite === obj)) {
            return true;
        }
        
        // Check depth - background elements usually have negative depth
        if (obj.depth !== undefined && obj.depth < 0) {
            return true;
        }
        
        return false;
    }
    
    // Check if a container is an essential UI component
    isEssentialUIComponent(container) {
        const essentialContainers = [
            this.shipSelectionPanel,
            this.settingsPanel,
            this.taskListPanel,
            this.difficultySelectionPanel,
            this.shipShowcase,
            this.difficultyShowcase,
            this.scorePanel
        ];
        
        return essentialContainers.includes(container);
    }
    
    // Check if a container has any quest-related elements
    containerHasQuestElements(container) {
        if (!container || !container.list) return false;
        
        const purpleTints = [0xff00ff, 0x880088, 0x550055, 0xaa00aa, 0xdd00dd];
        
        for (const child of container.list) {
            // Check for quest textures
            if (child.texture && (child.texture.key === 'quest' || child.texture.key === 'questcomplete')) {
                return true;
            }
            
            // Check for purple tints
            if (child.tintTopLeft && purpleTints.includes(child.tintTopLeft)) {
                return true;
            }
            
            // Check for purple fill colors
            if (child.fillColor && purpleTints.includes(child.fillColor)) {
                return true;
            }
            
            // Check for text that mentions quests or challenges
            if (child.text && (child.text.includes('QUEST') || child.text.includes('CHALLENGE'))) {
                return true;
            }
            
            // Recursively check child containers
            if (child.type === 'Container' && this.containerHasQuestElements(child)) {
                return true;
            }
        }
        
        return false;
    }
    
    // Add explicit cleanup to the showQuestCompletedNotification method
    showQuestCompletedNotification(task, delay = 0) {
        // Skip notifications in the main menu scene
        if (this.scene.key === 'MainMenu') {
            console.log("Skipping quest notification in MainMenu scene");
            return;
        }
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create notification container - make it smaller and position it at the top of the screen
        const notification = this.add.container(width / 2, 70);
        notification.setDepth(1000);
        
        // Track this notification
        this.activeNotifications.push(notification);
        
        // Background - reduced size
        const bg = this.add.rectangle(0, 0, 350, 60, 0x000000, 0.8);
        bg.setStrokeStyle(2, 0xff00ff);
        notification.add(bg);
        
        // Quest complete icon - smaller size
        const questIcon = this.add.image(-140, 0, 'questcomplete');
        questIcon.setDisplaySize(30, 30);
        notification.add(questIcon);
        
        // Completed text - smaller font
        const title = this.add.text(-100, -15, 'QUEST COMPLETED!', {
            font: 'bold 16px Arial',
            fill: '#ffff00'
        });
        title.setOrigin(0.5);
        notification.add(title);
        
        // Quest description - smaller font
        const description = this.add.text(-100, 15, task.description, {
            font: '14px Arial',
            fill: '#ffffff'
        });
        description.setOrigin(0, 0.5);
        notification.add(description);
        
        // Set initial state for animation
        notification.setAlpha(0);
        notification.y -= 30;
        
        // Delayed appearance for multiple notifications
        this.time.delayedCall(delay * 500, () => {
            // Play sound
            this.sound.play('button-sound', { volume: this.soundVolume * 1.5 });
            
            // Animate in
            this.tweens.add({
                targets: notification,
                y: 70,
                alpha: 1,
                duration: 300,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Animate quest icon - subtler animation
                    this.tweens.add({
                        targets: questIcon,
                        scale: { from: 1, to: 1.2 },
                        duration: 400,
                        yoyo: true,
                        repeat: 2
                    });
                    
                    // Wait and fade out - shorter duration
                    this.time.delayedCall(2000, () => {
                        this.tweens.add({
                            targets: notification,
                            y: notification.y - 30,
                            alpha: 0,
                            duration: 300,
                            ease: 'Back.easeIn',
                            onComplete: () => {
                                // Remove from tracking array
                                const index = this.activeNotifications.indexOf(notification);
                                if (index > -1) {
                                    this.activeNotifications.splice(index, 1);
                                }
                                notification.destroy();
                            }
                        });
                    });
                }
            });
        });
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
        
        // Clean up any active notifications
        this.cleanupNotifications();
        
        // Make sure to destroy any quest notification indicator
        if (this.questNotification) {
            this.questNotification.destroy();
            this.questNotification = null;
        }
        
        // Find and destroy all quest-related elements that might be leftover
        this.cleanupQuestElements();
    }
    
    // Helper method to cleanup all active notifications
    cleanupNotifications() {
        // Destroy all active notifications
        if (this.activeNotifications && this.activeNotifications.length > 0) {
            this.activeNotifications.forEach(notification => {
                if (notification && notification.destroy) {
                    notification.destroy();
                }
            });
            this.activeNotifications = [];
        }
    }
    
    // Find and destroy any quest-related elements that might be leftover
    cleanupQuestElements() {
        if (this.children && this.children.list) {
            // Look for any quest-related containers, images, or notification elements
            this.children.list.forEach(child => {
                // Look for quest icons or purple UI elements
                if ((child.texture && (child.texture.key === 'quest' || child.texture.key === 'questcomplete')) ||
                    (child.type === 'Container' && child.name === 'questNotification') ||
                    (child.fillColor === 0xff00ff || child.fillColor === 0x880088 || child.fillColor === 0x550055)) {
                    
                    // Check if it's not part of a necessary UI element
                    if (!this.isEssentialUIElement(child)) {
                        console.log('Removing quest element:', child.type, child.name);
                        child.destroy();
                    }
                }
                
                // Check for containers that might contain quest notifications
                if (child.type === 'Container') {
                    const purpleElements = this.findPurpleElements(child);
                    if (purpleElements.length > 0 && !this.isEssentialUIElement(child)) {
                        console.log('Removing container with purple elements');
                        child.destroy();
                    }
                }
            });
        }
    }
    
    // Helper to find purple elements in containers
    findPurpleElements(container) {
        const purpleElements = [];
        if (container && container.list) {
            container.list.forEach(item => {
                if (item.fillColor === 0xff00ff || 
                    item.fillColor === 0x880088 || 
                    item.fillColor === 0x550055 ||
                    (item.texture && (item.texture.key === 'quest' || item.texture.key === 'questcomplete'))) {
                    purpleElements.push(item);
                }
            });
        }
        return purpleElements;
    }
    
    // Check if the element is part of essential UI that should not be removed
    isEssentialUIElement(element) {
        // Don't remove elements that are part of these essential UI containers
        const essentialContainers = [
            this.shipSelectionPanel,
            this.difficultySelectionPanel, 
            this.settingsPanel,
            this.scorePanel,
            this.taskListPanel,
            this.shipShowcase,
            this.difficultyShowcase
        ];
        
        // Check if the element is or belongs to an essential container
        for (const container of essentialContainers) {
            if (container && (element === container || this.isChildOfContainer(element, container))) {
                return true;
            }
        }
        
        return false;
    }
    
    // Check if an element is a child of a container
    isChildOfContainer(element, container) {
        if (!container || !container.list) return false;
        
        // Direct children
        if (container.list.includes(element)) return true;
        
        // Check nested containers
        for (const child of container.list) {
            if (child.type === 'Container' && this.isChildOfContainer(element, child)) {
                return true;
            }
        }
        
        return false;
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
    
    // Load selected difficulty from localStorage
    loadSelectedDifficulty() {
        try {
            const savedDifficulty = localStorage.getItem('selectedDifficulty');
            if (savedDifficulty) {
                // Find the index of the saved difficulty
                const index = this.difficulties.findIndex(diff => diff.id === savedDifficulty);
                if (index !== -1) {
                    this.selectedDifficultyIndex = index;
                }
            }
        } catch (e) {
            console.error('Error loading selected difficulty:', e);
        }
    }
    
    // Save selected difficulty to localStorage
    saveSelectedDifficulty() {
        try {
            const difficultyId = this.difficulties[this.selectedDifficultyIndex].id;
            localStorage.setItem('selectedDifficulty', difficultyId);
            localStorage.setItem('selectedDifficultyIndex', this.selectedDifficultyIndex.toString());
            console.log('Saved selected difficulty:', difficultyId);
        } catch (e) {
            console.error('Error saving selected difficulty:', e);
        }
    }
    
    createShipSelectionPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create a container for all ship selection elements
        this.shipSelectionPanel = this.add.container(width / 2, height / 2);
        this.shipSelectionPanel.setDepth(100);
        
        // Add panel background - increased height from 550 to 590
        const panelBg = this.add.rectangle(0, 0, 600, 590, 0x220022, 0.9);
        panelBg.setStrokeStyle(3, 0xff00ff, 0.8);
        this.shipSelectionPanel.add(panelBg);
        
        // Add title - moved up by 10px (from -180 to -190)
        const title = this.add.text(0, -190, 'SELECT YOUR SHIP', {
            font: 'bold 32px Arial',
            fill: '#ffff00',
            stroke: '#880088',
            strokeThickness: 2
        });
        title.setOrigin(0.5);
        this.shipSelectionPanel.add(title);
        
        // Add close button - moved up by 10px (from -180 to -190)
        const closeButton = this.add.text(280, -190, '✕', {
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
        
        // Ship name - moved up by 10px (from -120 to -130)
        const shipName = this.add.text(0, -130, currentShip.name, {
            font: 'bold 28px Arial',
            fill: '#ffffff',
            stroke: '#550055',
            strokeThickness: 2
        });
        shipName.setOrigin(0.5);
        this.shipDisplayContainer.add(shipName);
        
        // Ship description - moved up by 10px (from -85 to -95)
        const shipDesc = this.add.text(0, -95, currentShip.description, {
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
        
        // Ship sprite with adjusted scale - moved up by 10px (from 0 to -10)
        const shipSprite = this.add.image(0, -10, currentShip.sprite);
        shipSprite.setScale(displayScale);
        this.shipDisplayContainer.add(shipSprite);
        
        // Add glow effect behind ship - increased size - moved up by 10px (from 0 to -10)
        const glow = this.add.ellipse(0, -10, 250, 120, 0xff00ff, 0.2);
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
        
        // Add select button - moved up by 10px (from 250 to 240)
        const selectBtnBg = this.add.rectangle(0, 240, 180, 50, 0x880088, 0.8);
        selectBtnBg.setStrokeStyle(2, 0xff00ff, 1);
        this.shipDisplayContainer.add(selectBtnBg);
        
        const selectBtn = this.add.text(0, 240, 'SELECT', {
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
        // Health bar - moved up by 10px (from 80 to 70)
        this.createStatBar('HEALTH', ship.hp, 70, 0xff0000);
        
        // Damage bar - moved up by 10px (from 120 to 110)
        this.createStatBar('DAMAGE', ship.damage, 110, 0xffcc00);
        
        // Speed bar - moved up by 10px (from 160 to 150)
        this.createStatBar('SPEED', ship.speed, 150, 0x00ffff);
        
        // Fire Rate bar - moved up by 10px (from 200 to 190)
        this.createStatBar('FIRE RATE', ship.fireRate, 190, 0xffaa00);
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
        // Left arrow - moved up by 10px (from 0 to -10)
        const leftArrow = this.add.text(-220, -10, '⟨', {
            font: 'bold 90px Arial',
            fill: '#ffaaff'
        });
        leftArrow.setOrigin(0.5);
        leftArrow.setInteractive({ useHandCursor: true });
        this.shipSelectionPanel.add(leftArrow);
        
        // Right arrow - moved up by 10px (from 0 to -10)
        const rightArrow = this.add.text(220, -10, '⟩', {
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
            if (this.difficultySelectionVisible) {
                this.toggleDifficultySelectionPanel();
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
    
    createDifficultySelectionPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create a container for all difficulty selection elements
        this.difficultySelectionPanel = this.add.container(width / 2, height / 2);
        this.difficultySelectionPanel.setDepth(100);
        
        // Add panel background
        const panelBg = this.add.rectangle(0, 0, 600, 450, 0x220022, 0.9);
        panelBg.setStrokeStyle(3, 0xff00ff, 0.8);
        this.difficultySelectionPanel.add(panelBg);
        
        // Add title
        const title = this.add.text(0, -180, 'SELECT DIFFICULTY', {
            font: 'bold 32px Arial',
            fill: '#ffff00',
            stroke: '#880088',
            strokeThickness: 2
        });
        title.setOrigin(0.5);
        this.difficultySelectionPanel.add(title);
        
        // Add close button
        const closeButton = this.add.text(280, -180, '✕', {
            font: 'bold 24px Arial',
            fill: '#ffffff'
        });
        closeButton.setOrigin(0.5);
        closeButton.setInteractive({ useHandCursor: true });
        this.difficultySelectionPanel.add(closeButton);
        
        // Close button hover effects
        closeButton.on('pointerover', () => {
            closeButton.setStyle({ fill: '#ff5555' });
        });
        
        closeButton.on('pointerout', () => {
            closeButton.setStyle({ fill: '#ffffff' });
        });
        
        // Close button functionality
        closeButton.on('pointerup', () => {
            this.toggleDifficultySelectionPanel();
        });
        
        // Create difficulty options
        this.createDifficultyOptions();
        
        // Initially hide the panel
        this.difficultySelectionPanel.setVisible(false);
        this.difficultySelectionVisible = false;
    }
    
    createDifficultyOptions() {
        const yStartPosition = -100;
        const spacing = 110;
        
        // Create each difficulty option
        this.difficulties.forEach((difficulty, index) => {
            const yPosition = yStartPosition + (index * spacing);
            
            // Create difficulty container
            const diffContainer = this.add.container(0, yPosition);
            this.difficultySelectionPanel.add(diffContainer);
            
            // Background panel - highlighted if selected
            const isSelected = index === this.selectedDifficultyIndex;
            const bgColor = isSelected ? 0x550055 : 0x330033;
            const bg = this.add.rectangle(0, 0, 500, 95, bgColor, 0.8);
            bg.setStrokeStyle(2, isSelected ? 0xff00ff : 0x880088, isSelected ? 1 : 0.6);
            diffContainer.add(bg);
            
            // Difficulty name
            const nameText = this.add.text(-230, -30, difficulty.name, {
                font: 'bold 28px Arial',
                fill: isSelected ? '#ffffff' : '#cccccc'
            });
            nameText.setOrigin(0, 0.5);
            diffContainer.add(nameText);
            
            // Difficulty description
            const descText = this.add.text(-230, 10, difficulty.description, {
                font: '18px Arial',
                fill: isSelected ? '#cccccc' : '#aaaaaa'
            });
            descText.setOrigin(0, 0.5);
            diffContainer.add(descText);
            
            // Make the entire difficulty option interactive
            bg.setInteractive({ useHandCursor: true });
            
            // Hover effects
            bg.on('pointerover', () => {
                if (index !== this.selectedDifficultyIndex) {
                    bg.setFillStyle(0x440044, 0.8);
                    nameText.setStyle({ fill: '#dddddd' });
                    descText.setStyle({ fill: '#bbbbbb' });
                }
            });
            
            bg.on('pointerout', () => {
                if (index !== this.selectedDifficultyIndex) {
                    bg.setFillStyle(0x330033, 0.8);
                    nameText.setStyle({ fill: '#cccccc' });
                    descText.setStyle({ fill: '#aaaaaa' });
                }
            });
            
            // Selection functionality
            bg.on('pointerup', () => {
                // Play selection sound
                this.sound.play('button-sound', { volume: this.soundVolume });
                
                // Set new selection
                this.selectedDifficultyIndex = index;
                
                // Save the selection
                this.saveSelectedDifficulty();
                
                // Refresh the display
                this.refreshDifficultyOptions();
                
                // Visual feedback
                this.tweens.add({
                    targets: bg,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 100,
                    yoyo: true
                });
            });
        });
    }
    
    refreshDifficultyOptions() {
        // Remove existing options
        while (this.difficultySelectionPanel.list.length > 3) {
            this.difficultySelectionPanel.list[3].destroy();
            this.difficultySelectionPanel.list.splice(3, 1);
        }
        
        // Recreate with updated selections
        this.createDifficultyOptions();
        
        // Update the difficulty showcase display
        this.updateDifficultyShowcase();
    }
    
    toggleDifficultySelectionPanel() {
        this.difficultySelectionVisible = !this.difficultySelectionVisible;
        this.difficultySelectionPanel.setVisible(this.difficultySelectionVisible);
        
        // Add fade in/out animation
        if (this.difficultySelectionVisible) {
            // Hide other panels if they're open
            if (this.settingsVisible) {
                this.toggleSettingsPanel();
            }
            if (this.taskListVisible) {
                this.toggleTaskListPanel();
            }
            if (this.shipSelectionVisible) {
                this.toggleShipSelectionPanel();
            }
            
            this.difficultySelectionPanel.alpha = 0;
            this.tweens.add({
                targets: this.difficultySelectionPanel,
                alpha: 1,
                duration: 200
            });
        } else {
            this.tweens.add({
                targets: this.difficultySelectionPanel,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    this.difficultySelectionPanel.setVisible(false);
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
        this.scorePanel = this.add.container(width * 0.25 - 45, height / 2 + 100);
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
        const height = this.cameras.main.height;
        
        // Create tasks button using image - even smaller scale
        const taskButton = this.add.image(60, 50, 'questsbtn');
        taskButton.setScale(0.1);
        taskButton.setDepth(10);
        
        // Make button interactive
        taskButton.setInteractive({ useHandCursor: true });
        
        // Button hover effect
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
        
        // Add quest completion notification
        this.updateQuestButton(taskButton);
    }
    
    // Update quest button to show notification for available completed quests
    updateQuestButton(taskButton) {
        const completedTasks = this.getCompletedTasks();
        
        // Remove any existing notification first
        if (this.questNotification) {
            this.questNotification.destroy();
            this.questNotification = null;
        }
        
        // If there are completed tasks, show a notification icon
        if (completedTasks.length > 0) {
            // Create a small container for the notification
            const notificationContainer = this.add.container(taskButton.x + 15, taskButton.y - 15);
            notificationContainer.setDepth(11);
            notificationContainer.name = 'questNotification'; // Add name for identification
            
            // Add a small circle background
            const notificationBg = this.add.circle(0, 0, 8, 0x000000, 0.7);
            notificationBg.setStrokeStyle(1, 0xff00ff);
            notificationContainer.add(notificationBg);
            
            // Add a count if there are multiple completed quests
            if (completedTasks.length > 1) {
                const countText = this.add.text(0, 0, completedTasks.length.toString(), {
                    font: 'bold 9px Arial',
                    fill: '#ffffff'
                });
                countText.setOrigin(0.5);
                notificationContainer.add(countText);
            } else {
                // Add a small dot for a single completed quest
                const dot = this.add.circle(0, 0, 4, 0xff00ff, 1);
                notificationContainer.add(dot);
            }
            
            // Animation to draw attention
            this.tweens.add({
                targets: notificationContainer,
                scale: { from: 0.8, to: 1.1 },
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
            
            // Store reference to remove later if needed
            this.questNotification = notificationContainer;
        }
    }
    
    createDifficultyButton() {
        // Create difficulty button positioned to the right of the quests button
        const difficultyButton = this.add.image(130, 50, 'difficultybtn');
        difficultyButton.setScale(0.085);
        difficultyButton.setDepth(10);
        
        // Make button interactive
        difficultyButton.setInteractive({ useHandCursor: true });
        
        // Add hover effects
        difficultyButton.on('pointerover', () => {
            this.tweens.add({
                targets: difficultyButton,
                scale: 0.11,
                duration: 100
            });
        });
        
        difficultyButton.on('pointerout', () => {
            this.tweens.add({
                targets: difficultyButton,
                scale: 0.1,
                duration: 100
            });
        });
        
        // Add down-press effect
        difficultyButton.on('pointerdown', () => {
            this.tweens.add({
                targets: difficultyButton,
                scale: 0.09,
                duration: 50
            });
        });
        
        // Toggle difficulty selection panel on click with sound
        difficultyButton.on('pointerup', () => {
            this.tweens.add({
                targets: difficultyButton,
                scale: 0.1,
                duration: 50
            });
            this.sound.play('button-sound', { volume: this.soundVolume });
            this.toggleDifficultySelectionPanel();
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
            
            // Add quest icon based on completion status
            const questIcon = this.add.image(-200, 0, isCompleted ? 'questcomplete' : 'quest');
            questIcon.setDisplaySize(50, 50);
            taskContainer.add(questIcon);
            
            // Add glow effect to completed quests
            if (isCompleted) {
                this.tweens.add({
                    targets: questIcon,
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
                } else if (task.type === 'waveCompleted') {
                    const highestWaveCompleted = parseInt(localStorage.getItem('highestWaveCompleted') || '0');
                    progress = Math.min(1, highestWaveCompleted / task.target);
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
        // Get current high score and completed wave
        const highScore = parseInt(localStorage.getItem('highScore') || '0');
        const highestWaveCompleted = parseInt(localStorage.getItem('highestWaveCompleted') || '0');
        
        // Track newly completed tasks for notifications
        let newlyCompletedTasks = [];
        
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
            } else if (task.type === 'waveCompleted' && highestWaveCompleted >= task.target) {
                isCompleted = true;
            }
            // Add to completed tasks if newly completed
            if (isCompleted) {
                completedTasks.push(task.id);
                updatedTasks = true;
                newlyCompletedTasks.push(task);
            }
        });
        
        // Save updated task list if changes were made
        if (updatedTasks) {
            this.saveCompletedTasks(completedTasks);
            
            // Update the quest button notification
            const taskButton = this.children.list.find(child => 
                child.type === 'Image' && child.texture.key === 'questsbtn');
            if (taskButton) {
                this.updateQuestButton(taskButton);
            }
            
            // If task list is open, refresh it
            if (this.taskListVisible && this.taskListPanel) {
                this.recreateTaskList();
            }
            
            // Show notifications for newly completed tasks
            newlyCompletedTasks.forEach((task, index) => {
                this.showQuestCompletedNotification(task, index);
            });
        }
    }
    
    // Show notification for completed quest
    showQuestCompletedNotification(task, delay = 0) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create notification container - make it smaller and position it at the top of the screen
        const notification = this.add.container(width / 2, 70);
        notification.setDepth(1000);
        
        // Track this notification
        this.activeNotifications.push(notification);
        
        // Background - reduced size
        const bg = this.add.rectangle(0, 0, 350, 60, 0x000000, 0.8);
        bg.setStrokeStyle(2, 0xff00ff);
        notification.add(bg);
        
        // Quest complete icon - smaller size
        const questIcon = this.add.image(-140, 0, 'questcomplete');
        questIcon.setDisplaySize(30, 30);
        notification.add(questIcon);
        
        // Completed text - smaller font
        const title = this.add.text(-100, -15, 'QUEST COMPLETED!', {
            font: 'bold 16px Arial',
            fill: '#ffff00'
        });
        title.setOrigin(0.5);
        notification.add(title);
        
        // Quest description - smaller font
        const description = this.add.text(-100, 15, task.description, {
            font: '14px Arial',
            fill: '#ffffff'
        });
        description.setOrigin(0, 0.5);
        notification.add(description);
        
        // Set initial state for animation
        notification.setAlpha(0);
        notification.y -= 30;
        
        // Delayed appearance for multiple notifications
        this.time.delayedCall(delay * 500, () => {
            // Play sound
            this.sound.play('button-sound', { volume: this.soundVolume * 1.5 });
            
            // Animate in
            this.tweens.add({
                targets: notification,
                y: 70,
                alpha: 1,
                duration: 300,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Animate quest icon - subtler animation
                    this.tweens.add({
                        targets: questIcon,
                        scale: { from: 1, to: 1.2 },
                        duration: 400,
                        yoyo: true,
                        repeat: 2
                    });
                    
                    // Wait and fade out - shorter duration
                    this.time.delayedCall(2000, () => {
                        this.tweens.add({
                            targets: notification,
                            y: notification.y - 30,
                            alpha: 0,
                            duration: 300,
                            ease: 'Back.easeIn',
                            onComplete: () => {
                                // Remove from tracking array
                                const index = this.activeNotifications.indexOf(notification);
                                if (index > -1) {
                                    this.activeNotifications.splice(index, 1);
                                }
                                notification.destroy();
                            }
                        });
                    });
                }
            });
        });
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
        
        // Update the quest button notification
        const taskButton = this.children.list.find(child => 
            child.type === 'Image' && child.texture.key === 'questsbtn');
        if (taskButton) {
            this.updateQuestButton(taskButton);
        }
    }

    // Create ship showcase on the right side of the screen
    createShipShowcase() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create container for ship showcase - moved 65px to the right and 110px up
        this.shipShowcase = this.add.container(width * 0.75 + 65, height / 2 + 110);
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

    // Create difficulty showcase below ship showcase
    createDifficultyShowcase() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create container for difficulty showcase - position it below ship showcase
        this.difficultyShowcase = this.add.container(width * 0.75 + 65, height / 2 + 220);
        this.difficultyShowcase.setDepth(10);
        
        // Add background panel
        const showcaseBg = this.add.rectangle(0, 0, 230, 90, 0x330033, 0.7);
        showcaseBg.setStrokeStyle(2, 0xff00ff, 0.8);
        this.difficultyShowcase.add(showcaseBg);
        
        // Get current difficulty data
        const currentDifficulty = this.difficulties[this.selectedDifficultyIndex];
        
        // Add difficulty label
        const difficultyLabel = this.add.text(0, -30, 'DIFFICULTY', {
            font: 'bold 18px Arial',
            fill: '#ffffff'
        });
        difficultyLabel.setOrigin(0.5);
        this.difficultyShowcase.add(difficultyLabel);
        
        // Add current difficulty display
        this.difficultyName = this.add.text(0, 5, currentDifficulty.name, {
            font: 'bold 24px Arial',
            fill: this.getDifficultyColor(currentDifficulty.id)
        });
        this.difficultyName.setOrigin(0.5);
        this.difficultyShowcase.add(this.difficultyName);
        
        // Change difficulty button
        const difficultyButtonBg = this.add.rectangle(0, 35, 160, 30, 0x660066, 0.8);
        difficultyButtonBg.setStrokeStyle(2, 0xff00ff, 0.8);
        this.difficultyShowcase.add(difficultyButtonBg);
        
        const difficultyButton = this.add.text(0, 35, 'CHANGE', {
            font: 'bold 16px Arial',
            fill: '#ffffff'
        });
        difficultyButton.setOrigin(0.5);
        difficultyButton.setInteractive({ useHandCursor: true });
        this.difficultyShowcase.add(difficultyButton);
        
        // Button hover effect
        difficultyButton.on('pointerover', () => {
            difficultyButton.setStyle({ fill: '#ff88ff' });
            this.tweens.add({
                targets: [difficultyButton, difficultyButtonBg],
                scale: 1.05,
                duration: 100
            });
        });
        
        difficultyButton.on('pointerout', () => {
            difficultyButton.setStyle({ fill: '#ffffff' });
            this.tweens.add({
                targets: [difficultyButton, difficultyButtonBg],
                scale: 1,
                duration: 100
            });
        });
        
        // Add down-press effect
        difficultyButton.on('pointerdown', () => {
            this.tweens.add({
                targets: difficultyButton,
                scale: 0.09,
                duration: 50
            });
        });
        
        // Toggle difficulty selection panel on click with sound
        difficultyButton.on('pointerup', () => {
            this.tweens.add({
                targets: [difficultyButton, difficultyButtonBg],
                scale: 0.1,
                duration: 50
            });
            this.sound.play('button-sound', { volume: this.soundVolume });
            this.toggleDifficultySelectionPanel();
        });
    }

    // Helper method to get color for difficulty name based on difficulty
    getDifficultyColor(difficultyId) {
        switch(difficultyId) {
            case 'easy':
                return '#00ff00'; // Green for easy
            case 'normal':
                return '#ffff00'; // Yellow for normal
            case 'hard':
                return '#ff0000'; // Red for hard
            default:
                return '#ffffff'; // White as fallback
        }
    }

    // Update difficulty showcase with newly selected difficulty
    updateDifficultyShowcase() {
        if (this.difficultyName) {
            const currentDifficulty = this.difficulties[this.selectedDifficultyIndex];
            this.difficultyName.setText(currentDifficulty.name);
            this.difficultyName.setStyle({ 
                fill: this.getDifficultyColor(currentDifficulty.id) 
            });
            
            // Add pulse animation on update
            this.tweens.add({
                targets: this.difficultyName,
                scale: { from: 1, to: 1.2 },
                duration: 200,
                yoyo: true
            });
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
        
        // Clean up any active notifications
        this.cleanupNotifications();
        
        // Make sure to destroy quest notification indicator
        if (this.questNotification) {
            this.questNotification.destroy();
            this.questNotification = null;
        }
        
        // Cleanup any leftover quest elements
        this.cleanupQuestElements();
        
        // Call the parent shutdown method
        super.shutdown();
    }
} 