// Third wave of hostile ships: strafer, seeker, laser pylon (the wall emitter reuses it, rotated by code) and warper.
// Same rules as enemies2.js: face DOWN, k outline broken only by emissive parts, violet hulls with magenta energy,
// amber only where the ship is a warning. These are composed in code (shapes + a lit ramp) so the geometry stays exact;
// every pixel is still a palette char.

const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const rowsOf = (g) => g.map((r) => r.join(''));
const put = (g, x, y, ch) => { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; };

/** 1px k outline around every filled pixel, except next to emissive chars (they break the silhouette) */
function outline(g, emissive = '') {
    const h = g.length, w = g[0].length, out = g.map((r) => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (g[y][x] !== '.') continue;
        let solid = false, glow = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = g[y + dy]?.[x + dx];
            if (!c || c === '.') continue;
            if (emissive.includes(c)) glow = true; else solid = true;
        }
        if (solid && !glow) out[y][x] = 'k';
    }
    return out;
}

/** shade value 0..1 -> ramp char (light from the upper left) */
const ramp = (chars, l) => chars[Math.max(0, Math.min(chars.length - 1, Math.floor(l * chars.length)))];
const light = (dx, dy, size) => 0.5 + (-dx - dy) / (2.2 * size);

/** fill every pixel inside inside(x, y) with ramp chars chosen by shade(x, y) */
function fill(g, inside, shade) {
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (inside(x, y)) g[y][x] = shade(x, y);
}

// ---- strafer: a flat raider, swept violet wings, wingtip guns, a magenta eye in a steel hull ----------------------------
function strafer(hot) {
    const W = 25, H = 15, c = 12, g = grid(W, H);
    // swept-back wings: a trapezoid from the hull out to the wingtip guns (the tips sit higher: the nose points down)
    const wing = (x, y) => {
        const d = Math.abs(x - c);
        if (d < 3 || d > 11) return false;
        const top = 2 - Math.floor((d - 3) / 4), bottom = 9 - Math.floor((d - 3) * 0.45);
        return y >= top && y <= bottom;
    };
    fill(g, wing, (x, y) => ramp('vVVxx', light(x - 6, y - 4, 8) + (x < c ? 0.15 : -0.1) + (y <= 2 ? 0.2 : 0)));
    // leading (lower) edge catches a rim of light, trailing edge stays dark
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (g[y][x] !== '.' && g[y + 1]?.[x] === '.') g[y][x] = x < c ? 'x' : 'V';
    // fuselage: an ellipse narrowing into a nose that points down
    fill(g, (x, y) => { const dx = Math.abs(x - c), t = (y - 1) / 12; return y >= 1 && y <= 12 && dx <= Math.round(4 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.12)) + (t > 0.75 ? -1 : 0)); },
        (x, y) => ramp('2345', light(x - c, y - 6, 6) + 0.08));
    // wingtip gun pods
    for (const s of [-1, 1]) {
        const px = c + s * 11;
        for (let y = 3; y <= 10; y++) for (const dx of [-1, 0, 1]) put(g, px + dx, y, y >= 9 ? 'M' : (dx === -1 ? '5' : dx === 0 ? '4' : '3'));
        put(g, px, 11, hot ? 'w' : 'q');
        put(g, px, 10, hot ? 'q' : 'M');
    }
    // cockpit eye
    for (const [dx, dy, ch] of [[0, 5, hot ? 'q' : 'M'], [-1, 6, 'm'], [0, 6, hot ? 'w' : 'q'], [1, 6, 'm'], [0, 7, hot ? 'q' : 'M']]) put(g, c + dx, dy, ch);
    // nose cannon
    put(g, c, 11, 'M'); put(g, c, 12, hot ? 'w' : 'q');
    return rowsOf(outline(g, 'Mqw'));
}

// ---- seeker: a spiked violet orb with one big hunting eye low on the body (it points where it is heading) ----------------
function seeker(hot) {
    const S = 15, c = 7, g = grid(S, S);
    fill(g, (x, y) => Math.hypot(x - c, y - c) <= 5.2, (x, y) => ramp('uvVx', light(x - c, y - c, 5)));
    // four diagonal spikes and a short thruster stub at the top (it flies away from it)
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let d = 5; d <= 6; d++) put(g, c + dx * d, c + dy * d, d === 6 ? 'M' : 'V');
    for (const dy of [-6, -7]) put(g, c, c + dy, dy === -6 ? 'A' : 'z');
    // eye: magenta socket, pale pupil
    for (let y = 7; y <= 11; y++) for (let x = 4; x <= 10; x++) {
        const d = Math.hypot(x - c, y - 9);
        if (d <= 2.7) g[y][x] = d <= 1.1 ? (hot ? 'w' : 'q') : (hot ? 'q' : 'M');
    }
    put(g, c, 9, 'w'); put(g, c - 1, 8, 'q');
    return rowsOf(outline(g, 'MqwAz'));
}

