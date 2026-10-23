// THE COLOSSUS -- a fortress with four destructible armour plates over a shut core.
// P1 (armoured): the core deflects everything; each plate is its own target with its own HP and turret. Breaking
//    all four (40% of the boss's HP) opens the core and starts P2. Fewer plates = the survivors fire faster.
// P2 (exposed): the core opens: telegraphed hammer lanes, core lances, interleaved rings, debris rain.
// P3 (overload): white-hot core, spirals + double hammers + lances.
import { W, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { COLOSSUS_PLATES } from '../../art/sprites/bosses2.js';
import { aimed } from '../patterns.js';
import Boss from './Boss.js';
import { S, hammer, lances, rings, spiral, debrisRain } from './attacks.js';

const PLATE_SHARE = 0.1;          // each plate holds this fraction of max HP (4 x 0.1 = the whole first phase)
const CORE_SHUT = 0, CORE_OPEN = 1, CORE_PULSE = 2, CORE_HOT = 3;

export const COLOSSUS = { id: 'colossus', kind: 'main', name: 'THE COLOSSUS', title: 'SIEGE FORTRESS', hp: 1800, phases: [0.6, 0.3], homeY: 70, bonus: 19000 };

export default class Colossus extends Boss {
    constructor(game, opts) {
        super(game, COLOSSUS, opts);
        this.hull = this.part('boss_colossus', 0, 0, DEPTH.ENEMY);
        this.core = this.part('boss_colossus_core', 0, 0, DEPTH.ENEMY + 1);
        this.coreT = this.target(0, 0, 13, 1.25);
        this.plates = COLOSSUS_PLATES.map(([dx, dy]) => {
            const spr = this.part('boss_colossus_plate', dx, dy, DEPTH.ENEMY + 1);
            const t = this.target(dx, dy, 13, 1);
            t.plate = { spr, hp: this.maxHp * PLATE_SHARE, max: this.maxHp * PLATE_SHARE, dx, dy };
            return t;
        });
        this.sync();
    }

    get livePlates() { return this.plates.filter((t) => t.alive); }

    /** plates take their own damage; the shut core only sparks. Boss HP drops with plate HP so the bar stays honest. */
    hit(n, t) {
        if (this.invulnerable || this.phase > 0 || !this.alive) return super.hit(n, t);
        if (t === this.coreT) {
            if (this.deflectCd <= 0) { this.deflectCd = 120; this.g.fx.hitSpark(t.x, t.y + 6, COLORS[5]); }
            return;
        }
        const pl = t.plate;
        const dmg = Math.min(n, pl.hp);
        pl.hp -= dmg;
        if (pl.hp < pl.max * 0.5) pl.spr.setFrame(1);
        if (pl.hp <= 0) this.breakPlate(t);
        super.hit(dmg, t);
        // float rounding must never leave a plate-less fortress stuck in the armoured phase
        if (!this.livePlates.length && this.phase === 0 && this.alive) { this.hp = Math.min(this.hp, this.maxHp * this.def.phases[0]); this.shiftPhase(1); }
    }

    /** debug: drop to a fraction of max HP, breaking plates as needed */
    debugHp(f) {
        this.state = 'fight'; this.invulnMs = 0;
        if (this.phase === 0 && f <= this.def.phases[0]) for (const t of this.livePlates) this.hit(t.plate.hp, t);
        this.invulnMs = 0;
        if (this.hp > this.maxHp * f) super.hit(this.hp - this.maxHp * f, this.coreT);
    }

    breakPlate(t) {
        t.alive = false;
        const pl = t.plate, g = this.g;
        pl.spr.setVisible(false);
        g.fx.explosion(t.x, t.y, 'm', 'fire');
        g.fx.debris(t.x, t.y, 12, COLORS[4]);
        g.fx.shake(2, 250);
        g.audio.play('shield-break', { vol: 0.7 });
        g.hud.toast(`ARMOUR BROKEN  ${4 - this.livePlates.length}/4`, '#ffb547', 1200);
    }

    onPhase(p) {
        // phase 1 starts when the last plate breaks: the core irises open
        for (const t of this.plates) { t.alive = false; t.plate.spr.setVisible(false); }
        this.core.setFrame(p >= 2 ? CORE_HOT : CORE_OPEN);
        this.hull.anims.timeScale = 1 + p * 0.7;
    }

    move() {
        const t = this.age / 1000;
        this.x = W / 2 + Math.sin(t * 0.25) * (this.phase ? 90 : 60);
        this.y = this.homeY + Math.sin(t * 0.6) * 4;
    }

    animate() {
        if (this.phase === 1) this.core.setFrame(((this.age / 220) | 0) & 1 ? CORE_PULSE : CORE_OPEN);
        else if (this.phase === 0 && this.core.frame.name !== CORE_SHUT) this.core.setFrame(CORE_SHUT);
    }

    attacks(p) {
        if (p === 0) return [this.turrets, this.slam, this.turrets, this.plateRings];
        if (p === 1) return [this.slam, this.coreLances, this.coreRings, this.rain, this.coreLances];
        return [this.overload, this.slam2, this.coreLances, this.rain, this.overload];
    }

    /** every surviving plate fires aimed bursts; with fewer plates left each one fires more */
    turrets() {
        const live = this.livePlates, c = this.c;
        if (!live.length) return 600;
        const shots = 3 + (4 - live.length);
        this.repeat(150, shots, (i) => {
            for (const t of live) if (t.alive) aimed(this.pool, t.x, t.y + 6, c.px, c.py, { speed: this.sp(1.05), style: S.orbS, damage: this.dmg, offset: (i - (shots - 1) / 2) * 0.05 });
            this.sfx();
        });
        return shots * 150 + 1100;
    }

    plateRings() {
        for (const t of this.livePlates) rings(this, { dx: t.dx, dy: t.dy, times: 2, every: 420, count: 10, speed: 0.45 });
        return 840 + 1100;
    }

    /** lanes beneath the lower hull, then heavy orb columns hammer down them */
    slam() { return hammer(this, [this.x - 34, this.x + 34], { y: this.y + 30, count: 14 }) + 900; }
    slam2() {
        const px = Math.max(30, Math.min(W - 30, this.c.px));
        return hammer(this, [this.x - 34, this.x + 34, px < this.x ? px - 70 : px + 70], { y: this.y + 30, count: 16, ms: 850 }) + 800;
    }

    coreLances() { return lances(this, { count: this.phase >= 2 ? 5 : 3, spreadDeg: 20, ms: 820 }) + 1000; }
    coreRings() { return rings(this, { times: 4, every: 340, count: 18, speed: 0.5 }) + 900; }
    rain() { rings(this, { times: 1, count: 12, speed: 0.45 }); return debrisRain(this, { count: 20, every: 110 }) + 600; }

    overload() {
        this.g.fx.shockwave(this.x, this.y, COLORS.q, 1);
        return spiral(this, { arms: 6, steps: 32, every: 80, rot: 7, speed: 0.55, style: S.orbS, dir: Math.random() < 0.5 ? 1 : -1 }) + 900;
    }
}
