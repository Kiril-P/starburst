export default class UpgradeScreen {
    constructor(scene) {
        this.scene = scene;
        this.isActive = false;
        this.upgradeContainer = null;
        this.upgradeOptions = [];
        this.selectedUpgrade = null;
        
        // Icons and descriptions for each upgrade
        this.upgradeInfo = {
            'dash': {
                name: 'Dash',
                description: 'Press SHIFT to dash quickly in the movement direction with brief invulnerability.',
                icon: 'dash-icon', // Icon texture key
                color: 0xffff00
            },
            'phase-shift': {
                name: 'Phase Shift',
                description: 'Press X to become intangible for 3 seconds, passing through enemies and bullets.',
                icon: 'phase-icon', // Icon texture key
                color: 0x8080ff
            },
            'forcefield': {
                name: 'Forcefield',
                description: 'Press Z to clear all bullets from the screen.',
                icon: 'forcefield-icon', // Icon texture key
                color: 0x00aaff
            },
            'improved-thrusters': {
                name: 'Improved Thrusters',
                description: 'Permanently increase your movement speed by 100.',
                icon: 'thruster-icon', // Icon texture key
                color: 0xff8800
            },
            'full-heal': {
                name: 'Emergency Repair',
                description: 'Restore your ship to full health.',
                icon: 'repair-icon', // Icon texture key
                color: 0x00ff00
            }
        };
    }
    
    showUpgrades(upgrades) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.upgradeOptions = upgrades;
        
        // Pause the game while showing upgrades
        this.scene.physics.pause();
        
        // Create darkened background
        this.background = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0.7
        );
        this.background.setDepth(1000);
        
        // Create container for all upgrade elements
        this.upgradeContainer = this.scene.add.container(0, 0);
        this.upgradeContainer.setDepth(1001);
        
        // Add title
        const titleText = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            100,
            'SELECT AN UPGRADE',
            {
                font: 'bold 32px Arial',
                fill: '#ffffff',
                align: 'center'
            }
        );
        titleText.setOrigin(0.5);
        this.upgradeContainer.add(titleText);
        
        // Create upgrade cards
        this.createUpgradeCards();
    }
    
    createUpgradeCards() {
        const cardWidth = 250;
        const cardHeight = 300;
        const padding = 20;
        const startX = (this.scene.cameras.main.width - (cardWidth * this.upgradeOptions.length + padding * (this.upgradeOptions.length - 1))) / 2 + cardWidth / 2;
        const startY = this.scene.cameras.main.height / 2;
        
        // Create a card for each upgrade option
        this.upgradeOptions.forEach((upgrade, index) => {
            const x = startX + index * (cardWidth + padding);
            const y = startY;
            
            // Card background
            const card = this.scene.add.rectangle(x, y, cardWidth, cardHeight, 0x333333, 0.9);
            card.setStrokeStyle(2, this.upgradeInfo[upgrade].color);
            this.upgradeContainer.add(card);
            
            // Add upgrade name
            const nameText = this.scene.add.text(
                x,
                y - cardHeight / 2 + 40,
                this.upgradeInfo[upgrade].name,
                {
                    font: 'bold 24px Arial',
                    fill: '#ffffff',
                    align: 'center'
                }
            );
            nameText.setOrigin(0.5);
            this.upgradeContainer.add(nameText);
            
            // Add placeholder for icon (would be a sprite in a real implementation)
            const iconCircle = this.scene.add.circle(x, y - 50, 40, this.upgradeInfo[upgrade].color, 0.8);
            this.upgradeContainer.add(iconCircle);
            
            // Add description text
            const descText = this.scene.add.text(
                x,
                y + 50,
                this.upgradeInfo[upgrade].description,
                {
                    font: '16px Arial',
                    fill: '#ffffff',
                    align: 'center',
                    wordWrap: { width: cardWidth - 20 }
                }
            );
            descText.setOrigin(0.5);
            this.upgradeContainer.add(descText);
            
            // Add select button
            const selectButton = this.scene.add.rectangle(
                x,
                y + cardHeight / 2 - 30,
                cardWidth - 40,
                40,
                0x555555,
                1
            );
            selectButton.setInteractive({ useHandCursor: true });
            this.upgradeContainer.add(selectButton);
            
            const buttonText = this.scene.add.text(
                x,
                y + cardHeight / 2 - 30,
                'SELECT',
                {
                    font: 'bold 18px Arial',
                    fill: '#ffffff',
                    align: 'center'
                }
            );
            buttonText.setOrigin(0.5);
            this.upgradeContainer.add(buttonText);
            
            // Button events
            selectButton.on('pointerover', () => {
                selectButton.fillColor = this.upgradeInfo[upgrade].color;
            });
            
            selectButton.on('pointerout', () => {
                selectButton.fillColor = 0x555555;
            });
            
            selectButton.on('pointerdown', () => {
                this.selectUpgrade(upgrade);
            });
            
            // Add a glow effect
            this.scene.tweens.add({
                targets: card,
                alpha: { from: 0.9, to: 1 },
                yoyo: true,
                repeat: -1,
                duration: 1500,
                ease: 'Sine.easeInOut'
            });
        });
    }
    
    selectUpgrade(upgrade) {
        this.selectedUpgrade = upgrade;
        
        // Apply the upgrade
        this.scene.player.unlockAbility(upgrade);
        
        // Show selection effect
        this.showSelectionEffect(upgrade);
        
        // Close the upgrade screen after a short delay
        this.scene.time.delayedCall(1500, () => {
            this.closeScreen();
        });
    }
    
    showSelectionEffect(upgrade) {
        // Find the card for this upgrade
        const index = this.upgradeOptions.indexOf(upgrade);
        const cardWidth = 250;
        const padding = 20;
        const startX = (this.scene.cameras.main.width - (cardWidth * this.upgradeOptions.length + padding * (this.upgradeOptions.length - 1))) / 2 + cardWidth / 2;
        const x = startX + index * (cardWidth + padding);
        const y = this.scene.cameras.main.height / 2;
        
        // Create a flash effect
        const flash = this.scene.add.rectangle(x, y, cardWidth, 300, this.upgradeInfo[upgrade].color, 0.8);
        flash.setDepth(1002);
        
        // Pulse animation
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.5,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                flash.destroy();
            }
        });
        
        // Display a "selected" text
        const selectedText = this.scene.add.text(
            x,
            y,
            'UPGRADE ACQUIRED!',
            {
                font: 'bold 24px Arial',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }
        );
        selectedText.setOrigin(0.5);
        selectedText.setDepth(1003);
        
        // Animate the text
        this.scene.tweens.add({
            targets: selectedText,
            y: y - 50,
            alpha: 0,
            scale: 1.5,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                selectedText.destroy();
            }
        });
    }
    
    closeScreen() {
        if (!this.isActive) return;
        
        // Resume the game
        this.scene.physics.resume();
        
        // Clean up all elements
        if (this.background) {
            this.background.destroy();
        }
        if (this.upgradeContainer) {
            this.upgradeContainer.destroy(true);
        }
        
        this.isActive = false;
        this.upgradeOptions = [];
        this.selectedUpgrade = null;
        
        // Notify the game that the upgrade selection is complete
        this.scene.events.emit('upgrade-selection-complete');
    }
} 