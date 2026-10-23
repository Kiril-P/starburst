// Procedural pixel art for the sector biomes' extra parallax layers (used by biomeLayers.js):
//   asteroid  bg_belt          far band of small dim rocks (tiles vertically)
//   station   bg_deck_far      dark hull slabs with window grids;  bg_deck_near  girder towers hugging the side edges
//   solar     bg_sun (5 frames) partial sun with dithered corona, frames 2-4 = a prominence flaring up;  bg_haze  heat lines
// Same rules as bgArt.js: palette colours only, ordered dither instead of gradients, deterministic seeds,
// tiles wrap seamlessly so they can scroll forever. Kept dark: these are backdrops, bullets must stay brightest.
import { W } from '../config.js';
import { TILE_H, LUT, canvasTexture, noise2, fbm, field } from './bgArt.js';
import { ditherLevel, rng, clamp01 } from './dither.js';

const wrapPut = (px, w, h) => (x, y, c) => { px[(((y % h) + h) % h) * w + (((x % w) + w) % w)] = LUT[c]; };

// ---- asteroid belt -------------------------------------------------------------------------------------------
export function beltTexture(scene) {
    return canvasTexture(scene, 'bg_belt', W, TILE_H, (px) => {
        const r = rng(611), n = noise2(613), put = wrapPut(px, W, TILE_H);
        const band = field(W, TILE_H, (u, v) => fbm(n, u, v, 3, 4, 3));   // rocks clump into drifting bands
        for (let i = 0; i < 2600; i++) {
            const x = (r() * W) | 0, y = (r() * TILE_H) | 0;
            const d = band(x, y);
            if (r() > (d - 0.42) * 3.5) continue;
            if (r() < 0.75) { put(x, y, r() < 0.6 ? '1' : '2'); continue; }          // dust speck
            const R = 1 + r() * r() * 6.5, lump = r() * 6.28;
            for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
                const a = Math.atan2(dy, dx), dd = Math.hypot(dx, dy) / (R * (0.85 + 0.2 * Math.cos(a * 3 + lump)));
                if (dd > 1) continue;
                const l = clamp01(0.5 - (dx + dy) / (2.4 * R) + (1 - dd) * 0.25);     // upper-left light
                put(x + dx, y + dy, ['k', '1', '2', '3'][ditherLevel(l, 3, x + dx, y + dy, 1)]);
            }
        }
    });
}

// ---- derelict station ----------------------------------------------------------------------------------------
export function deckFarTexture(scene) {
    return canvasTexture(scene, 'bg_deck_far', W, TILE_H, (px) => {
        const r = rng(701), put = wrapPut(px, W, TILE_H);
        for (let i = 0; i < 9; i++) {
            const w = 50 + ((r() * 160) | 0), h = 30 + ((r() * 150) | 0);
            // slabs favour the sides: the middle of the far layer stays mostly open space
            const x0 = r() < 0.5 ? ((r() * 140) | 0) - 60 : W - 80 - ((r() * 140) | 0), y0 = (r() * TILE_H) | 0;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const edgeL = x === 0 || y === 0, edgeR = x === w - 1 || y === h - 1;
                let c = edgeL ? '2' : edgeR ? 'k' : (x + y) % 2 ? '1' : 'k';
                if (!edgeL && !edgeR && x % 6 === 3 && y % 5 === 2) c = r() < 0.25 ? 'n' : r() < 0.04 ? 'c' : c;   // windows
                put(x0 + x, y0 + y, c);
            }
        }
        for (let i = 0; i < 4; i++) {   // long pipes running down the hull
            const x = (r() * W) | 0;
            for (let y = 0; y < TILE_H; y++) { put(x, y, '2'); put(x + 1, y, '1'); put(x + 2, y, 'k'); }
        }
    });
}

/** girder tower for one side: plated hull at the edge, an open truss lattice on its inner side */
function tower(put, r, side) {
    let w = 30;
    for (let y = 0; y < TILE_H; y++) {
        if (y % 64 === 0) w = 22 + ((r() * 40) | 0);
        const plate = w - 12;
        for (let i = 0; i < w; i++) {
            const x = side < 0 ? i : W - 1 - i;
            let c = null;
            if (i < plate) {
                const sy = y % 16;
                c = sy === 0 ? 'k' : sy === 1 ? '3' : i === plate - 1 ? (side < 0 ? 'k' : '4') : i === 0 ? '1' : '2';
                if (sy === 4 && i % 7 === 3) c = '3';                                      // rivets
                if (sy === 9 && i === (plate >> 1) && r() < 0.35) c = r() < 0.5 ? 'r' : 'a';   // dead-station lights
            } else {
                const j = i - plate;
                if (j === 0 || j === 10) c = j === 0 ? '1' : side < 0 ? '3' : '2';          // rails
                else if (j < 10 && ((y + j) % 12 === 0 || (y - j + 120) % 12 === 0)) c = '2'; // X bracing
                else if (j === 11) c = 'k';
            }
            if (c) put(x, y, c);
        }
    }
}

