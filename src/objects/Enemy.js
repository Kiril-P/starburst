// One pooled enemy sprite; its behaviour comes from ENEMY_TYPES. The WaveManager reuses dead instances.
// Hit radius is from the type table (not the sprite size) so art can change without changing gameplay.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { ENEMY_TYPES } from './enemyTypes.js';

const rand = (a, b) => a + Math.random() * (b - a);
const FLASH_MS = 70;

function pickWeighted(weights) {
    let total = 0;
    for (const w of weights) total += w;
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return 0;
}

export default class Enemy extends Phaser.GameObjects.Sprite {
    constructor(scene) {
        super(scene, -99, -99, 'enemy_basic', 0);
        scene.add.existing(this);
        this.setDepth(DEPTH.ENEMY);
        this.alive = false;
        this.setActive(false).setVisible(false);
    }

    /** opts: { hpMod, tier, firstAttackMs, canHover } */
    spawn(typeName, x, y, opts) {
        const t = ENEMY_TYPES[typeName];
        this.type = t;
        this.typeName = typeName;
        this.alive = true;
        this.hp = t.hp * opts.hpMod;
        this.r = t.radius;
        this.tier = opts.tier;
        this.age = 0;
        this.shots = 0;
        this.flash = 0;
        this.startX = x;
        this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setRotation(0).clearTint();

        if (t.meteor) {
            const key = `meteor_${t.meteor}_${Math.random() < 0.5 ? 0 : 1}`;
            this.setTexture(key);
            const a = Math.PI / 2 + rand(-0.45, 0.45);
            this.vx = Math.cos(a) * t.speed * rand(0.8, 1.25);
            this.vy = Math.sin(a) * t.speed * rand(0.8, 1.25);
            this.spin = rand(-2, 2);
            this.move = -1;
            this.nextFire = Infinity;
            return this;
        }
        this.setTexture(t.key, 0);
        if (this.scene.anims.exists(t.key)) this.play({ key: t.key, startFrame: Math.floor(Math.random() * 2) });
        else this.stop();
        this.speed = t.speed;
        this.move = pickWeighted(t.moves);
        this.amplitude = rand(t.amplitude[0], t.amplitude[1]);
        this.freq = rand(t.frequency[0], t.frequency[1]);
        this.nextFire = opts.firstAttackMs;
        // hover: enter, park in the upper third and paint patterns, then leave
        this.hover = opts.canHover && t.hoverFromTier !== undefined && opts.tier >= t.hoverFromTier;
        if (this.hover) { this.hoverY = rand(40, H * 0.38); this.hoverMs = 7000; this.nextFire = 900; }
        return this;
    }

    update(dt, c) {
        const s = dt / 1000;
        this.age += dt;
        if (this.flash > 0 && (this.flash -= dt) <= 0) this.clearTint();
        if (this.type.meteor) {
            this.x += this.vx * s;
            this.y += this.vy * s;
            this.rotation += this.spin * s;
        } else {
            this.moveStep(s);
            // only shoot while fully on screen and not in the bottom quarter (would be unfair point-blank)
            if (this.y > 6 && this.y < H * 0.78) {
                this.nextFire -= dt;
                if (this.nextFire <= 0) {
                    this.nextFire += this.type.fireRate * c.fireRateMod;
                    this.type.attack(this, c, this.tier);
                    this.shots++;
                    c.onShoot(this);
                }
            }
        }
        return this.y < H + 30 && this.y > -60 && this.x > -40 && this.x < W + 40;   // false = escaped
    }

    moveStep(s) {
        const t = this.age / 1000;
        if (this.hover && this.hoverMs > 0) {
            if (this.y < this.hoverY) this.y += Math.max(18, this.speed * 2.2 * (1 - this.y / this.hoverY)) * s;   // ease in
            else this.hoverMs -= s * 1000;
            this.x = this.startX + Math.sin(t * 0.8) * 24;
        } else {
            this.y += this.speed * (this.hover ? 1.6 : 1) * s;
            if (this.hover) { /* leaving: keep x */ } else if (this.move === 1) this.x = this.startX + Math.sin(t * this.freq) * this.amplitude;
            else if (this.move === 2) this.x = this.startX + (Math.abs(((t * this.freq) % 2) - 1) * 2 - 1) * this.amplitude;
        }
        const half = this.width / 2;
        if (this.x < half) this.x = half; else if (this.x > W - half) this.x = W - half;
    }

    /** Returns true if this hit killed it. */
    damage(amount) {
        if (!this.alive) return false;
        this.hp -= amount;
        this.flash = FLASH_MS;
        this.setTintFill(0xffffff);
        return this.hp <= 0;
    }

    despawn() {
        this.alive = false;
        this.stop();
        this.setActive(false).setVisible(false);
    }
}
