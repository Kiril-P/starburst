// THE HIVE -- brood carrier. Launches drones (regular pooled enemies, so kills feed score/combo as usual)
// from its two hangar nacelles and lobs spores.
// P1: drone launches, slow orb rings from the brood sac, aimed spore fans.
// P2: telegraphed spore bursts from the hangars + "brood mortars" that burst where the amber rings marked.
// P3: bigger launches, blooming ring flowers, mortar barrages.
import { W, H, DEPTH } from '../../config.js';
import { SPEED_SCALE } from '../../systems/tuning.js';
import { ENEMY_TYPES } from '../enemyTypes.js';
import { aimed, fan, ring, burst, style, angleTo, DEG, TAU } from '../patterns.js';
import Boss, { V } from './Boss.js';

const ORB_S = style('orbS', 'magenta');
const ORB_M = style('orbM', 'magenta');
const ORB_L = style('orbL', 'magenta');
const RING = style('ring', 'magenta');
const SPORE = style('orbS', 'amber');

const BAY_X = 44, BAY_Y = 16, SAC_Y = 4, SPOUT_Y = 26;

// Drones join the normal enemy table (registered here so enemyTypes.js stays boss-agnostic).
ENEMY_TYPES.drone ??= {
    key: 'boss_drone', radius: 6, hp: 20, score: 60, speed: 60 * SPEED_SCALE, fireRate: 2300,
    moves: [2, 6, 2], amplitude: [24, 60], frequency: [1.0, 2.0], explosion: 's', shake: 0,
    attack(e, c) { aimed(c.pool, e.x, e.y + 6, c.px, c.py, { speed: V * 0.8 * c.speed, style: ORB_S, damage: c.damage }); }
};

export const HIVE = { name: 'THE HIVE', title: 'BROOD CARRIER', hp: 1500, phases: [0.66, 0.33], homeY: 66, bonus: 16000 };

export default class Hive extends Boss {
    constructor(game, opts) {
        super(game, HIVE, opts);
        this.hull = this.part('boss_hive', 0, 0, DEPTH.ENEMY);
        this.target(0, SAC_Y, 12, 1.25);
        this.target(0, -14, 18);
        this.target(-BAY_X, 10, 12, 0.8);
        this.target(BAY_X, 10, 12, 0.8);
        this.sync();
    }

    move() {
        const t = this.age / 1000;
        this.x = W / 2 + Math.sin(t * 0.32) * 120 + Math.sin(t * 1.1) * 10;
        this.y = this.homeY + Math.sin(t * 0.7) * 10;
    }

    onPhase(p) { this.hull.anims.timeScale = 1 + p * 0.8; }

    attacks(p) {
        if (p === 0) return [this.launch, this.sacRings, this.spores, this.launch, this.sacRings];
        if (p === 1) return [this.launch, this.sporeBurst, this.mortars, this.sacRings];
        return [this.launch, this.flower, this.mortars, this.sporeBurst, this.mortars];
    }

    drones() { let n = 0; for (const e of this.g.waves.live) if (e.alive && e.typeName === 'drone') n++; return n; }

    launch() {
        const cap = 3 + this.phase * 2;
        const count = Math.min(this.phase >= 2 ? 3 : 2, cap - this.drones());
        if (count <= 0) return this.sacRings();
        this.repeat(260, count, (i, x, y) => {
            const s = i & 1 ? 1 : -1, bx = x + s * BAY_X, by = y + BAY_Y + 4;
            const d = this.g.waves.spawn('drone', bx, by);
            d.startX = bx; d.nextFire = 900 + i * 200;
            this.g.fx.hitSpark(bx, by, 0xff43c8);
        });
        this.g.audio.play('dash-alt', { vol: 0.35, rate: 0.7 });
        return 1300;
    }

    sacRings() {
        const k = this.n(this.phase ? 16 : 13), off = Math.random() * TAU;
        this.repeat(500, 2, (i, x, y) => {
            ring(this.pool, x, y + SAC_Y, { speed: this.sp(0.5), style: i ? RING : ORB_M, damage: this.dmg, count: k, offset: off + i * 0.2 });
            this.sfx();
        });
        return 1600;
    }

    spores() {
        const c = this.c;
        this.repeat(300, 3, (i, x, y) => {
            for (const s of [-1, 1]) {
                const bx = x + s * BAY_X, by = y + BAY_Y;
                fan(this.pool, bx, by, angleTo(bx, by, c.px, c.py), { speed: this.sp(0.8), style: SPORE, damage: this.dmg, count: 3, spread: 24 });
            }
            this.sfx();
        });
        return 1400;
    }

    /** hangars glow amber, then spit a random cloud of spores */
    sporeBurst() {
        const ms = 700;
        for (const s of [-1, 1]) this.warn.ring(ms, { r: 22, follow: (it) => { it.x = this.x + s * BAY_X; it.y = this.y + BAY_Y; } });
        this.after(ms, () => {
            this.repeat(240, 3, (i, x, y) => {
                for (const s of [-1, 1]) burst(this.pool, x + s * BAY_X, y + BAY_Y, { count: this.n(9), speedMin: this.sp(0.3), speedMax: this.sp(0.7), style: i & 1 ? ORB_S : SPORE, damage: this.dmg });
                this.sfx();
            });
        });
        return ms + 1500;
    }

    /** amber target rings (one on the player, the rest nearby); each bursts into a ring of orbs */
    mortars() {
        const ms = 950, shots = this.phase >= 2 ? 4 : 3;
        const c = this.c;
        for (let i = 0; i < shots; i++) {
            const tx = i === 0 ? c.px : Math.max(30, Math.min(W - 30, c.px + (Math.random() - 0.5) * 220));
            const ty = i === 0 ? c.py : Math.max(H * 0.45, Math.min(H - 60, c.py + (Math.random() - 0.5) * 100));
            this.after(i * 160, () => this.warn.ring(ms, { x: tx, y: ty, r: 26 }));
            this.after(ms + i * 160, () => {
                ring(this.pool, tx, ty, { speed: this.sp(0.42), style: ORB_M, damage: this.dmg, count: this.n(10), offset: Math.random() * TAU });
                this.g.fx.explosion(tx, ty, 's', 'magenta');
            });
        }
        // the sac spits the shells: a short spray so the mortars visibly come from the boss
        this.repeat(160, shots, (i, x, y) => { aimed(this.pool, x, y + SPOUT_Y, c.px, c.py, { speed: this.sp(1.2), style: ORB_L, damage: this.dmg }); this.sfx(); });
        return ms + shots * 160 + 900;
    }

    /** rings that alternate offset, blooming outward like petals */
    flower() {
        const k = this.n(14), steps = 7;
        this.repeat(240, steps, (i, x, y) => {
            ring(this.pool, x, y + SAC_Y, { speed: this.sp(0.55 + (i & 1) * 0.12), style: i & 1 ? RING : ORB_M, damage: this.dmg, count: k, offset: (i * Math.PI) / k + i * 4 * DEG });
            this.sfx();
        });
        return steps * 240 + 1000;
    }
}
