// MISSILES secondary: auto-launches homing missiles while there's something to hit. They leave the hull to the
// sides of the facing (so they're visibly separate from the primary stream), accelerate and curve onto the
// nearest target (steerHoming in shots.js). Level 3 adds a small blast (Combat.shotHit -> splash).
import { SHOT, MISSILE } from './weaponDefs.js';
import { spawnShot, nearestTarget } from './shots.js';
import { PLAYER } from '../../systems/tuning.js';

export default class Missiles {
    constructor(arsenal) {
        this.a = arsenal;
        this.t = 600;
        this.side = 1;
    }

    update(dt) {
        const a = this.a, p = a.p, s = a.stats('missiles');
        if (!s || !p.alive || !p.controllable) return;
        if ((this.t -= dt) > 0) return;
        if (!nearestTarget(a.g, p.x, p.y, 420, null)) { this.t = 150; return; }   // hold fire until a target shows up
        this.t = s.every;
        for (let i = 0; i < s.count; i++) {
            this.side = -this.side;
            this.launch(p, this.side, a.baseDamage * s.dmg, s.splash);
        }
        a.g.audio.play('shoot-missile', { vol: 0.3 });
    }

    /** one missile from the left (-1) or right (+1) of the hull; also used by the SWARM drones */
    launch(p, side, dmg, splash, x = p.x, y = p.y) {
        const ang = p.aim, px = -Math.sin(ang), py = Math.cos(ang);
        spawnShot(this.a.g.shots, x + px * side * 9, y + py * side * 9, ang + side * 0.9, MISSILE.speed / PLAYER.shotSpeed, SHOT.missile, dmg, {
            homing: MISSILE.turn, fuse: MISSILE.fuseMs, accel: MISSILE.accel, maxSpeed: MISSILE.maxSpeed, splash
        });
    }
}
