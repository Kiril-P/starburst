// Headless screenshot of the running game (dev server must be up: npm run dev -- --port N).
//   node tools/shot.mjs --url http://localhost:5173 --out tmp/shot.png [--wait 1500] [--eval "__game.scene.start('Game')"] [--then-wait 2000] [--size 1280x720]
// --eval runs in the page after load (use window.__game); --then-wait is how long to wait after eval before the screenshot.
// Multiple shots: repeat --eval/--then-wait/--out triples is not supported; call the tool several times, or use --seq "ms:js:file;ms:js:file".
// Prints page console errors so you notice runtime exceptions.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome, chromeArgs } from './lib/browser.mjs';

const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const url = get('--url', 'http://localhost:5173');
const out = get('--out', 'tmp/shot.png');
const wait = parseInt(get('--wait', '1500'), 10);
const js = get('--eval', '');
const thenWait = parseInt(get('--then-wait', '1500'), 10);
const [vw, vh] = get('--size', '1280x720').split('x').map(Number);

const browser = await puppeteer.launch({
    executablePath: findChrome(), headless: 'new', args: chromeArgs(vw, vh)
});
const page = await browser.newPage();
await page.setViewport({ width: vw, height: vh });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error ' + m.text()); });
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, wait));
const run = async (code, ms, file) => {
    if (code) { try { await page.evaluate(code); } catch (e) { errors.push('EVAL ' + e.message); } }
    await new Promise((r) => setTimeout(r, ms));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
    console.log('saved', file);
};
const seq = get('--seq', '');
if (seq) { for (const s of seq.split(';;')) { const [ms, code, file] = s.split('::'); await run(code, parseInt(ms, 10), file); } }
else await run(js, thenWait, out);
if (errors.length) console.log('--- errors ---\n' + [...new Set(errors)].join('\n'));
await browser.close();
