// The player's loadout for a run: one equipped primary + stacking secondaries + synergy perks, with levels.
// Player decides WHEN to fire (fire key, fire-rate timer, facing = Player.aim); Arsenal decides WHAT comes out.
// Every shot leaves along the ship's facing, so all weapons work with the 8-way turning ship.
// Game wires: Player onFire -> fire(x, y, angle); step -> update(dt); upgrade pick -> apply(id).
import { PRIMARY, SECONDARY, SYNERGIES, SYNERGY_MIN, SHIP_WEAPON, SHOT, BUFF_RATE } from './weaponDefs.js';
import { spawnShot, steerHoming } from './shots.js';
import Charge from './Charge.js';
import Missiles from './Missiles.js';
import Drones from './Drones.js';

const DEG = Math.PI / 180;

export default class Arsenal {
    constructor(game, player) {
        this.g = game;
        this.p = player;
        this.mods = SHIP_WEAPON[player.shipType] || SHIP_WEAPON.normal;
        this.primary = 'blaster';
        this.lv = { blaster: 1, spread: 0, lance: 0, charge: 0, missiles: 0, drones: 0 };
        this.syn = { splinter: false, swarm: false, overload: false, hunter: false };
        this.charge = new Charge(this);
        this.missiles = new Missiles(this);
        this.drones = new Drones(this);
        this.rapid = false;          // set by the rapid-fire power-up
    }

    /** current level stats of a weapon line (null when not owned) */
    stats(id) {
        const d = PRIMARY[id] || SECONDARY[id], L = this.lv[id];
        return L ? d.levels[L - 1] : null;
    }

    get baseDamage() { return this.p.stats.damage; }
    /** extra pierce from the SPLINTER synergy */
    get bonusPierce() { return this.syn.splinter ? 1 : 0; }

    /** Player's fire hook: one volley of the equipped primary from the ship's nose along `a`. */
    fire(x, y, a) {
        const id = this.primary;
        if (id === 'charge') return;   // Charge reads the fire key itself (hold to charge, release to shoot)
        const s = this.stats(id), m = this.mods, g = this.g, D = this.baseDamage, pool = g.shots;
        const px = -Math.sin(a), py = Math.cos(a);   // perpendicular to the facing, for parallel barrels
        let rate = 1;
        if (id === 'blaster') {
            const style = m.heavy ? SHOT.heavy : SHOT.basic;
            const gap = m.heavy ? 6 : 5;
            const homing = this.syn.hunter ? 2.4 : 0;
            for (let i = 0; i < s.barrels; i++) {
                const off = (i - (s.barrels - 1) / 2) * gap;
                spawnShot(pool, x + px * off, y + py * off, a, m.speed, style, D * s.dmg, { homing, pierce: this.bonusPierce, fuse: 1400 });
            }
        } else if (id === 'spread') {
            const arc = s.arc * m.arc * DEG;
            for (let i = 0; i < s.count; i++) {
                spawnShot(pool, x, y, a + (i / (s.count - 1) - 0.5) * arc, 0.9 * m.speed, SHOT.pellet, D * s.dmg, { pierce: this.bonusPierce });
            }
            rate = 0.85;
        } else if (id === 'lance') {
            const n = s.twin ? 2 : 1;
            for (let i = 0; i < n; i++) {
                const off = n === 1 ? 0 : (i ? 3 : -3);
                spawnShot(pool, x + px * off, y + py * off, a, 1.5 * m.speed, SHOT.lance, D * s.dmg, { pierce: s.pierce + this.bonusPierce });
            }
            rate = 1.3;
        }
        g.fx.muzzle(Math.round(x), Math.round(y));
        // each weapon family has its own voice (audio/sfx/recipesCombat.js)
        if (id === 'spread') g.audio.play('shoot-spread', { vol: 0.3, rate });
        else if (id === 'lance') g.audio.play('shoot-lance', { vol: 0.28 });
        else g.audio.play('player-shoot', { vol: 0.28, jitter: 120, rate });
    }

