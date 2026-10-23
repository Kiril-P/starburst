// The player ship: inertial movement (v1 lerp feel, made frame-rate independent), hold-to-fire, HP with
// i-frames, and the three unlockable abilities. Ships never rotate: bank frames 1/2 show left/right motion.
// Visual juice that involves other systems (fx, sound, HUD) is requested through `hooks` so this class
// stays about the ship itself.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { PLAYER, SHIPS, ABILITIES, SPEED_SCALE, DIAGONAL_FACTOR } from '../systems/tuning.js';
import { COLORS } from '../art/palette.js';
import { GameInput } from '../systems/bindings.js';
import MouseAim from '../systems/mouseAim.js';
import { save } from '../systems/Save.js';
import { touchWanted } from '../ui/TouchControls.js';

// v1 lerped velocity by pct/100 every frame at 60fps; convert to a per-second exponential rate
const rate = (pct) => -Math.log(1 - Math.min(pct, 99) / 100) * 60;
const GHOSTS = 10;

export default class Player {
    /** hooks: { onFire(x,y), onDash(), onForcefield(), onPhase(on), onAbilityDenied(name) } */
    constructor(scene, x, y, shipType, hooks) {
        this.scene = scene;
        this.hooks = hooks;
        this.shipType = SHIPS[shipType] ? shipType : 'normal';
        const st = SHIPS[this.shipType];
        this.stats = st;
        this.maxHp = st.hp;
        this.hp = st.hp;
        this.speedBonus = 0;
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
        this.alive = true;
        this.controllable = true;
        this.fireTimer = 0;
        this.invuln = 0;
        this.levels = { dash: 0, forcefield: 0, phase: 0, thrusters: 0 };
        this.cd = { dash: 0, forcefield: 0, phase: 0 };            // ms until ready
        this.cdMax = { dash: 1, forcefield: 1, phase: 1 };
        this.dashT = 0; this.phaseT = 0; this.shieldT = 0;
        this.dashDir = { x: 0, y: -1 };
        this.aim = -Math.PI / 2;          // facing (v1: ship turns toward its movement and fires that way)
        this.aimVis = this.aim;           // smoothed, step-snapped angle used for drawing
        this.ghostT = 0;
        this.hudAbilities = {
            dash: { unlocked: false, cooldown01: 0, active: false, key: 'SHIFT' },
            forcefield: { unlocked: false, cooldown01: 0, active: false, key: 'Z' },
            phase: { unlocked: false, cooldown01: 0, active: false, key: 'X' }
        };
        this.createSprites(scene);
        // rebindable keys (Settings > CONTROLS) + gamepad / touch by action, see systems/bindings.js
        this.input = new GameInput();
        this.keys = this.input.keys;   // { left, right, up, down, fire, ... }.isDown
        for (const id of ['dash', 'forcefield', 'phase']) this.hudAbilities[id].key = this.input.label(id === 'forcefield' ? 'shield' : id);
        // presses are queued from key events (not polled with JustDown) so a tap shorter than a frame still counts
        this.queued = { dash: false, forcefield: false, phase: false, fire: false };
        this.input.onPress('dash', () => { this.queued.dash = true; });
        this.input.onPress('shield', () => { this.queued.forcefield = true; });
        this.input.onPress('phase', () => { this.queued.phase = true; });
        this.input.onPress('fire', () => { this.queued.fire = true; });
        this.mouse = save.aimMode === 'mouse' && !touchWanted() ? new MouseAim(scene, this) : null;
    }

    createSprites(scene) {
        const t = this.shipType;
        this.flame = scene.add.sprite(this.x, this.y, `flame_${t}`, 0).setOrigin(0.5, 0).setDepth(DEPTH.PLAYER - 1);
        if (scene.anims.exists(`flame_${t}`)) this.flame.play(`flame_${t}`);
        this.ship = scene.add.sprite(this.x, this.y, `ship_${t}`, 0).setDepth(DEPTH.PLAYER);
        this.canBank = scene.textures.get(`ship_${t}`).frameTotal > 3;   // frames 0/1/2 (+ __BASE)
        this.shield = scene.add.sprite(this.x, this.y, 'shield_ring', 0).setDepth(DEPTH.PLAYER + 2).setVisible(false);
        this.dot = scene.add.sprite(this.x, this.y, 'hitbox_dot', 0).setDepth(DEPTH.PLAYER + 3);
        if (scene.anims.exists('hitbox_dot')) this.dot.play('hitbox_dot');
        // afterimages for dash / phase: pooled, faded manually so they freeze with the simulation
        this.ghosts = [];
        for (let i = 0; i < GHOSTS; i++) {
            this.ghosts.push(scene.add.image(0, 0, `ship_${t}`, 0).setDepth(DEPTH.PLAYER - 2).setVisible(false).setBlendMode(Phaser.BlendModes.ADD));
        }
        this.ghostIdx = 0;
    }