// ---- pylon: a bracket bolted to the ceiling, a steel column, an emitter cup with a magenta lens ----------------------------
function pylon(state) {   // 0 idle, 1 charging, 2 firing
    const W = 17, H = 24, c = 8, g = grid(W, H);
    // mounting bracket with amber hazard stripes
    for (let y = 0; y <= 3; y++) for (let x = 0; x < W; x++) g[y][x] = y === 3 ? '2' : y === 0 ? '5' : ((x + y) & 2 ? 'y' : 'a');
    for (let x = 0; x < W; x++) g[0][x] = '5';
    // column
    for (let y = 4; y <= 11; y++) { const hw = 3 - (y > 9 ? 1 : 0); for (let x = c - hw; x <= c + hw; x++) g[y][x] = ramp('2345', 0.35 + (c - x) / (2 * hw + 2)); }
    // emitter cup: a half-disc opening downward
    fill(g, (x, y) => y >= 12 && y <= 21 && Math.hypot(x - c, (y - 12) * 1.15) <= 7.4, (x, y) => ramp('2345', light(x - c, y - 14, 7)));
    // lens
    const lens = state === 0 ? ['p', 'm', 'M'] : state === 1 ? ['m', 'M', 'q'] : ['M', 'q', 'w'];
    for (let y = 14; y <= 21; y++) for (let x = 3; x <= 13; x++) {
        const d = Math.hypot(x - c, (y - 17.5) * 1.1);
        if (d <= 3.6) g[y][x] = d <= 1.4 ? lens[2] : d <= 2.6 ? lens[1] : lens[0];
    }
    // charge ticks on the cup rim
    if (state >= 1) for (const x of [c - 6, c + 6]) put(g, x, 15, state === 2 ? 'z' : 'A');
    // nozzle drip
    put(g, c, 22, state === 2 ? 'w' : state === 1 ? 'q' : 'm');
    return rowsOf(outline(g, 'MqwAz'));
}

// ---- warper: a violet crystal, facets lit from the upper left, a magenta core that flares when it fires ----------------
function warper(hot) {
    const S = 21, c = 10, g = grid(S, S);
    fill(g, (x, y) => Math.abs(x - c) / 8.6 + Math.abs(y - c) / 9.6 <= 1, (x, y) => {
        const dx = x - c, dy = y - c;
        // four facets meeting at the centre; the upper-left ones catch the light
        const facet = dx <= 0 && dy <= 0 ? 0.85 : dx > 0 && dy <= 0 ? 0.55 : dx <= 0 ? 0.4 : 0.15;
        return ramp('uvVx', facet + (Math.abs(dx) + Math.abs(dy) < 4 ? 0.1 : 0));
    });
    for (let i = -9; i <= 9; i++) if (i !== 0) { put(g, c + Math.round(i * 0.1), c + i, g[c + i]?.[c] === '.' ? '.' : (i < 0 ? 'x' : 'v')); }
    // core
    for (let y = 6; y <= 14; y++) for (let x = 6; x <= 14; x++) {
        const d = Math.abs(x - c) + Math.abs(y - c);
        if (d <= 3) g[y][x] = d <= 0 ? 'w' : d <= 1 ? (hot ? 'w' : 'q') : d <= 2 ? (hot ? 'q' : 'M') : (hot ? 'M' : 'm');
    }
    // tips glow while it is about to fire
    for (const [x, y] of [[c, 0], [c, S - 1], [1, c], [S - 2, c]]) put(g, x, y, hot ? 'q' : 'M');
    return rowsOf(outline(g, 'Mqw'));
}

export default [
    { key: 'enemy_strafer', fps: 6, frames: [strafer(false), strafer(true)] },
    { key: 'enemy_seeker', fps: 8, frames: [seeker(false), seeker(true)] },
    { key: 'enemy_pylon', frames: [pylon(0), pylon(1), pylon(2)] },   // 0 idle, 1 charging, 2 firing (set by code)
    { key: 'enemy_warper', frames: [warper(false), warper(true)] }    // 1 = flared, set by code
];
