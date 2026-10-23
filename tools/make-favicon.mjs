// Bakes the pixel-art favicon / touch icon / OG image from a text map in the game palette.
//   node tools/make-favicon.mjs   -> public/favicon.png (32), public/apple-touch-icon.png (180),
//   PWA icons public/icon-192.png, public/icon-512.png and public/icon-maskable-512.png (manifest.webmanifest)
import { PNG } from 'pngjs';
import fs from 'node:fs';
import { PALETTE } from '../src/art/palette.js';

// 15x15 four-point starburst: white-hot core, cyan arms, magenta diagonals (player vs hostile energy)
const STAR = [
    '.......w.......',
    '.......b.......',
    '.......C.......',
    '...m...C...m...',
    '....M..b..M....',
    '.....qcCcq.....',
    '......bwb......',
    'wbCCbCwwwCbCCbw',
    '......bwb......',
    '.....qcCcq.....',
    '....M..b..M....',
    '...m...C...m...',
    '.......C.......',
    '.......b.......',
    '.......w.......'
];
const rgb = (ch) => { const h = PALETTE[ch]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };

/**
 * size x size icon: dark chamfered tile (k fill, n rim) with the star scaled by an integer factor, centred.
 * maskable: full-bleed k square with the star inside the central 60% (Android crops maskable icons to any shape).
 */
function icon(size, w = size, h = size, tile = true, maskable = false) {
    const png = new PNG({ width: w, height: h });
    const s = maskable ? Math.floor((Math.min(w, h) * 0.6) / 15) : Math.floor(Math.min(w, h) / 16);
    const ox = Math.floor((w - 15 * s) / 2), oy = Math.floor((h - 15 * s) / 2);
    const [kr, kg, kb] = rgb('k'), [nr, ng, nb] = rgb('n');
    const cham = Math.max(1, s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
        const inside = maskable || !tile || dx + dy >= cham;
        const rim = tile && (dx < s || dy < s || dx + dy < cham + s);
        const [r, g, b] = rim ? [nr, ng, nb] : [kr, kg, kb];
        png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = inside ? 255 : 0;
    }
    STAR.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const [r, g, b] = rgb(ch);
        for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
            const i = ((oy + y * s + yy) * w + ox + x * s + xx) * 4;
            png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
        }
    }));
    return PNG.sync.write(png);
}

fs.writeFileSync('public/favicon.png', icon(32));
fs.writeFileSync('public/apple-touch-icon.png', icon(180));
fs.writeFileSync('public/icon-192.png', icon(192));
fs.writeFileSync('public/icon-512.png', icon(512));
fs.writeFileSync('public/icon-maskable-512.png', icon(512, 512, 512, false, true));
console.log('wrote public/favicon.png, public/apple-touch-icon.png, public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png');
