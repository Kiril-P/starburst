// Boss expansion art: four mid-bosses, THE TEMPEST, THE COLOSSUS, THE STARBURST (final) and the gravity well.
// Same rules as bosses.js (face DOWN, steel hulls + violet armour, magenta = hostile energy, k outline, right
// half one step darker) but blocked out with the shape kit in bossKit.js instead of typed maps (see why there).
import { Px, RAMP, ellipse, rect, ring, poly, mpoly, union, minus, mirror, swap, PULSE, DEG } from './bossKit.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const finish = (p) => p.outline().lit().rows();

// ---- LANCER (64x50): arrowhead interceptor, swept wings with gun prongs, lance emitter in the nose ----------
function lancer() {
    const p = new Px(64, 50), cx = 32;
    p.plate(mirror(cx, poly([[3, 5], [10, 2], [25, 12], [25, 30], [16, 27], [8, 17]])), RAMP.hull);
    p.plate(mirror(cx, poly([[8, 15], [13, 18], [13, 34], [10, 40], [7, 32]])), RAMP.steel);
    p.plate(mirror(cx, poly([[11, 8], [22, 14], [22, 24], [15, 20]])), RAMP.violet, { bevel: 1 });
    p.plate(mpoly(cx, [[27, 1], [25, 10], [23, 28], [28, 43], [32, 49]]), RAMP.steel);
    p.plate(mpoly(cx, [[29, 14], [27, 22], [29, 33], [32, 36]]), RAMP.violet, { bevel: 1 });
    p.glow(cx, 24, 2.6, undefined, 5);
    p.glow(cx, 44, 2.2);
    for (const x of [27, 36]) p.glow(x + 0.5, 2.5, 2, ['m', 'M', 'q']);
    for (const s of [0, 1]) { const x = s ? 64 - 10.5 : 10.5; p.glow(x, 37, 1.6, ['m', 'M', 'q']); }
    p.line(25, 31, 30, 40, '2').line(38, 31, 33, 40, '2');
    return finish(p);
}

// ---- GYRE (60x60): saw-toothed disc; 4 frames step the teeth round so it spins without runtime rotation -----
function gyre(rot) {
    const p = new Px(60, 60), c = 30;
    const teeth = (x, y) => {
        const d = Math.hypot(x - c, y - c);
        if (d < 19 || d > 29) return false;
        const a = Math.atan2(y - c, x - c);
        const k = Math.round((a - rot) / (TAU / 8));
        const da = angDiff(a, rot + (k * TAU) / 8) / DEG;
        return da > -12 + (d - 19) * 0.4 && da < 6 - (d - 19) * 0.9;   // hooked (saw) teeth
    };
    p.plate(teeth, RAMP.steel, { bevel: 1 });
    p.plate(ellipse(c, c, 22, 22), RAMP.hull);
    p.plate(ring(c, c, 11, 17), RAMP.violet, { bevel: 1 });
    for (let k = 0; k < 8; k++) { const a = rot + ((k + 0.5) * TAU) / 8; p.set(Math.round(c + Math.cos(a) * 19.5 - 0.5), Math.round(c + Math.sin(a) * 19.5 - 0.5), '6'); }
    p.fill(ring(c, c, 9, 10.5), 'k');
    p.glow(c, c, 8.5);
    p.fill(rect(29, 25, 2, 10), 'p');      // slit pupil
    return finish(p);
}