    update(dt) {
        const p = this.p;
        // fire interval = ship interval x weapon interval x rapid-fire buff (Player.fireRate multiplies this in)
        const s = this.primary === 'charge' ? null : this.stats(this.primary);
        p.fireRateMul = (s ? s.rate : 1) * (this.rapid ? BUFF_RATE : 1);
        this.charge.update(dt);
        this.missiles.update(dt);
        this.drones.update(dt);
        steerHoming(this.g, this.g.shots);
    }

    // --- upgrades -----------------------------------------------------------------------------------------------
    /** apply an upgrade-card id ('w:spread', 'syn:swarm'). Returns false for ids that aren't weapons. */
    apply(id) {
        if (typeof id !== 'string') return false;
        if (id.startsWith('syn:')) { const k = id.slice(4); if (!(k in this.syn)) return false; this.syn[k] = true; return true; }
        if (!id.startsWith('w:')) return false;
        const k = id.slice(2), d = PRIMARY[k] || SECONDARY[k];
        if (!d) return false;
        if (this.lv[k] < d.levels.length) this.lv[k]++;
        if (PRIMARY[k]) this.primary = k;
        return true;
    }

    /** every weapon card that could be offered right now: [{ id, title, desc, icon, tag, hue, weight, rare }] */
    offers() {
        const out = [];
        const card = (id, title, desc, icon, tag, weight, hue = 'cyan', rare = false) => out.push({ id, title, desc, icon, tag, hue, weight, rare });
        for (const [k, d] of Object.entries(PRIMARY)) {
            const L = this.lv[k], max = d.levels.length;
            if (k === this.primary) {
                if (L < max) card(`w:${k}`, `${d.title} LV${L + 1}`, d.levels[L].desc, d.icon, 'UPGRADE', 3);
            } else if (!L) card(`w:${k}`, d.title, d.levels[0].desc, d.icon, 'WEAPON', 1.5);
            else card(`w:${k}`, L < max ? `${d.title} LV${L + 1}` : d.title, L < max ? `Swap back: ${d.levels[L].desc}` : `Swap back to ${d.title}`, d.icon, 'WEAPON', 1);
        }
        for (const [k, d] of Object.entries(SECONDARY)) {
            const L = this.lv[k];
            if (L < d.levels.length) card(`w:${k}`, L ? `${d.title} LV${L + 1}` : d.title, d.levels[L].desc, d.icon, L ? 'UPGRADE' : 'NEW', 2);
        }
        for (const [k, d] of Object.entries(SYNERGIES)) {
            if (!this.syn[k] && d.needs.every((n) => this.lv[n] >= SYNERGY_MIN)) card(`syn:${k}`, d.title, `${d.needs.map((n) => (PRIMARY[n] || SECONDARY[n]).title).join(' + ')}: ${d.desc}`, d.icon, 'SYNERGY', 1, 'amber', true);
        }
        return out;
    }

    /** build for the GameOver summary: equipped primary, other owned lines, synergies */
    summary() {
        const out = [];
        const line = (k, d, kind) => out.push({ id: k, title: d.title, icon: d.icon, lv: this.lv[k] ?? 1, max: d.levels ? d.levels.length : 1, kind });
        line(this.primary, PRIMARY[this.primary], 'primary');
        for (const [k, d] of Object.entries(SECONDARY)) if (this.lv[k]) line(k, d, 'secondary');
        for (const [k, d] of Object.entries(PRIMARY)) if (this.lv[k] && k !== this.primary) line(k, d, 'reserve');   // owned, holstered
        for (const [k, d] of Object.entries(SYNERGIES)) if (this.syn[k]) line(k, d, 'synergy');
        return out;
    }

    destroy() {
        this.charge.destroy();
        this.drones.destroy();
    }
}
