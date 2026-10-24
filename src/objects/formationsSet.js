// Set-piece formations (merged into formations.js DEFS): a wall with a gap, a spiral, a turret line, a kamikaze
// rush, shield-carrier escorts, a volatile fuse line and a mine bloom. Same contract as formations.js:
// def(f, type, tier) -> members [{ at, type, x, y, path?, extra?, after?(e) }]; paths always end.
import { W, H } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);
const ease = (k) => 1 - (1 - k) * (1 - k);
const sized = (f, n) => Math.max(2, Math.round(n * Math.min(1.2, f.wm.diff?.patternDensity ?? 1)));
const SILENT = 1e9;   // nextFire for ships that are scenery with a purpose (wall, fuse): they don't shoot

export const SET_PIECES = {
    // the gentlest set piece: three ships side by side, straight down (wave 1 opener)
    line(f, type) {
        return [0.3, 0.5, 0.7].map((k, i) => ({ at: i * 250, type, x: Math.round(W * k), y: -14 }));
    },
    // a blockade sinking down the screen with one hole to slip through; shoot ships to widen the hole
    wall(f, type, tier) {
        const slots = 16, gapN = 3, g0 = 1 + Math.floor(Math.random() * (slots - gapN - 1)), speed = 30 + tier * 3, out = [];
        for (let i = 0; i < slots; i++) {
            if (i >= g0 && i < g0 + gapN) continue;
            const x = Math.round(22 + (i * (W - 44)) / (slots - 1));
            out.push({ at: 0, type, x, y: -14, after: (e) => { e.nextFire = SILENT; }, path: (e, ms) => {
                e.x = x; e.y = -14 + (ms / 1000) * speed;
                return e.y < H + 10;
            } });
        }
        return out;
    },
    // ships pour in from the top centre and spiral outward as one long arm, then break away
    spiral(f, type, tier) {
        const count = sized(f, 6 + Math.min(3, tier)), cx = Math.round(rand(200, W - 200)), cy = 72, dir = Math.random() < 0.5 ? 1 : -1, out = [];
        for (let i = 0; i < count; i++) {
            out.push({ at: i * 330, type, x: cx, y: -14, path: (e, ms) => {
                const t = ms / 1000;
                if (t < 0.9) { e.x = cx; e.y = -14 + (cy + 14) * ease(t / 0.9); return true; }
                const u = t - 0.9, r = u * 36, a = -Math.PI / 2 + dir * u * 1.9;
                e.x = cx + Math.cos(a) * r; e.y = cy + Math.sin(a) * r * 0.7;
                return u < 9 && e.x > -10 && e.x < W + 10 && e.y < H * 0.7;
            } });
        }
        return out;
    },
    // a line of turrets across the top: three bolted-down spinners that fire in rolling bursts
    turretline(f, type, tier) {
        return [0.2, 0.5, 0.8].map((k, i) => ({ at: i * 450, type: 'turret', x: Math.round(W * k), y: -16, after: (e) => { e.anchorY = i === 1 ? 62 : 40; e.holdMs = 8500; } }));
    },
    // kamikaze zipper: a row along the top that commits one drone at a time, left to right (or reverse)
    rush(f, type, tier) {
        const count = sized(f, 6 + Math.min(3, tier)), dir = Math.random() < 0.5 ? 1 : -1, out = [];
        for (let i = 0; i < count; i++) {
            const u = i / (count - 1), x = 36 + (dir > 0 ? u : 1 - u) * (W - 72);
            out.push({ at: i * 70, type: 'kamikaze', x, y: -12, extra: { delay: 900 + i * 330 - tier * 30 } });
        }
        return out;
    },
    // a shield carrier with two gunships glued to its wings: kill the escorts first, then flank the carrier
    escort(f, type, tier) {
        const x = Math.round(rand(190, W - 190));
        let lead = null, gen = 0;
        const out = [{ at: 0, type: 'shield', x, y: -22, after: (e) => { lead = e; gen = e.gen; } }];
        for (const side of [-1, 1]) {
            out.push({ at: 70, type: 'basic', x: x + side * 38, y: -22, path: (e) => {
                if (!lead || !lead.alive || lead.gen !== gen) return false;
                e.x = lead.x + side * 38; e.y = lead.y - 6;
                return true;
            } });
        }
        return out;
    },
    // a row of amber-blinking volatile ships: pop one and the blast ripples down the whole line
    fuse(f, type, tier) {
        const count = 7, x0 = rand(120, W - 120 - (count - 1) * 30), out = [];
        for (let i = 0; i < count; i++) {
            const xs = Math.round(x0 + i * 30);
            out.push({ at: i * 60, type, x: xs, y: -14, after: (e) => { e.volatile = true; e.nextFire = SILENT; }, path: (e, ms) => {
                const t = ms / 1000;
                e.x = xs; e.y = t < 1.6 ? -14 + 78 * ease(t / 1.6) : 64 + (t - 1.6) * 12;
                return t < 16;
            } });
        }
        return out;
    },
    // eight mines blossom in a ring; they all sit inside each other's blast, so one shot pops the lot
    bloom() {
        const cx = Math.round(rand(170, W - 170)), out = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            out.push({ at: i * 80, type: 'mine', x: Math.round(cx + Math.cos(a) * 66), y: Math.round(86 + Math.sin(a) * 40) });
        }
        return out;
    }
};