// ---- BASTION (76x50): siege platform; three mortar tubes on a violet dome, beam lens in front ----------------
function bastion() {
    const p = new Px(76, 50), cx = 38;
    p.plate(mirror(cx, rect(0, 14, 11, 28)), RAMP.steel);
    for (let y = 17; y < 40; y += 4) p.fill(mirror(cx, rect(2, y, 7, 1)), '1');
    p.plate(mpoly(cx, [[16, 8], [8, 18], [7, 34], [14, 44], [28, 48], [38, 48]]), RAMP.hull);
    p.plate(mirror(cx, rect(27, 3, 5, 12)), RAMP.steel, { bevel: 1 });
    p.plate(rect(36, 1, 4, 14), RAMP.steel, { bevel: 1 });
    p.plate(ellipse(cx, 18, 16, 11), RAMP.violet);
    for (const x of [29.5, 38, 46.5]) p.glow(x, x === 38 ? 2.5 : 4.5, 1.6, ['m', 'M', 'q']);
    p.plate(mpoly(cx, [[28, 30], [24, 38], [30, 45], [38, 46]]), RAMP.steel, { bevel: 1 });
    p.glow(cx, 38, 6, undefined, 4);
    p.fill(mirror(cx, rect(12, 26, 6, 2)), 'a');            // amber hazard lights on the deck
    p.fill(mirror(cx, rect(13, 26, 2, 2)), 'A');
    return finish(p);
}

// ---- MANTA (80x44): violet ray that blinks across the screen; wing lights along the trailing edge -----------
function manta() {
    const p = new Px(80, 44), cx = 40;
    p.plate(mpoly(cx, [[38, 4], [22, 7], [9, 15], [1, 27], [10, 30], [24, 33], [33, 39], [40, 41]]), RAMP.violet);
    p.plate(mirror(cx, poly([[31, 34], [29, 43], [35, 39]])), RAMP.violet, { bevel: 1 });
    p.plate(rect(39, 0, 2, 10), RAMP.steel, { bevel: 1 });
    p.plate(ellipse(cx, 20, 9, 15), RAMP.steel);
    p.plate(ellipse(cx, 22, 5, 9), RAMP.violet, { bevel: 1 });
    p.glow(cx, 22, 4, undefined, 6);
    for (const [x, y] of [[8, 26], [15, 23], [22, 19], [30, 31]]) p.glow(x + 0.5, y + 0.5, 1.5, ['m', 'M', 'q']).glow(80 - x - 0.5, y + 0.5, 1.5, ['m', 'M', 'q']);
    p.line(12, 18, 30, 12, 'x').line(67, 18, 49, 12, 'x');
    return finish(p);
}

// ---- TEMPEST (112x64): the Siren; crescent wing arc ending in beam emitters, spiral storm eye ---------------
function tempest(rot) {
    const p = new Px(112, 64), cx = 56;
    const arc = minus(ellipse(cx, 12, 55, 46), ellipse(cx, 2, 45, 44));
    p.plate((x, y) => arc(x, y) && y < 54, RAMP.steel);
    for (const s of [-1, 1]) p.plate(ellipse(cx + s * 47, 46, 7, 9), RAMP.hull);
    p.plate(mpoly(cx, [[52, 0], [44, 8], [36, 24], [40, 44], [50, 56], [56, 60]]), RAMP.hull);
    p.plate(ellipse(cx, 28, 15, 15), RAMP.violet);
    // storm eye: two magenta spiral arms (frames advance the spiral)
    p.each(ellipse(cx, 28, 13, 13), (x, y) => {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 28), a = Math.atan2(y + 0.5 - 28, x + 0.5 - cx);
        const s = Math.cos(2 * (a - rot) + d * 0.5);
        if (s > 0.55) p.set(x, y, d < 6 ? 'M' : 'm');
        else if (s > 0.2 && (x + y) % 2 === 0) p.set(x, y, 'p');
    });
    p.glow(cx, 28, 4);
    for (const s of [-1, 1]) p.glow(cx + s * 47, 49, 4, undefined, 5);
    p.fill(mirror(cx, rect(46, 50, 3, 6)), 'm');
    return finish(p);
}

