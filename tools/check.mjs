// Static checks without a linter dependency (npm run check, also run in CI):
//   errors   : JS syntax of every src/ tools/ public/ script, sprite text maps (palette chars, ragged rows),
//              PWA manifest JSON + icon files
//   warnings : contract keys with no sprite (they render as placeholders), sprites missing from the contract,
//              code files over the 300-line guideline (sprite text maps are exempt)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SPRITE_MODULES } from '../src/art/index.js';
import { rasterize } from '../src/art/bake.js';
import { CONTRACT } from '../src/art/contract.js';

const errors = [], warnings = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.m?js$/.test(d.name) ? [p] : [];
});
const files = [...walk('src'), ...walk('tools'), ...walk('server'), 'public/sw.js'].filter((f) => fs.existsSync(f));

for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) errors.push(`syntax ${f}: ${r.stderr.split('\n').find((l) => l.includes('Error')) || r.stderr.trim()}`);
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    if (lines > 300 && f.startsWith('src') && !f.includes(path.join('art', 'sprites'))) warnings.push(`${f}: ${lines} lines (guideline < 300)`);
}

const baked = new Set();
for (const [mod, defs] of Object.entries(SPRITE_MODULES)) {
    for (const d of defs) {
        try { for (const s of rasterize(d)) baked.add(s.key); } catch (e) { errors.push(`sprite ${mod}: ${e.message}`); }
    }
}
for (const k of Object.keys(CONTRACT)) if (!baked.has(k)) warnings.push(`contract key '${k}' has no sprite (placeholder)`);
// variants (_amber, generated _hc/_cb) are covered by their base key's contract line
for (const k of baked) if (!(k in CONTRACT) && !Object.keys(CONTRACT).some((c) => k.startsWith(c + '_'))) warnings.push(`sprite '${k}' is not in contract.js`);

try {
    const m = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
    for (const i of m.icons) if (!fs.existsSync(path.join('public', i.src))) errors.push(`manifest icon missing: ${i.src}`);
} catch (e) { errors.push(`manifest: ${e.message}`); }

for (const w of warnings) console.log('warn  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`check: ${files.length} scripts, ${baked.size} sprites, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
