// Turns text-map sprite definitions into Phaser textures at 1:1 pixel scale.
//
// A definition looks like:
//   { key: 'ship_normal', frames: [rows, rows], sym: 'odd', fps: 10, variants: { amber: { M: 'A', m: 'a' } } }
// - rows: array of equal-length strings, one char per pixel (see palette.js, '.' = transparent)
// - sym: 'even' mirrors every row horizontally (author the LEFT half); 'odd' mirrors but shares the centre column
// - frames > 1 makes a spritesheet and (when fps is set) an animation under the same key
// - variants: extra textures named `${key}_${variantName}` produced by swapping palette chars
import { PALETTE } from './palette.js';

export function expandRows(rows, sym) {
    if (!sym) return rows;
    return rows.map((r) => {
        const left = r;
        const right = [...(sym === 'odd' ? left.slice(0, -1) : left)].reverse().join('');
        return left + right;
    });
}

export function validate(def) {
    const frames = def.frames || [def.rows];
    const w = expandRows(frames[0], def.sym)[0].length;
    const h = frames[0].length;
    for (const [fi, rows] of frames.entries()) {
        if (rows.length !== h) throw new Error(`${def.key} frame ${fi}: expected ${h} rows, got ${rows.length}`);
        for (const [ri, row] of expandRows(rows, def.sym).entries()) {
            if (row.length !== w) throw new Error(`${def.key} frame ${fi} row ${ri}: width ${row.length}, expected ${w}`);
            for (const ch of row) if (!(ch in PALETTE)) throw new Error(`${def.key} frame ${fi} row ${ri}: unknown palette char '${ch}'`);
        }
    }
    return { w, h, n: frames.length };
}

// Returns a list of { key, w, h, frames: [Uint8ClampedArray rgba...] } -- shared by the game and tools/render-sprites.mjs
export function rasterize(def) {
    const { w, h } = validate(def);
    const out = [];
    const make = (key, swap) => {
        const frames = (def.frames || [def.rows]).map((rows) => {
            const px = new Uint8ClampedArray(w * h * 4);
            expandRows(rows, def.sym).forEach((row, y) => {
                [...row].forEach((ch, x) => {
                    const c = PALETTE[swap && swap[ch] ? swap[ch] : ch];
                    if (!c) return;
                    const i = (y * w + x) * 4;
                    px[i] = parseInt(c.slice(1, 3), 16);
                    px[i + 1] = parseInt(c.slice(3, 5), 16);
                    px[i + 2] = parseInt(c.slice(5, 7), 16);
                    px[i + 3] = 255;
                });
            });
            return px;
        });
        out.push({ key, w, h, frames, fps: def.fps, repeat: def.repeat });
    };
    make(def.key, null);
    for (const [name, swap] of Object.entries(def.variants || {})) make(`${def.key}_${name}`, swap);
    return out;
}

export function bakeAll(scene, defs) {
    const { textures, anims } = scene;
    for (const def of defs) {
        for (const spr of rasterize(def)) {
            if (textures.exists(spr.key)) continue;
            const n = spr.frames.length;
            const canvas = textures.createCanvas(spr.key, spr.w * n, spr.h);
            const ctx = canvas.context;
            spr.frames.forEach((px, i) => ctx.putImageData(new ImageData(px, spr.w, spr.h), i * spr.w, 0));
            canvas.refresh();
            if (n > 1) {
                for (let i = 0; i < n; i++) canvas.add(i, 0, i * spr.w, 0, spr.w, spr.h);
                if (spr.fps) {
                    anims.create({
                        key: spr.key,
                        frames: Array.from({ length: n }, (_, i) => ({ key: spr.key, frame: i })),
                        frameRate: spr.fps,
                        repeat: spr.repeat ?? -1
                    });
                }
            }
        }
    }
}
