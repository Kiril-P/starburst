// Dev-only __dbg helpers for weapons + loot (merged into window.__dbg by systems/debug.js):
//   __dbg.weapon('spread', 3)   equip / set a weapon line level (primaries equip, secondaries stack)
//   __dbg.synergy('swarm')      grant a synergy          __dbg.build()  -> Arsenal.summary()
//   __dbg.drop('magnet', x?, y?) spawn a pickup (gem_s gem_m gem_l repair magnet rapid x2 shield bomb), default above the ship
//   __dbg.buff('rapid')         activate a power-up directly     __dbg.lootBurst()  boss-style burst mid-screen
//   __dbg.offers(boss?)         roll upgrade options with the current loadout (no UI)
//   __dbg.gear()                -> { primary, lv, syn, pickups, buffs, shots }
import { W } from '../../config.js';
import { PRIMARY, SECONDARY } from './weaponDefs.js';
import { rollOptions } from '../../systems/upgrades.js';

export function gearDebug(g) {
    return {
        weapon(id = 'spread', lv = 1) {
            const a = g.arsenal, d = PRIMARY[id] || SECONDARY[id];
            if (!d) return `unknown weapon ${id}`;
            a.lv[id] = Math.max(0, Math.min(d.levels.length, lv));
            if (PRIMARY[id] && lv > 0) a.primary = id;
            return a.summary();
        },
        synergy(id = 'splinter') { if (id in g.arsenal.syn) g.arsenal.syn[id] = true; return g.arsenal.syn; },
        build() { return g.arsenal.summary(); },
        drop(type = 'magnet', x = g.player.x, y = g.player.y - 70) { return !!g.loot.pickups.spawn(type, x, y, 0, 0); },
        buff(type = 'rapid') { g.powerups.activate(type); return { ...g.powerups.t }; },
        lootBurst(x = W / 2, y = 90) { g.loot.bossBurst(x, y); return g.loot.pickups.count; },
        offers(boss = false) { return rollOptions(g.player.levels, Math.random, g.arsenal, { boss }).map((o) => `${o.tag}: ${o.title}`); },
        gear() {
            const a = g.arsenal;
            return { primary: a.primary, lv: { ...a.lv }, syn: { ...a.syn }, pickups: g.loot.pickups.count, buffs: { ...g.powerups.t }, shots: g.shots.count, fireRate: Math.round(g.player.fireRate) };
        }
    };
}