// ---- COLOSSUS (128x76) hull with core socket + 4 plate sockets; core and plates are separate parts ---------
export const COLOSSUS_PLATES = [[-34, -12], [34, -12], [-34, 16], [34, 16]];   // plate centres relative to hull centre
function colossus() {
    const p = new Px(128, 76), cx = 64;
    p.plate(mpoly(cx, [[38, 2], [18, 10], [6, 22], [2, 40], [8, 58], [24, 70], [46, 75], [64, 75]]), RAMP.hull);
    for (const x of [18, 32]) p.plate(mirror(cx, rect(x, 0, 8, 10)), RAMP.steel, { bevel: 1 });
    p.plate(ellipse(cx, 38, 24, 22), RAMP.violet);
    p.fill(ellipse(cx, 38, 16, 16), 'k');
    p.fill(ellipse(cx, 38, 15, 15), 'u');
    for (const [dx, dy] of COLOSSUS_PLATES) {
        p.fill(rect(cx + dx - 16, 38 + dy - 11, 32, 22), 'k');
        p.fill(rect(cx + dx - 15, 38 + dy - 10, 30, 20), 'u');
        for (let y = 38 + dy - 8; y < 38 + dy + 9; y += 3) p.fill(rect(cx + dx - 12, y, 24, 1), 'v');   // exposed ribs
    }
    for (const x of [21, 35]) p.glow(x + 0.5, 3.5, 1.5, ['m', 'M', 'q']).glow(128 - x - 0.5, 3.5, 1.5, ['m', 'M', 'q']);
    p.fill(mirror(cx, rect(56, 64, 3, 6)), 'm');
    // panel seams + rivets so the big hull doesn't read as one flat slab
    p.fill(mirror(cx, rect(8, 50, 6, 1)), '2').fill(mirror(cx, rect(14, 64, 14, 1)), '2').fill(mirror(cx, rect(44, 10, 1, 6)), '2');
    for (const [x, y] of [[12, 20], [6, 34], [8, 46], [16, 60], [40, 70], [52, 14], [40, 64]]) p.set(x, y, '6').set(127 - x, y, '5');
    p.fill(mirror(cx, rect(50, 2, 4, 3)), '1');
    return finish(p);
}
function colossusCore(f) {
    const p = new Px(30, 30), c = 15;
    p.plate(ellipse(c, c, 14, 14), RAMP.steel, { bevel: 1 });
    if (f === 0) {           // shut: four armoured iris leaves
        p.plate(ellipse(c, c, 11, 11), RAMP.hull);
        p.fill(rect(14, 4, 2, 22), '1').fill(rect(4, 14, 22, 2), '1');
        p.glow(c, c, 2, ['p', 'm']);
    } else if (f === 3) p.glow(c, c, 12, ['m', 'M', 'q', 'w', 'w']);
    else { p.glow(c, c, 11.5); if (f === 2) p.fill(ellipse(c, c, 6, 6), 'q'); p.fill(rect(14, 9, 2, 12), 'p'); }
    return finish(p);
}
function colossusPlate(cracked) {
    const p = new Px(30, 20);
    p.plate(poly([[2, 0], [28, 0], [30, 2], [30, 18], [28, 20], [2, 20], [0, 18], [0, 2]]), RAMP.steel);
    p.plate(rect(4, 4, 22, 6), RAMP.violet, { bevel: 1 });
    p.glow(15, 15, 2.2, cracked ? ['r', 'R', 'w'] : ['m', 'M', 'q']);
    for (const x of [3, 26]) p.set(x, 15, '6');
    if (cracked) { p.line(6, 2, 11, 9, 'k').line(11, 9, 9, 17, 'k').line(21, 3, 18, 11, 'k').line(18, 11, 24, 18, 'k'); p.set(11, 9, 'R').set(18, 11, 'r'); }
    return finish(p);
}

