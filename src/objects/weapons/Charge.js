// CHARGE primary: hold fire to charge, release to shoot. Tap = small orb, half charge = medium piercing orb,
// full = big orb (OVERLOAD synergy: pierces everything + two side lances; LV4: plus a ring of pellets).
// Reads the fire key directly because Player's auto-fire only knows "fire every N ms while held".
// The charging orb is shown at the ship's nose as the actual shot sprite (scale 1), blinking when full.
import Phaser from 'phaser';
import { DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { SHOT } from './weaponDefs.js';
import { spawnShot } from './shots.js';

const TAP_GAP_MS = 160;          // min time between tap shots so mashing doesn't out-DPS charging
const KEYS = ['wshot_charge_s', 'wshot_charge_m', 'wshot_charge_l'];

export default class Charge {
    constructor(arsenal) {
        this.a = arsenal;
        this.t = 0;
        this.held = false;
        this.tier = 0;
        this.cool = 0;
        const s = arsenal.g;
        this.orb = s.add.image(0, 0, KEYS[0]).setDepth(DEPTH.PLAYER + 1).setVisible(false);
        this.glow = s.add.image(0, 0, 'glow_s').setDepth(DEPTH.PLAYER - 1).setTint(COLORS.C).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }

    update(dt) {
        const a = this.a, p = a.p;
        this.cool -= dt;
        if (a.primary !== 'charge' || !p.alive || !p.controllable) { this.reset(); return; }
        const s = a.stats('charge');
        const down = p.keys.fire.isDown;
        if (down) {
            this.t = Math.min(s.chargeMs, this.t + dt);
            const tier = this.t >= s.chargeMs ? 3 : this.t >= s.chargeMs * 0.5 ? 2 : 1;
            if (tier !== this.tier && this.held) {
                a.g.audio.play(tier === 3 ? 'combo-up' : 'ui-hover', { vol: 0.35, rate: 0.8 + tier * 0.15 });
            }
            this.tier = tier;
            this.held = true;
            this.draw(p, tier);
        } else if (this.held) {
            this.release(p, s);
            this.reset();
        }
    }

    draw(p, tier) {
        const nose = p.ship.height / 2 + 2 + tier * 2;
        const x = Math.round(p.x + Math.cos(p.aim) * nose), y = Math.round(p.y + Math.sin(p.aim) * nose);
        // the smallest stage only appears after a beat, so plain tapping doesn't flicker an orb
        const show = tier > 1 || this.t > 120;
        const blink = tier === 3 && ((this.a.g.game.loop.time / 70) | 0) % 2 === 0;
        this.orb.setTexture(KEYS[tier - 1]).setPosition(x, y).setVisible(show).setAlpha(blink ? 0.6 : 1);
        this.glow.setPosition(x, y).setVisible(show).setAlpha(0.25 + tier * 0.15);
    }

    release(p, s) {
        const a = this.a, g = a.g, m = a.mods, D = a.baseDamage;
        const ang = p.aim, nose = p.ship.height / 2;
        const x = p.x + Math.cos(ang) * nose, y = p.y + Math.sin(ang) * nose;
        const tier = this.tier, bp = a.bonusPierce;
        if (tier === 1) {
            if (this.cool > 0) return;
            this.cool = TAP_GAP_MS;
            spawnShot(g.shots, x, y, ang, m.speed, SHOT.chargeS, D, { pierce: bp });
            g.audio.play('player-shoot', { vol: 0.28, jitter: 120 });
        } else if (tier === 2) {
            spawnShot(g.shots, x, y, ang, 0.85 * m.speed, SHOT.chargeM, D * s.dmg * 0.45, { pierce: 1 + bp });
            g.audio.play('player-shoot', { vol: 0.4, rate: 0.8 });
        } else {
            const over = a.syn.overload;
            spawnShot(g.shots, x, y, ang, 0.8 * m.speed, SHOT.chargeL, D * s.dmg, { pierce: over ? 99 : 3 + bp });
            if (over) for (const d of [-0.22, 0.22]) spawnShot(g.shots, x, y, ang + d, 1.4 * m.speed, SHOT.lance, D * 1.5, { pierce: 3 });
            if (s.nova) for (let i = 0; i < 10; i++) spawnShot(g.shots, p.x, p.y, ang + (i / 10) * Math.PI * 2, 0.8, SHOT.pellet, D * 0.6);
            g.audio.play('player-shoot', { vol: 0.6, rate: 0.6 });
            g.fx.shake(1, 90);
            g.fx.shockwave(Math.round(x), Math.round(y), COLORS.C, 0.3);
        }
        g.fx.muzzle(Math.round(x), Math.round(y));
    }

    reset() {
        this.t = 0;
        this.held = false;
        this.tier = 0;
        this.orb.setVisible(false);
        this.glow.setVisible(false);
    }

    destroy() { this.orb.destroy(); this.glow.destroy(); }
}
