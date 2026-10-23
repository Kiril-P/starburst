// Timed power-ups (magnet, rapid fire, score x2, shield) and the instant bomb. Owns the timers, pushes the
// active list to the HUD (hud.setBuffs) and exposes the modifiers other systems read:
//   scoreMul (Combat.addScore), absorb() (Combat.hurt), Arsenal.rapid, Pickups.magnetAll.
// Timers pause while the upgrade screen is open so a pick never wastes a buff.
import { DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { PICKUPS } from '../../systems/loot.js';

const BUFFS = ['magnet', 'rapid', 'x2', 'shield'];
const BOMB_DAMAGE = 80;           // kills every regular enemy except the toughest meteors
const BOMB_BOSS_FRAC = 0.04;      // bosses only take a chip of their max HP
const SHIELD_GRACE_MS = 700;      // i-frames after the shield pops, so the next bullet in a stream can't hit

export default class PowerUps {
    constructor(game) {
        this.g = game;
        this.t = { magnet: 0, rapid: 0, x2: 0, shield: 0 };
        this.items = BUFFS.map((id) => ({ id, key: PICKUPS[id].key, t01: 0, warn: false }));
        this.list = [];
        this.ring = game.add.sprite(0, 0, 'shield_ring', 1).setDepth(DEPTH.PLAYER + 2).setVisible(false).setAlpha(0.5);
    }

    get scoreMul() { return this.t.x2 > 0 ? 2 : 1; }
    get magnet() { return this.t.magnet > 0; }

    activate(type) {
        if (type === 'bomb') { this.bomb(); return; }
        const def = PICKUPS[type];
        if (def) this.t[type] = def.ms;       // re-collecting refreshes the timer (no stacking)
    }

    /** Combat.hurt asks first: true = the shield ate this hit */
    absorb() {
        if (this.t.shield <= 0) return false;
        const g = this.g, p = g.player;
        this.t.shield = 0;
        p.invuln = Math.max(p.invuln, SHIELD_GRACE_MS);
        g.fx.shockwave(Math.round(p.x), Math.round(p.y), COLORS.C, 0.6);
        g.fx.hitSpark(p.x, p.y, COLORS.b);
        g.fx.shake(1, 120);
        g.audio.play('shield-break', { vol: 0.7 });
        g.hud.toast('SHIELD DOWN', '#39e7ff');
        return true;
    }

    bomb() {
        const g = this.g, p = g.player;
        const x = Math.round(p.x), y = Math.round(p.y);
        g.combat.cancelBullets(true);
        // copy: killEnemy can spawn meteor fragments into the live list while we walk it
        for (const e of [...g.waves.live]) if (e.alive && e.y > -10 && e.damage(BOMB_DAMAGE)) g.combat.killEnemy(e, true);
        const boss = g.bosses.boss, tg = g.bosses.targets;
        if (boss && tg.length) tg[0].damage((boss.maxHp * BOMB_BOSS_FRAC) / (tg[0].mult || 1));
        g.fx.shockwave(x, y, COLORS.z, 4);
        g.fx.shockwave(x, y, COLORS.A, 1.8);
        g.fx.flash(COLORS.A, 0.45, 320);
        g.fx.shake(3, 420);
        g.fx.hitStop(60);
        g.bg.pulse(1);
        g.audio.play('boss-explosion', { vol: 0.7 });
    }

    update(dt) {
        const g = this.g;
        if (!g.upgradeScreen) for (const id of BUFFS) if (this.t[id] > 0) this.t[id] = Math.max(0, this.t[id] - dt);
        g.loot.pickups.magnetAll = this.t.magnet > 0;
        g.arsenal.rapid = this.t.rapid > 0;
        this.drawShield(g.player);
        // HUD list: same objects every frame (no allocation); order = BUFFS
        const list = this.list;
        list.length = 0;
        for (const it of this.items) {
            const left = this.t[it.id];
            if (left <= 0) continue;
            it.t01 = left / PICKUPS[it.id].ms;
            it.warn = left < 2000;
            list.push(it);
        }
        g.hud.setBuffs?.(list);
    }

    drawShield(p) {
        const left = this.t.shield;
        const on = left > 0 && p.alive && !p.shielded;     // the forcefield bubble already covers the ship
        const blink = left < 2000 && ((left / 120) | 0) % 2 === 0;
        this.ring.setVisible(on && !blink);
        if (on) this.ring.setPosition(Math.round(p.x), Math.round(p.y));
    }

    destroy() { this.ring.destroy(); }
}