    get speed() { return (this.stats.speed + this.speedBonus) * SPEED_SCALE; }
    get dashing() { return this.dashT > 0; }
    get phasing() { return this.phaseT > 0; }
    get shielded() { return this.shieldT > 0; }
    /** can bullets / ramming hurt us right now? */
    get hittable() { return this.alive && this.invuln <= 0 && !this.dashing && !this.phasing && !this.shielded; }
    get fireRate() { return this.stats.fireRate * PLAYER.fireRateScale; }

    /** apply a picked upgrade id (see systems/upgrades.js) */
    applyUpgrade(id) {
        if (id === 'heal') { this.hp = this.maxHp; return; }
        if (id === 'hull') { this.maxHp = Math.round(this.maxHp * 1.2); this.hp = this.maxHp; return; }
        const lv = ++this.levels[id];
        if (id === 'thrusters') { this.speedBonus += ABILITIES.thrusters.bonus[lv - 1] ?? 0; return; }
        this.hudAbilities[id].unlocked = true;
        this.cd[id] = 0;
    }

    level(id) { return Math.max(0, this.levels[id] - 1); }

    update(dt) {
        if (!this.alive) return;
        const s = dt / 1000;
        for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
        if (this.invuln > 0) this.invuln -= dt;
        if (this.shieldT > 0) this.shieldT -= dt;
        if (this.phaseT > 0 && (this.phaseT -= dt) <= 0) this.endPhase();
        if (this.dashT > 0) this.dashT -= dt;

        const q = this.queued;
        if (this.controllable) {
            for (const id of ['dash', 'forcefield', 'phase']) if (q[id]) { q[id] = false; this.tryAbility(id); }
        } else q.dash = q.forcefield = q.phase = q.fire = false;
        this.mouseAiming = !!this.mouse && this.controllable && this.mouse.update();
        this.move(s);
        this.fireTimer -= dt;
        if (this.controllable && (this.keys.fire.isDown || q.fire || (this.mouseAiming && this.mouse.firing)) && this.fireTimer <= 0) {
            q.fire = false;
            this.fireTimer = this.fireRate;
            const nose = this.ship.height / 2 - 1;
            this.hooks.onFire(this.x + Math.cos(this.aim) * nose, this.y + Math.sin(this.aim) * nose, this.aim);
        }
        this.updateVisuals(dt);
    }

    tryAbility(id) {
        if (!this.levels[id]) return;
        if (this.cd[id] > 0 || (id === 'dash' && this.dashing) || (id === 'phase' && this.phasing)) { this.hooks.onAbilityDenied(id); return; }
        const L = this.level(id);
        const A = ABILITIES[id];
        this.cd[id] = this.cdMax[id] = A.cooldown[Math.min(L, A.cooldown.length - 1)];
        if (id === 'dash') {
            const m = Math.hypot(this.vx, this.vy);
            if (m > 20) { this.dashDir.x = this.vx / m; this.dashDir.y = this.vy / m; } else { this.dashDir.x = Math.cos(this.aim); this.dashDir.y = Math.sin(this.aim); }
            this.dashT = A.duration[L];
            this.hooks.onDash();
        } else if (id === 'forcefield') {
            this.shieldT = A.bubbleMs[L];
            this.hooks.onForcefield();
        } else {
            this.phaseT = A.duration[L];
            this.ship.setTint(COLORS.q);
            this.hooks.onPhase(true);
        }
    }

    endPhase() {
        this.phaseT = 0;
        this.ship.clearTint();
        this.hooks.onPhase(false);
    }

    move(s) {
        const k = this.keys;
        if (this.dashing) {
            const ds = ABILITIES.dash.speed;
            this.vx = this.dashDir.x * ds;
            this.vy = this.dashDir.y * ds;
        } else {
            const ctl = this.controllable;
            let tx = ctl ? (k.left.isDown ? -1 : k.right.isDown ? 1 : 0) : 0;
            let ty = ctl ? (k.up.isDown ? -1 : k.down.isDown ? 1 : 0) : 0;
            if ((tx || ty) && !this.mouseAiming) this.aim = Math.atan2(ty, tx);
            const sp = this.speed * (tx && ty ? DIAGONAL_FACTOR * Math.SQRT1_2 : 1);
            this.vx = this.approach(this.vx, tx * sp, s);
            this.vy = this.approach(this.vy, ty * sp, s);
        }
        this.x += this.vx * s;
        this.y += this.vy * s;
        const hw = this.ship.width / 2, hh = this.ship.height / 2;
        const minX = hw + PLAYER.marginX, maxX = W - hw - PLAYER.marginX;
        const minY = hh + PLAYER.marginTop, maxY = H - hh - PLAYER.marginBottom;
        if (this.x < minX) { this.x = minX; this.vx = 0; } else if (this.x > maxX) { this.x = maxX; this.vx = 0; }
        if (this.y < minY) { this.y = minY; this.vy = 0; } else if (this.y > maxY) { this.y = maxY; this.vy = 0; }
    }

