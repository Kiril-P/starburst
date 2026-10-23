// Renders sprite definitions to PNG contact sheets so you can LOOK at your pixel art.
//   node tools/render-sprites.mjs [module ...] [--scale 8] [--out tmp/sprites]
// Output per module: <out>/<module>.big.png (scaled up, labelled order printed to stdout) and <out>/<module>.actual.png (2x = on-screen size)
// Validation errors (bad palette chars, ragged rows) are printed and exit non-zero.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { SPRITE_MODULES } from '../src/art/index.js';
import { rasterize } from '../src/art/bake.js';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const scale = parseInt(opt('--scale', '8'), 10);
const outDir = opt('--out', 'tmp/sprites');
const mods = args.length ? args : Object.keys(SPRITE_MODULES);
fs.mkdirSync(outDir, { recursive: true });

const BG_A = [18, 22, 43], BG_B = [24, 29, 54];

function sheet(sprites, s, maxW) {
    const pad = 4 * s / 2, items = [];
    // each sprite = row of its frames; flow left-to-right, wrap at maxW
    let x = pad, y = pad, rowH = 0, W = 0;
    for (const spr of sprites) {
        const w = spr.w * spr.frames.length * s + (spr.frames.length - 1) * pad / 2, h = spr.h * s;
        if (x + w + pad > maxW && x > pad) { x = pad; y += rowH + pad; rowH = 0; }
        items.push({ spr, x, y });
        x += w + pad; rowH = Math.max(rowH, h); W = Math.max(W, x);
    }
    const H = y + rowH + pad;
    const png = new PNG({ width: Math.max(W, 8), height: Math.max(H, 8) });
    for (let j = 0; j < png.height; j++) for (let i = 0; i < png.width; i++) {
        const c = ((i >> 4) + (j >> 4)) & 1 ? BG_A : BG_B, o = (j * png.width + i) * 4;
        png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
    }
    for (const { spr, x, y } of items) spr.frames.forEach((px, f) => {
        const ox = x + f * (spr.w * s + pad / 2);
        for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) {
            const si = (j * spr.w + i) * 4; if (!px[si + 3]) continue;
            for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
                const o = ((y + j * s + dy) * png.width + ox + i * s + dx) * 4;
                png.data[o] = px[si]; png.data[o + 1] = px[si + 1]; png.data[o + 2] = px[si + 2]; png.data[o + 3] = 255;
            }
        }
    });
    return PNG.sync.write(png);
}

let failed = false;
for (const m of mods) {
    const defs = SPRITE_MODULES[m];
    if (!defs) { console.error(`unknown module '${m}'. have: ${Object.keys(SPRITE_MODULES).join(', ')}`); failed = true; continue; }
    const sprites = [];
    for (const d of defs) {
        try { sprites.push(...rasterize(d)); } catch (e) { console.error('ERROR', e.message); failed = true; }
    }
    if (!sprites.length) { console.log(`${m}: (no sprites)`); continue; }
    fs.writeFileSync(path.join(outDir, `${m}.big.png`), sheet(sprites, scale, 1400));
    fs.writeFileSync(path.join(outDir, `${m}.actual.png`), sheet(sprites, 2, 1400));
    console.log(`${m}: ${sprites.length} sprites -> ${outDir}/${m}.big.png | ${m}.actual.png`);
    console.log('  order: ' + sprites.map((s) => `${s.key}(${s.w}x${s.h}${s.frames.length > 1 ? 'x' + s.frames.length : ''})`).join('  '));
}
process.exit(failed ? 1 : 0);