export function deckNearTexture(scene) {
    return canvasTexture(scene, 'bg_deck_near', W, TILE_H, (px) => {
        const r = rng(733), put = wrapPut(px, W, TILE_H);
        tower(put, r, -1);
        tower(put, r, 1);
        // one dim cross girder per tile, so the deck visibly scrolls past behind the action
        const gy = 300;
        for (let x = 0; x < W; x++) {
            put(x, gy, '2'); put(x, gy + 5, '1');
            for (let k = 1; k < 5; k++) if ((x + k * 3) % 12 === 0 || (x - k * 3 + 120) % 12 === 0) put(x, gy + k, '1');
        }
    });
}

// ---- solar storm ---------------------------------------------------------------------------------------------
export const SUN = 200, SUN_R = 74, SUN_FRAMES = 5;

export function sunTexture(scene) {
    const key = 'bg_sun';
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, SUN * SUN_FRAMES, SUN);
    const img = tex.context.createImageData(SUN * SUN_FRAMES, SUN), px = new Uint32Array(img.data.buffer);
    const n = noise2(831), c = (SUN - 1) / 2, TW = SUN * SUN_FRAMES;
    const flareH = [0, 0, 10, 22, 18];
    const fa = Math.PI * 1.1;                      // prominence site: the visible (left) limb, a little above centre
    for (let f = 0; f < SUN_FRAMES; f++) {
        for (let y = 0; y < SUN; y++) for (let x = 0; x < SUN; x++) {
            const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            let ch = null;
            if (d < SUN_R) {
                // limb darkening + granulation; the core is amber, white-hot only in small cells
                const g = fbm(n, x / SUN, y / SUN, 12, 12, 3);
                const v = 0.35 + 0.5 * Math.sqrt(1 - (d / SUN_R) ** 2) + (g - 0.5) * 0.5;
                ch = ['y', 'a', 'A', 'z'][ditherLevel(v, 3, x, y, 1)];
            } else {
                // corona: flickering tongues, a different phase per frame so the edge shimmers
                const u = (a / (Math.PI * 2) + 1) % 1;
                const tongue = fbm(n, u, f * 0.21 + 0.13, 16, 5, 3);
                const k = clamp01(1 - (d - SUN_R) / (6 + tongue * 18));
                const lv = ditherLevel(k * k * 1.4, 2, x, y);
                if (lv) ch = lv === 2 ? 'a' : 'y';
                // prominence: a hot loop rising off the limb
                const h = flareH[f];
                if (h) {
                    const da = Math.atan2(Math.sin(a - fa), Math.cos(a - fa)) * SUN_R;    // arc distance along the limb
                    const lx = da / 12, ly = (d - SUN_R) / h;                               // loop: ellipse of half-width 12
                    const e = Math.abs(Math.hypot(lx, ly) - 1);
                    if (ly > 0 && e < 0.16) ch = f === 4 && (x + y) & 1 ? 'a' : e < 0.07 ? 'z' : 'A';
                }
            }
            if (ch) px[y * TW + f * SUN + x] = LUT[ch];
        }
    }
    tex.context.putImageData(img, 0, 0);
    tex.refresh();
    for (let f = 0; f < SUN_FRAMES; f++) tex.add(f, 0, f * SUN, 0, SUN, SUN);
    return key;
}

export const HAZE_H = 96;
/** wavy dashed heat lines, drawn ADD over the backdrop at low alpha and wobbled sideways */
export function hazeTexture(scene) {
    return canvasTexture(scene, 'bg_haze', W, HAZE_H, (px) => {
        const put = wrapPut(px, W, HAZE_H);
        for (let k = 0; k < 6; k++) {
            const y0 = 8 + k * 16;
            for (let x = 0; x < W; x++) {
                if (Math.sin(x * 0.017 + k * 1.7) + Math.sin(x * 0.043 + k) < 0.9 || (x + k) & 1) continue;   // short dithered dashes
                put(x, y0 + Math.round(Math.sin(x * 0.06 + k) * 2), 'y');
            }
        }
    });
}
