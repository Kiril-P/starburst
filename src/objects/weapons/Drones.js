// DRONES secondary: 1-3 gun drones orbiting the ship. They take turns shooting the nearest enemy in range
// (auto-aim, so they help most when the ship is busy dodging and facing the wrong way). Level 3 drones also
// soak enemy bullets they touch; SWARM synergy turns every third drone shot into a seeker missile.
import { DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';
import { SHOT, DRONE } from './weaponDefs.js';
import { spawnShot, nearestTarget } from './shots.js';

const MAX = 3;
const TAU = Math.PI * 2;

export default class Drones {
    constructor(arsenal) {
        this.a = arsenal;
        this.spin = 0;
        this.t = 0;
        this.turn = 0;      // which drone fires next
        this.shots = 0;
        this.sprites = [];
        const s = arsenal.g;
        for (let i = 0; i < MAX; i++) {
            const d = s.add.sprite(0, 0, 'drone', 0).setDepth(DEPTH.PLAYER + 1).setVisible(false);
            if (s.anims.exists('drone')) d.play({ key: 'drone', startFrame: i % 2 });
            this.sprites.push(d);
        }
    }

    update(dt) {
        const a = this.a, p = a.p, s = a.stats('drones');
        const n = s && p.alive ? s.count : 0;
        this.spin = (this.spin + DRONE.spin * dt / 1000) % TAU;
        for (let i = 0; i < MAX; i++) {
            const d = this.sprites[i];
            if (i >= n) { if (d.visible) d.setVisible(false); continue; }
            const ang = this.spin + (i / n) * TAU;
            d.setPosition(Math.round(p.x + Math.cos(ang) * DRONE.radius), Math.round(p.y + Math.sin(ang) * DRONE.radius)).setVisible(true);
        }
        if (!n) return;
        if (s.block) this.block(n);
        if (!p.controllable) return;
        if ((this.t -= dt) > 0) return;
        this.t += s.every / n;          // the drones share one cadence, staggered
        if (this.t < 0) this.t = 0;
        const d = this.sprites[this.turn++ % n];
        const e = nearestTarget(a.g, d.x, d.y, DRONE.range, null);
        if (!e) return;
        const ang = Math.atan2(e.y - d.y, e.x - d.x);
        a.g.audio.play('shoot-drone', { vol: 0.22 });
        if (a.syn.swarm && ++this.shots % 3 === 0) a.missiles.launch(p, 0, a.baseDamage * 0.9, 0, d.x, d.y);
        else spawnShot(a.g.shots, d.x, d.y, ang, 1.1, SHOT.pellet, a.baseDamage * s.dmg, { pierce: a.bonusPierce });
    }

    /** level 3: enemy bullets touching a drone are absorbed */
    block(n) {
        const g = this.a.g, live = g.enemyBullets.live;
        for (let j = 0; j < n; j++) {
            const d = this.sprites[j], R = DRONE.blockR;
            for (let i = 0; i < live.length; i++) {
                const b = live[i];
                if (!b.alive) continue;
                const dx = b.x - d.x, dy = b.y - d.y, r = R + b.r;
                if (dx * dx + dy * dy < r * r) { g.enemyBullets.kill(b); g.fx.hitSpark(b.x, b.y, COLORS.b); }
            }
        }
    }

    destroy() { for (const d of this.sprites) d.destroy(); }
}
