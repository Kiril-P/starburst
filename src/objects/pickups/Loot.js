// Drop rules + collect effects. Enemy kills (Combat.killEnemy, by the player only) roll score gems, an
// occasional hull repair (likelier when the hull is low, with a pity counter) and rare power-ups (rate-limited
// so the screen never fills with capsules). Boss kills spray a rich burst. Tuning: systems/loot.js.
import { W } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { LOOT, PICKUPS } from '../../systems/loot.js';
import Pickups from './Pickups.js';

const POOL = 160;
const CHAIN_MS = 450;            // gems collected within this gap climb a pitch ladder
const rand = (a, b) => a + Math.random() * (b - a);

function pickWeighted(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const k in weights) { r -= weights[k]; if (r < 0) return k; }
    return 'magnet';
}

export default class Loot {
    constructor(game) {
        this.g = game;
        this.pickups = new Pickups(game, POOL, (p) => this.collect(p));
        this.sinceRepair = 0;
        this.powerT = LOOT.powerGapMs * 0.5;
        this.chain = 0; this.chainT = 0;
        this.bossesSeen = 0;
        Object.assign(game.combat.stats, { gems: 0, powerups: 0 });
    }

    /** spawn n pickups of `type` flung out from (x,y) */
    burst(type, n, x, y, sp0 = 30, sp1 = 85) {
        for (let i = 0; i < n; i++) {
            // mostly upward fling, so drops arc and then settle (reads as "loot popped out")
            const a = -Math.PI / 2 + rand(-1.6, 1.6), v = rand(sp0, sp1);
            this.pickups.spawn(type, x + rand(-3, 3), y + rand(-3, 3), Math.cos(a) * v, Math.sin(a) * v);
        }
    }

    /** called for every enemy the player killed. t = ENEMY_TYPES entry */
    enemyDrop(t, x, y) {
        const L = LOOT, g = this.g, p = g.player;
        if (Math.random() < L.gemChance) {
            let budget = (t.score || 0) * L.gemBudget;
            const nl = Math.floor(budget / PICKUPS.gem_l.value); budget -= nl * PICKUPS.gem_l.value;
            const nm = Math.floor(budget / PICKUPS.gem_m.value); budget -= nm * PICKUPS.gem_m.value;
            const ns = Math.min(L.maxSmallGems, Math.round(budget / PICKUPS.gem_s.value));
            this.burst('gem_l', nl, x, y); this.burst('gem_m', nm, x, y); this.burst('gem_s', ns, x, y);
        }
        const hp01 = p.hp / p.maxHp;
        this.sinceRepair++;
        const chance = L.repairChance * (hp01 < L.lowHp ? L.repairLowHpMul : 1);
        if (hp01 < 0.85 && !this.pickups.countKind('repair') && (Math.random() < chance || this.sinceRepair >= L.repairPityKills)) {
            this.sinceRepair = 0;
            this.burst('repair', 1, x, y, 20, 40);
        }
        if (this.powerT <= 0 && Math.random() < L.powerChance * (t.big ? L.bigMul : 1)) {
            const onField = this.pickups.countKind('buff') + this.pickups.countKind('bomb');
            if (onField < L.maxPowerOnField) {
                this.powerT = L.powerGapMs;
                this.burst(pickWeighted(L.powerWeights), 1, x, y, 20, 40);
            }
        }
    }

    bossBurst(x, y) {
        const B = LOOT.boss;
        for (const k of ['gem_l', 'gem_m', 'gem_s']) this.burst(k, B[k], x, y, 50, 170);
        this.burst('repair', B.repair, x, y, 40, 90);
        const kinds = Object.keys(LOOT.powerWeights);
        for (let i = 0; i < B.power; i++) this.burst(kinds.splice((Math.random() * kinds.length) | 0, 1)[0], 1, x, y, 40, 90);
        this.g.fx.shockwave(Math.round(x), Math.round(y), COLORS.L, 1.2);
    }

    collect(p) {
        const g = this.g, d = p.def, x = Math.round(p.px), y = Math.round(p.py), st = g.combat.stats;
        if (d.kind === 'gem') {
            st.gems++;
            const pts = g.combat.addScore(d.value);
            g.combo.add(LOOT.gemEnergy);
            this.chain = this.chainT > 0 ? Math.min(this.chain + 1, 16) : 0;
            this.chainT = CHAIN_MS;
            g.audio.play('pickup', { vol: 0.32, rate: 1 + this.chain * 0.045 });
            g.fx.hitSpark(x, y, COLORS.L);
            if (d.value >= PICKUPS.gem_l.value) g.fx.floatText(x, y - 10, String(pts), '#e8ffb8', 8);
            return;
        }
        const pl = g.player;
        if (d.kind === 'repair') {
            const heal = Math.min(pl.maxHp - pl.hp, Math.round(pl.maxHp * d.heal));
            pl.hp += heal;
            g.fx.floatText(x, y - 12, heal > 0 ? `+${heal} HULL` : 'HULL FULL', '#b7ff4a', 8);
        } else {
            st.powerups++;
            g.powerups.activate(p.type);
            g.hud.toast(d.title, '#b7ff4a');
        }
        g.fx.shockwave(x, y, COLORS.L, 0.4);
        g.fx.hitSpark(x, y, COLORS.j);
        g.audio.play('level-up', { vol: 0.55, rate: d.kind === 'repair' ? 1.2 : 1 });
    }

    vacuum() { this.pickups.vacuum(); }

    update(dt) {
        const g = this.g;
        this.powerT -= dt;
        if (this.chainT > 0) this.chainT -= dt;
        this.pickups.update(dt, g.player);
        // Boss deaths: BossDirector counts them in combat.stats.bosses at the final blast (boss still in place).
        // Watching the counter keeps the boss code untouched by the loot system.
        const n = g.combat.stats.bosses || 0;
        if (n > this.bossesSeen) {
            this.bossesSeen = n;
            const b = g.bosses.boss;
            this.bossBurst(b ? b.x : W / 2, b ? b.y : 80);
        }
    }

    destroy() { this.pickups.destroy(); }
}