    approach(v, target, s) {
        const st = this.stats;
        let pct;
        if (target === 0) pct = st.decel;
        else if (v * target < 0) pct = st.decel * 2;     // v1: reversing brakes harder
        else pct = st.accel;
        const out = target + (v - target) * Math.exp(-rate(pct) * s);
        return target === 0 && Math.abs(out) < 5 ? 0 : out;
    }

    updateVisuals(dt) {
        const x = Math.round(this.x), y = Math.round(this.y);
        // turn toward the aim by the shortest way, then snap to 16 steps so the pixels stay crisp
        const d = Math.atan2(Math.sin(this.aim - this.aimVis), Math.cos(this.aim - this.aimVis));
        this.aimVis += d * Math.min(1, dt / 55);
        const STEP = Math.PI / 8;
        const rot = Math.round((this.aimVis + Math.PI / 2) / STEP) * STEP;   // 0 = ship nose up
        const up = Math.abs(rot) < 0.01;
        const bank = !this.canBank || !up ? 0 : this.vx < -PLAYER.bankThreshold ? 1 : this.vx > PLAYER.bankThreshold ? 2 : 0;
        if (this.ship.frame.name !== bank) this.ship.setFrame(bank);
        this.ship.setPosition(x, y).setRotation(rot);
        // flame tucked under the tail; hidden while coasting backwards against the facing
        const tail = Math.floor(this.ship.height / 2) - 3;
        this.flame.setPosition(Math.round(x - Math.sin(rot) * tail), Math.round(y + Math.cos(rot) * tail)).setRotation(rot);
        this.flame.setVisible(this.vx * Math.cos(this.aim) + this.vy * Math.sin(this.aim) > -this.speed * 0.6);
        this.dot.setPosition(x, y);
        this.shield.setPosition(x, y).setVisible(this.shielded);
        if (this.shielded && !this.shield.anims.isPlaying && this.scene.anims.exists('shield_ring')) this.shield.play('shield_ring');

        // i-frames blink; phase = translucent magenta ghost
        const blink = this.invuln > 0 && !this.phasing && Math.floor(this.invuln / 70) % 2 === 0;
        this.ship.setAlpha(this.phasing ? 0.45 : blink ? 0.25 : 1);
        this.flame.setAlpha(this.ship.alpha);

        if (this.dashing || this.phasing) {
            this.ghostT -= dt;
            if (this.ghostT <= 0) {
                this.ghostT = this.dashing ? 22 : 90;
                const g = this.ghosts[this.ghostIdx++ % GHOSTS];
                g.setPosition(x, y).setFrame(bank).setRotation(rot).setVisible(true).setAlpha(this.dashing ? 0.7 : 0.45);
                g.setTint(this.dashing ? this.stats.accent : COLORS.M);
                g.life = this.dashing ? 260 : 420;
                g.maxLife = g.life;
            }
        }
        for (const g of this.ghosts) {
            if (!g.visible) continue;
            g.life -= dt;
            if (g.life <= 0) g.setVisible(false); else g.setAlpha((g.life / g.maxLife) * 0.6);
        }
    }

    /** Returns true if the damage killed the ship. */
    damage(amount) {
        if (!this.hittable) return false;
        this.hp = Math.max(0, this.hp - amount);
        this.invuln = PLAYER.invulnMs;
        if (this.hp <= 0) { this.die(); return true; }
        return false;
    }

    die() {
        this.alive = false;
        this.vx = this.vy = 0;
        for (const o of [this.ship, this.flame, this.dot, this.shield]) o.setVisible(false);
        for (const g of this.ghosts) g.setVisible(false);
    }

    /** HUD ability state (same objects every frame, no allocation) */
    abilityState() {
        for (const id of ['dash', 'forcefield', 'phase']) {
            const a = this.hudAbilities[id];
            a.cooldown01 = this.cd[id] / this.cdMax[id];
            a.active = id === 'dash' ? this.dashing : id === 'phase' ? this.phasing : this.shielded;
        }
        return this.hudAbilities;
    }

    destroy() {
        this.input.destroy();
        this.mouse?.destroy();
        for (const o of [this.ship, this.flame, this.dot, this.shield, ...this.ghosts]) o.destroy();
    }
}