// ---- THE STARBURST (104x104): eight crystal rays round a white-hot eye. 0 idle, 1 pulse, 2 supernova ----------
function starburst(nova) {
    const p = new Px(104, 104), c = 52;
    const rayP = (len, w0) => (x, y) => {
        const d = Math.hypot(x - c, y - c), a = Math.atan2(y - c, x - c);
        if (d > len) return false;
        const k = Math.round(a / (TAU / 4)), da = Math.abs(angDiff(a, (k * TAU) / 4)) * d;
        return da < w0 * (1 - d / len) + 0.6;
    };
    const diag = (len, w0) => (x, y) => rayP(len, w0)(c + ((x - c) + (y - c)) * Math.SQRT1_2, c + ((y - c) - (x - c)) * Math.SQRT1_2);
    p.plate(diag(42, 14), RAMP.hull);
    p.plate(rayP(52, 19), RAMP.steel);
    // crystal cores down each ray
    p.plate(union(rayP(49, 6), diag(38, 4)), nova ? RAMP.amber : RAMP.magenta, { bevel: 1 });
    p.plate(ellipse(c, c, 26, 26), RAMP.hull);
    p.plate(ring(c, c, 17, 23), RAMP.violet, { bevel: 1 });
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) * (TAU / 8); p.glow(c + Math.cos(a) * 20, c + Math.sin(a) * 20, 1.5, ['m', 'M', 'q']); }
    p.fill(ring(c, c, 15, 16.5), 'k');
    if (nova) p.glow(c, c, 15, ['M', 'q', 'w', 'w']);
    else { p.glow(c, c, 14.5); p.fill(ellipse(c, c, 3, 7), 'p'); }
    return finish(p);
}
function starNode() {
    const p = new Px(18, 18), c = 9;
    p.plate(union(poly([[9, 0], [12, 9], [9, 18], [6, 9]]), poly([[0, 9], [9, 6], [18, 9], [9, 12]])), RAMP.magenta, { bevel: 1 });
    p.plate(ellipse(c, c, 4, 4), RAMP.steel, { bevel: 1 });
    p.glow(c, c, 2, ['M', 'q', 'w']);
    return finish(p);
}

// ---- gravity well (33x33): dithered violet vortex round a dark core with a hot magenta event horizon ---------
function well(rot) {
    const p = new Px(33, 33), c = 16.5;
    p.each(ellipse(c, c, 16, 16), (x, y) => {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c), a = Math.atan2(y + 0.5 - c, x + 0.5 - c);
        const s = Math.cos(3 * (a + rot) + d * 0.42);
        if (d < 4) p.set(x, y, 'k');
        else if (d < 5.6) p.set(x, y, (x + y) & 1 ? 'q' : 'M');
        else if (s > 0.5) p.set(x, y, d < 9 ? 'm' : d < 13 ? 'V' : 'v');
        else if (s > -0.1 && (x + y) % 2 === 0) p.set(x, y, d < 11 ? 'V' : 'u');
    });
    return p.rows();
}

const frames = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const LANCER = lancer(), BASTION = bastion(), MANTA = manta(), COLOSSUS = colossus(), STAR = starburst(false), NODE = starNode();

export default [
    { key: 'boss_lancer', fps: 6, frames: [LANCER, swap(LANCER, PULSE)] },
    { key: 'boss_gyre', fps: 12, frames: frames(4, (i) => gyre((i * TAU) / 32)) },
    { key: 'boss_bastion', fps: 5, frames: [BASTION, swap(BASTION, PULSE)] },
    { key: 'boss_manta', fps: 6, frames: [MANTA, swap(MANTA, PULSE)] },
    { key: 'boss_tempest', fps: 8, frames: frames(4, (i) => tempest((i * Math.PI) / 4)) },
    { key: 'boss_colossus', fps: 4, frames: [COLOSSUS, swap(COLOSSUS, PULSE)] },
    { key: 'boss_colossus_core', frames: frames(4, colossusCore) },      // 0 shut, 1 open, 2 open pulse, 3 overload
    { key: 'boss_colossus_plate', frames: [colossusPlate(false), colossusPlate(true)] },   // 0 intact, 1 cracked
    { key: 'boss_starburst', frames: [STAR, swap(STAR, PULSE), starburst(true)] },        // 0 idle, 1 pulse, 2 supernova
    { key: 'boss_star_node', fps: 8, frames: [NODE, swap(NODE, { M: 'q', q: 'w' })] },
    { key: 'boss_well', fps: 10, frames: frames(4, (i) => well((i * TAU) / 12)) }
];
