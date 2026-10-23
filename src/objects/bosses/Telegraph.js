// Amber "heads-up" markings drawn before a boss's big attacks (STYLE.md: amber = warning). Dotted 1px lines,
// lane bands and target rings, blinking between two amber steps. Advanced on simulation dt so they freeze with
// pause / hit-stop exactly like the attack they announce. One Graphics object, items are pooled.
import { W, H, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';

const BLINK_MS = 90;
const LONG = Math.hypot(W, H);

export default class Telegraph {
    constructor(scene) {
        this.g = scene.add.graphics().setDepth(DEPTH.ENEMY - 1);
        this.items = [];
        this.spare = [];
        this.t = 0;
    }

    _add(kind, ms, o) {
        const it = this.spare.pop() || {};
        it.kind = kind; it.ms = ms; it.total = ms;
        it.x = o.x ?? 0; it.y = o.y ?? 0; it.a = o.a ?? Math.PI / 2; it.len = o.len ?? LONG; it.w = o.w ?? 0; it.r = o.r ?? 0;
        it.g0 = o.g0 ?? -1; it.g1 = o.g1 ?? -1;   // wall: safe gap between these distances along the line
        it.follow = o.follow || null;   // follow(it): update x/y/a every frame (rotating beams, tracking boss)
        this.items.push(it);
        return it;
    }

    /** dotted line from (x,y) along angle a */
    line(ms, o) { return this._add('line', ms, o); }
    /** vertical danger lane centred on x, w px wide, from y down to the bottom */
    lane(ms, o) { return this._add('lane', ms, o); }
    /** bullet wall along angle a from (x,y): dotted danger line with a bracketed safe gap from g0 to g1 px */
    wall(ms, o) { return this._add('wall', ms, o); }
    /** shrinking target ring */
    ring(ms, o) { return this._add('ring', ms, o); }

    clear() { for (const it of this.items) this.spare.push(it); this.items.length = 0; this.g.clear(); }

    update(dt) {
        this.t += dt;
        const g = this.g.clear();
        if (!this.items.length) return;
        const hot = ((this.t / BLINK_MS) | 0) & 1;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            if ((it.ms -= dt) <= 0) { this.items[i] = this.items[this.items.length - 1]; this.items.pop(); this.spare.push(it); continue; }
            if (it.follow) it.follow(it);
            // the last third blinks fast and brightens: "it's coming NOW"
            const late = it.ms < it.total / 3;
            const col = late ? (((this.t / 45) | 0) & 1 ? COLORS.z : COLORS.A) : hot ? COLORS.A : COLORS.a;
            g.fillStyle(col, 1);
            if (it.kind === 'line') this.dots(g, it.x, it.y, it.a, it.len, late ? 2 : 4);
            else if (it.kind === 'lane') this.lane_(g, it, late);
            else if (it.kind === 'wall') this.wall_(g, it, late);
            else this.ring_(g, it, late);
        }
    }

    dots(g, x, y, a, len, step) {
        const c = Math.cos(a), s = Math.sin(a);
        const off = (this.t / 30) % step;   // dots crawl along the line toward the target
        for (let d = off; d < len; d += step) {
            const px = Math.round(x + c * d), py = Math.round(y + s * d);
            if (px < -2 || px > W + 2 || py < -2 || py > H + 2) { if (d > 40) break; continue; }
            g.fillRect(px, py, 1, 1);
        }
    }

    wall_(g, it, late) {
        const c = Math.cos(it.a), s = Math.sin(it.a), step = late ? 2 : 3;
        for (let d = 0; d < it.len; d += step) {
            if (d > it.g0 && d < it.g1) continue;
            g.fillRect(Math.round(it.x + c * d), Math.round(it.y + s * d), 1, 1);
        }
        // brackets at both gap edges: short ticks across the line, so the opening reads at a glance
        for (const d of [it.g0, it.g1]) {
            if (d < 0) continue;
            const bx = it.x + c * d, by = it.y + s * d;
            for (let k = -4; k <= 4; k++) g.fillRect(Math.round(bx - s * k), Math.round(by + c * k), 1, 1);
        }
    }

    lane_(g, it, late) {
        const x0 = Math.round(it.x - it.w / 2), x1 = Math.round(it.x + it.w / 2);
        const y0 = Math.round(it.y);
        for (let y = y0 + ((this.t / 30) | 0) % 4; y < H; y += 4) { g.fillRect(x0, y, 1, 2); g.fillRect(x1, y, 1, 2); }
        // chevrons down the middle every 24px
        const cx = Math.round(it.x);
        for (let y = y0 + 10; y < H - 40; y += 24) {
            g.fillRect(cx - 2, y, 1, 1); g.fillRect(cx - 1, y + 1, 1, 1); g.fillRect(cx, y + 2, 1, 1); g.fillRect(cx + 1, y + 1, 1, 1); g.fillRect(cx + 2, y, 1, 1);
            if (late) { g.fillRect(cx - 2, y + 3, 1, 1); g.fillRect(cx + 2, y + 3, 1, 1); }
        }
    }

    ring_(g, it) {
        const r = Math.max(3, it.r * (0.35 + 0.65 * (it.ms / it.total)));
        const n = Math.max(12, Math.round(r * 1.2));
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            g.fillRect(Math.round(it.x + Math.cos(a) * r), Math.round(it.y + Math.sin(a) * r), 1, 1);
        }
        g.fillRect(Math.round(it.x) - 3, Math.round(it.y), 7, 1);
        g.fillRect(Math.round(it.x), Math.round(it.y) - 3, 1, 7);
    }

    destroy() { this.g.destroy(); this.items.length = 0; }
}
