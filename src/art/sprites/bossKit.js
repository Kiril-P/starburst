// Tiny pixel "plate & bevel" kit used to block out the second wave of boss sprites (bosses2.js).
// It only ever writes palette characters into a char grid, so its output is a plain text map that goes through
// bake.js like every hand-authored sprite. Why a kit and not hand-typed maps: 7 bosses x 2-4 frames of 60-128px
// art would be thousands of lines; describing them as shapes keeps the files readable and the shading rules
// (STYLE.md: light from the upper-left, 1px k outline, ramps only, right half one step darker) consistent.
//
// Shapes are predicates over pixel centres (x+0.5, y+0.5), so the same description renders crisp at any size.

export const RAMP = {
    steel: ['1', '2', '3', '4', '5', '6'],
    hull: ['1', '2', '3', '4', '4', '5'],      // flatter steel for big plates (less glare)
    violet: ['u', 'u', 'v', 'V', 'V', 'x'],
    magenta: ['p', 'p', 'm', 'M', 'M', 'q'],
    amber: ['y', 'y', 'a', 'A', 'A', 'z']
};
const DARKER = { 6: '5', 5: '4', 4: '3', 3: '2', 2: '1', x: 'V', V: 'v', v: 'u' };

// ---- shape predicates -----------------------------------------------------------------------------------------
export const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
export const rect = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
export const ring = (cx, cy, r0, r1) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; };
/** polygon from [[x,y],...] (even-odd rule) */
export function poly(pts) {
    return (x, y) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    };
}
/** polygon mirrored around x = cx: give only the left half's outline (top to bottom), the right is reflected */
export function mpoly(cx, half) {
    return poly([...half, ...half.slice().reverse().map(([x, y]) => [2 * cx - x, y])]);
}
export const union = (...ps) => (x, y) => ps.some((p) => p(x, y));
export const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);
export const inter = (a, b) => (x, y) => a(x, y) && b(x, y);
/** mirror a predicate around x = cx (draw one side, get both) */
export const mirror = (cx, p) => (x, y) => p(x, y) || p(2 * cx - x, y);

export class Px {
    constructor(w, h) {
        this.w = w; this.h = h;
        this.g = Array.from({ length: h }, () => Array(w).fill('.'));
    }

    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.g[y][x]; }
    set(x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = ch; return this; }

    each(pred, fn) {
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (pred(x + 0.5, y + 0.5)) fn(x, y);
        return this;
    }

    fill(pred, ch) { return this.each(pred, (x, y) => this.set(x, y, ch)); }

    /**
     * Bevelled plate: 1px highlight on edges facing up/left, 1px shade on edges facing down/right, a softer
     * second ring, mid tone inside. ramp = [darkest .. highlight] (6 steps, see RAMP).
     */
    plate(pred, ramp, { bevel = 2, body = 3 } = {}) {
        const inside = (x, y) => pred(x + 0.5, y + 0.5);
        return this.each(pred, (x, y) => {
            let ch = ramp[body];
            for (let d = bevel; d >= 1; d--) {
                const lo = !inside(x + d, y) || !inside(x, y + d), hi = !inside(x - d, y) || !inside(x, y - d);
                if (lo) ch = d === 1 ? ramp[0] : ramp[1];
                else if (hi) ch = d === 1 ? ramp[5] : ramp[4];
            }
            this.set(x, y, ch);
        });
    }

    /** emissive orb: concentric steps dark rim -> white-hot centre (magenta by default) */
    glow(cx, cy, r, steps = ['p', 'm', 'M', 'q', 'w'], ry = r) {
        steps.forEach((ch, i) => {
            const k = 1 - i / steps.length;
            this.fill(ellipse(cx, cy, Math.max(0.6, r * k), Math.max(0.6, ry * k)), ch);
        });
        return this;
    }

    /** checkerboard dither of `ch` over the predicate, only on already-filled pixels (glow spill, no alpha) */
    dither(pred, ch, phase = 0) {
        return this.each(pred, (x, y) => { if (((x + y + phase) & 1) === 0 && this.get(x, y) !== '.') this.set(x, y, ch); });
    }

    line(x0, y0, x1, y1, ch) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), ch);
        return this;
    }

    /** 1px k outline around everything drawn (4-neighbourhood, like the hand-made sprites) */
    outline(ch = 'k') {
        const add = [];
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
            if (this.g[y][x] !== '.') continue;
            if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = this.get(x + dx, y + dy); return c !== '.' && c !== ch; })) add.push([x, y]);
        }
        for (const [x, y] of add) this.g[y][x] = ch;
        return this;
    }

    /** right half one step darker (light from the upper-left), same rule as lit() in bosses.js */
    lit() {
        const half = Math.ceil(this.w / 2);
        for (const row of this.g) for (let x = half; x < this.w; x++) if (DARKER[row[x]]) row[x] = DARKER[row[x]];
        return this;
    }

    rows() { return this.g.map((r) => r.join('')); }
}

/** palette swap on finished rows (idle pulse frames) */
export const swap = (rows, map) => rows.map((r) => [...r].map((ch) => map[ch] || ch).join(''));
export const PULSE = { m: 'M', M: 'q' };
export const DEG = Math.PI / 180;
