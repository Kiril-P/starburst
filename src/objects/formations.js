// Scripted formations: groups that fly in a shape instead of trickling in one by one, so waves have set pieces.
// launch(name, type) queues members with spawn delays; each member gets a path fn(e, ms) (Enemy.moveStep) that
// drives x/y and returns false when the scripted part is over (then it flies straight on / is culled).
// Paths always end, which is what lets Enemy skip the off-screen cull while one is running.
// Fairness: formations enter from the top or the upper side edges only (never from below, where the player is),
// shrink when the wave is near its max-active cap, and grow with the pattern tier.
import { W } from '../config.js';
import { SET_PIECES } from './formationsSet.js';
import { STATION_PIECES } from './formationsStation.js';

const rand = (a, b) => a + Math.random() * (b - a);
const ease = (k) => 1 - (1 - k) * (1 - k);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** group size scaled by the difficulty's pattern density (easy 0.75 -> fewer ships, hard 1.25 -> a few more) */
const sized = (f, n) => Math.max(2, Math.round(n * Math.min(1.2, f.wm.diff?.patternDensity ?? 1)));

/** member = { at: ms delay, type, x, y, path?, extra?, after?(e) } */
const DEFS = {
    ...SET_PIECES,
    ...STATION_PIECES,
    // classic V: swoops in, holds the shape while gliding and swaying in sync, then breaks off
    vee(f, type, tier) {
        const count = tier >= 1 && sized(f, 5) >= 4 ? 5 : 3, x0 = rand(90, W - 90), out = [];
        for (let i = 0; i < count; i++) {
            const r = Math.ceil(i / 2), side = i & 1 ? -1 : 1, xs = x0 + side * r * 24, y0 = -16 - r * 12, yT = 72 - r * 12;
            out.push({ at: 0, type, x: xs, y: y0, path: (e, ms) => {
                const t = ms / 1000;
                if (t < 1.4) { e.y = y0 + (yT - y0) * ease(t / 1.4); return true; }
                e.x = xs + Math.sin((t - 1.4) * 0.9) * 40;
                e.y = yT + (t - 1.4) * 16;
                return t < 7;
            } });
        }
        return out;
    },
    // a snake of ships sweeping across the upper screen from one side, weaving up and down
    sweep(f, type, tier) {
        const count = sized(f, 3 + Math.min(3, tier)), dir = Math.random() < 0.5 ? 1 : -1, row = rand(36, 92), out = [];
        const x0 = dir > 0 ? -14 : W + 14;
        for (let i = 0; i < count; i++) {
            out.push({ at: i * 300, type, x: x0, y: row, path: (e, ms) => {
                const t = ms / 1000;
                e.x = x0 + dir * 92 * t;
                e.y = row + Math.sin(t * 2.4) * 14 + t * 3;
                return dir > 0 ? e.x < W + 45 : e.x > -45;
            } });
        }
        return out;
    },
    // two streams from the upper corners that curve in and close around the player's column
    pincer(f, type, tier) {
        const per = 2 + Math.min(2, tier), cx = clamp(f.wm.scene.player?.x ?? W / 2, 150, W - 150), out = [];
        for (const side of [-1, 1]) {
            for (let i = 0; i < per; i++) {
                const p0x = side < 0 ? -14 : W + 14, p0y = rand(24, 40);
                const p1x = cx + side * 40, p1y = 10;
                const p2x = cx + side * (44 + i * 34), p2y = 132 - i * 22;   // fan out so the ships never stack
                out.push({ at: i * 320, type, x: p0x, y: p0y, path: (e, ms) => {
                    const k = Math.min(1, ms / 2600), u = 1 - k;
                    // quadratic bezier P0 -> P1 -> P2
                    e.x = u * u * p0x + 2 * u * k * p1x + k * k * p2x;
                    e.y = u * u * p0y + 2 * u * k * p1y + k * k * p2y;
                    return k < 1;
                } });
            }
        }
        return out;
    },
    // ships spiral in from the top and sides onto a ring, rotate as a wheel for a while, then peel off downward
    circle(f, type, tier) {
        const count = sized(f, 5 + Math.min(3, tier)), cx = rand(170, W - 170), cy = 92, R = 60, spin = Math.random() < 0.5 ? 0.7 : -0.7, out = [];
        for (let i = 0; i < count; i++) {
            const th = (i / count) * Math.PI * 2;
            const ths = -Math.PI / 2 + wrapPi(th + Math.PI / 2) * 0.5;   // start angle squeezed into the upper half
            const sx = cx + Math.cos(ths) * 330, sy = cy + Math.sin(ths) * 150;
            out.push({ at: 0, type, x: sx, y: sy, path: (e, ms) => {
                const t = ms / 1000, k = ease(Math.min(1, t / 2.6));
                const a = ths + (th - ths) * k + spin * t, rx = 330 + (R - 330) * k, ry = 150 + (R - 150) * k;
                e.x = cx + Math.cos(a) * rx;
                e.y = cy + Math.sin(a) * ry;
                return t < 7.5;
            } });
        }
        return out;
    },
    // kamikaze cluster: arrives together, then the drones commit one after another (front first)
    swarm(f, type, tier) {
        const count = sized(f, 3 + Math.min(3, tier)), x0 = rand(110, W - 110), out = [];
        for (let i = 0; i < count; i++) {
            const r = Math.ceil(i / 2), side = i & 1 ? -1 : 1;
            out.push({ at: r * 120, type: 'kamikaze', x: x0 + side * r * 16, y: -12 - r * 8, extra: { delay: 700 + i * 380 - tier * 40 } });
        }
        return out;
    },
    // diagonal meteor rain: a band of rocks that all drift the same way, so there is always a lane
    shower(f, type, tier) {
        const count = sized(f, 5 + tier), dir = Math.random() < 0.5 ? 1 : -1, out = [];
        const lane = rand(0.2, 0.8);   // one gap in the band
        for (let i = 0; i < count; i++) {
            let u = i / (count - 1);
            if (Math.abs(u - lane) < 0.12) continue;
            const x = 30 + u * (W - 60) - dir * 60;
            out.push({ at: i * 160, type: 'meteor', x, y: -20, after: (e) => { e.vx = dir * 32; e.vy = rand(48, 62); } });
        }
        return out;
    },
    // two turrets dropping into the side thirds (station decks)
    turrets() {
        const out = [];
        const xs = [W * 0.28, W * 0.72];   // two at most: three spinning turrets at once is a wall, not a pattern
        xs.forEach((x, i) => out.push({ at: i * 700, type: 'turret', x: Math.round(x + rand(-20, 20)), y: -16 }));
        return out;
    },
    snipers(f, type, tier) {
        return [W * 0.25, W * 0.75].map((x, i) => ({ at: i * 900, type: 'sniper', x: Math.round(x + rand(-30, 30)), y: -14 }));
    },
    // two mine layers crossing in opposite directions at different heights
    minefield() {
        return [{ at: 0, type: 'minelayer', x: 0, y: rand(28, 50) }, { at: 1200, type: 'minelayer', x: W, y: rand(70, 100) }];
    }
};

