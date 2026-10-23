// Boss base class: a multi-part sprite rig with circular hit targets, HP with phase thresholds, an attack
// scheduler, telegraphs, damage flash and the invulnerable entrance. Concrete bosses (Warden, Hive, Prism)
// only describe their parts, movement and per-phase attack lists.
//
// Everything runs on simulation dt (Game.step) so pause / hit-stop / slow-mo freeze it. Hit targets look like
// enemies to collisions.js + Combat ({x, y, r, alive, damage()}) and route damage to the boss; damage() always
// returns false so Combat never "kills" a target -- the BossDirector owns the death sequence.
import { W, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { ENEMY_BULLET } from '../../systems/tuning.js';
import Telegraph from './Telegraph.js';

const FLASH_MS = 45, FLASH_GAP = 90;
const DEFLECT_GAP = 120;
export const ENTER_MS = 2600;      // invulnerable entrance (the intro banner plays meanwhile)
export const V = ENEMY_BULLET.speed;

export default class Boss {
    /**
     * def: { name, title, hp, phases: [hp01 thresholds where phase 2, 3 start], homeY, bonus }
     * opts: { hpMod, cycle, onPhase(boss, phase), onDefeat(boss), onHit(boss) }
     */
    constructor(game, def, opts) {
        this.g = game;
        this.scene = game;
        this.def = def;
        this.opts = opts;
        this.c = game.enemyCtx;
        this.pool = game.enemyBullets;
        this.cycle = opts.cycle;
        this.maxHp = Math.round(def.hp * opts.hpMod);
        this.hp = this.maxHp;
        this.phase = 0;
        this.alive = true;           // Sequencer owner flag: patterns stop when the boss dies
        this.state = 'enter';
        this.age = 0;
        this.x = W / 2;
        this.y = -60;
        this.homeY = def.homeY;
        this.enterMs = ENTER_MS;
        this.invulnMs = 0;
        this.flashT = 0; this.flashCd = 0; this.deflectCd = 0;
        this.attackT = 1200;
        this.attackI = 0;
        this.parts = [];
        this.targets = [];
        this.timers = [];
        this.warn = new Telegraph(game);
    }

    // --- rig -----------------------------------------------------------------------------------------------
    /** sprite part at offset (dx,dy) from the boss centre; anim plays if the key has one */
    part(key, dx = 0, dy = 0, depth = DEPTH.ENEMY) {
        const s = this.scene.add.sprite(this.x + dx, this.y + dy, key, 0).setDepth(depth);
        if (this.scene.anims.exists(key)) s.play(key);
        s.dx = dx; s.dy = dy;
        this.parts.push(s);
        return s;
    }

    /** circular hit target at offset (dx,dy). mult scales damage (weak points > armour). */
    target(dx, dy, r, mult = 1) {
        const boss = this;
        const t = { x: 0, y: 0, dx, dy, r, mult, alive: true, damage(n) { boss.hit(n * this.mult, this); return false; } };
        this.targets.push(t);
        return t;
    }

    sync() {
        const x = Math.round(this.x), y = Math.round(this.y);
        for (const p of this.parts) p.setPosition(x + p.dx, y + p.dy);
        for (const t of this.targets) { t.x = this.x + t.dx; t.y = this.y + t.dy; }
    }

    // --- timing helpers ------------------------------------------------------------------------------------
    /** run fn after ms of simulation time (cleared on phase change / death) */
    after(ms, fn) { this.timers.push({ t: ms, fn }); }
    /** fn(i, x, y) `times` times every `every` ms at the boss position (Sequencer: stops with the boss) */
    repeat(every, times, fn) { return this.c.seq.run(this, every, times, fn); }
    sfx() { this.c.onShoot(this); }

    get invulnerable() { return this.state !== 'fight' || this.invulnMs > 0 || this.shut; }
    get hp01() { return this.hp / this.maxHp; }
    /** bullet speed / count helpers that respect difficulty + tier (enemyCtx) and the boss cycle */
    sp(k) { return V * k * this.c.speed * (1 + this.cycle * 0.06); }
    n(count) { return Math.max(1, Math.round(count * this.c.density * (1 + this.cycle * 0.15))); }
    get dmg() { return this.c.damage; }

    // --- damage --------------------------------------------------------------------------------------------
    hit(n, t) {
        if (!this.alive) return;
        if (this.invulnerable) {
            if (this.deflectCd <= 0) { this.deflectCd = DEFLECT_GAP; this.g.fx.hitSpark(t.x, t.y + t.r * 0.5, COLORS[5]); }
            return;
        }
        this.hp -= n;
        if (this.flashCd <= 0) { this.flashT = FLASH_MS; this.flashCd = FLASH_GAP; for (const p of this.parts) p.setTintFill(0xffffff); }
        this.opts.onHit?.(this);
        if (this.hp <= 0) { this.hp = 0; this.die(); return; }
        const next = this.def.phases.findIndex((f) => this.hp01 > f);   // first threshold we're still above
        const phase = next < 0 ? this.def.phases.length : next;
        if (phase > this.phase) this.shiftPhase(phase);
    }

    shiftPhase(phase) {
        this.phase = phase;
        this.invulnMs = 1400;
        this.attackT = 900;
        this.attackI = 0;
        this.clearPending();
        this.onPhase(phase);
        this.opts.onPhase(this, phase);
    }

    die() {
        this.state = 'dead';
        this.alive = false;
        this.clearPending();
        this.opts.onDefeat(this);
    }

    clearPending() { this.timers.length = 0; this.warn.clear(); }

    // --- frame ---------------------------------------------------------------------------------------------
    update(dt) {
        this.age += dt;
        if (this.flashCd > 0) this.flashCd -= dt;
        if (this.deflectCd > 0) this.deflectCd -= dt;
        if (this.flashT > 0 && (this.flashT -= dt) <= 0) for (const p of this.parts) p.clearTint();
        if (this.state === 'dead') { this.sync(); return; }
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const tm = this.timers[i];
            if ((tm.t -= dt) <= 0) { this.timers.splice(i, 1); tm.fn(); }
        }
        if (this.state === 'enter') {
            // ease in from above the screen; the boss can't be hurt until it has arrived
            this.enterMs -= dt;
            const k = 1 - Math.max(0, this.enterMs) / ENTER_MS;
            this.y = -60 + (this.homeY + 60) * (1 - (1 - k) ** 3);
            if (this.enterMs <= 0) { this.state = 'fight'; this.onArrive(); }
        } else {
            if (this.invulnMs > 0) this.invulnMs -= dt;
            this.move(dt);
            if (this.invulnMs <= 0 && (this.attackT -= dt) <= 0) {
                const list = this.attacks(this.phase);
                const atk = list[this.attackI++ % list.length];
                this.attackT = atk.call(this) ?? 1500;   // each attack returns the pause before the next one
            }
        }
        this.animate(dt);
        this.sync();
        this.warn.update(dt);
    }

    // --- overridables --------------------------------------------------------------------------------------
    /** movement once fighting (default: slow figure-eight sway around home) */
    move() {
        const t = this.age / 1000;
        this.x = W / 2 + Math.sin(t * 0.45) * 90;
        this.y = this.homeY + Math.sin(t * 0.9) * 8;
    }
    animate() {}
    onArrive() {}
    onPhase() {}
    /** list of attack functions for a phase; each fires and returns ms until the next attack */
    attacks() { return [() => 1000]; }

    /** death throes visuals are driven by the director; this hides the rig at the very end */
    hide() { for (const p of this.parts) p.setVisible(false); this.warn.clear(); }

    destroy() {
        this.alive = false;
        this.timers.length = 0;
        for (const p of this.parts) p.destroy();
        this.parts.length = 0;
        this.targets.length = 0;
        this.warn.destroy();
    }
}
