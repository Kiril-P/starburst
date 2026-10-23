// Shared headless-Chrome helpers for the tools (smoke, qa, shot, make-gif). puppeteer-core never downloads a browser,
// so we find an installed Chrome: explicit path, $CHROME_PATH (CI sets it), then the usual install locations.
import fs from 'node:fs';

const CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];

export function findChrome(explicit) {
    for (const p of [explicit, process.env.CHROME_PATH, ...CANDIDATES]) if (p && fs.existsSync(p)) return p;
    throw new Error('Chrome not found: pass --chrome PATH or set CHROME_PATH');
}

/** SwiftShader WebGL so rendering works without a GPU (identical output on laptops and CI runners) */
export function chromeArgs(w, h) {
    const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
        '--autoplay-policy=no-user-gesture-required', `--window-size=${w},${h}`];
    // GitHub's Linux runners can't use Chrome's user-namespace sandbox
    if (process.env.CI || process.platform === 'linux') args.push('--no-sandbox', '--disable-dev-shm-usage');
    return args;
}

/**
 * Runs in the page before any script (page.evaluateOnNewDocument(seedRandom, seed, clear)): replaces Math.random with a
 * seeded mulberry32 so spawns / patterns repeat run to run, and optionally starts from empty storage (first load only).
 */
export function seedRandom(seed, clear) {
    let s = seed >>> 0;
    Math.random = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    if (clear && !sessionStorage.getItem('__smokeInit')) {
        sessionStorage.setItem('__smokeInit', '1');
        localStorage.clear();
    }
}