export const FORMATION_NAMES = Object.keys(DEFS);

export default class Formations {
    constructor(wm) { this.wm = wm; this.queue = []; }

    /** name 'vee' | 'vee:spread' ... Returns false (and spawns nothing) if the wave has no room for it now. */
    launch(spec, force = false, delay = 0) {
        const [name, type = 'basic'] = spec.split(':');
        const def = DEFS[name];
        if (!def) return false;
        const members = def(this, type, this.wm.tier);
        // all-or-nothing keeps the shape readable; minor/meteor members don't need room
        const need = members.filter((m) => m.type !== 'meteor').length;
        if (!force && need > 0 && this.wm.room() < Math.ceil(need * 0.6)) return false;
        for (const m of members) { m.at += delay; this.queue.push(m); }
        return true;
    }

    update(dt) {
        const q = this.queue;
        for (let i = q.length - 1; i >= 0; i--) {
            const m = q[i];
            if ((m.at -= dt) > 0) continue;
            q[i] = q[q.length - 1]; q.pop();
            const e = this.wm.spawn(this.wm.resolve(m.type), Math.round(m.x), Math.round(m.y), m.extra);
            if (m.path) { e.path = m.path; e.age = 0; }
            if (m.after) m.after(e);
        }
    }

    clear() { this.queue.length = 0; }
}
