// Release-safety checks (npm run compliance, also run in CI). Fails (exit 1) if:
//   1. a binary audio/image/font/video file under public/ or src/ is not listed in docs/ASSETS.allowlist
//   2. a .DS_Store (or other OS junk) is tracked by git
//   3. a tracked text file matches a secret / credential / personal-path pattern
//   4. package.json lacks license / author / repository, or LICENSE / THIRD_PARTY_NOTICES.md are missing
//   5. dist/ (when present, or when --require-dist is passed) contains dev hooks (__dbg, __game), has no CSP, or ships
//      a binary audio file that is not allowlisted
// Usage: node tools/compliance.mjs [--require-dist]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const requireDist = process.argv.includes('--require-dist');
const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

const BINARY = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|mp3|wav|ogg|oga|m4a|aac|flac|opus|mp4|webm|mov|woff2?|ttf|otf|eot)$/i;
const slash = (p) => p.split(path.sep).join('/');
const walk = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [slash(p)];
});

// --- 1. binary asset allowlist -------------------------------------------------------------------------------------
const allowFile = 'docs/ASSETS.allowlist';
if (!fs.existsSync(allowFile)) fail(`${allowFile} is missing`);
const allow = new Set(fs.existsSync(allowFile)
    ? fs.readFileSync(allowFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : []);
for (const f of [...walk('public'), ...walk('src')]) {
    if (BINARY.test(f) && !allow.has(f)) fail(`binary asset not in ${allowFile}: ${f} (record source + licence in THIRD_PARTY_NOTICES.md first)`);
}
for (const f of allow) if (!fs.existsSync(f)) fail(`${allowFile} lists a missing file: ${f}`);

// --- 2 + 3. tracked files ------------------------------------------------------------------------------------------
const ls = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20 });
if (ls.status !== 0) {
    notes.push('not a git checkout: skipped tracked-file checks');
} else {
    const tracked = ls.stdout.split('\0').filter(Boolean).filter((f) => fs.existsSync(f));
    for (const f of tracked) {
        if (/(^|\/)(\.DS_Store|Thumbs\.db)$/.test(f)) fail(`OS junk file tracked by git: ${f}`);
        if (/(^|\/)\.env(\.|$)/.test(f) || /\.(pem|key|p12|pfx)$/i.test(f)) fail(`credential-like file tracked by git: ${f}`);
    }
    // built from pieces so this file does not match itself
    const SECRETS = [
        ['private key', new RegExp('-----BEGIN [A-Z ]*PRIV' + 'ATE KEY-----')],
        ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
        ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
        ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
        ['OpenAI/Anthropic style key', /\bsk-(ant-)?[A-Za-z0-9_-]{24,}/],
        ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
        ['generic credential assignment', /\b(api[_-]?key|secret|passw(or)?d|token|auth)\b["']?\s*[:=]\s*["'][A-Za-z0-9+/_=-]{16,}["']/i],
        ['personal absolute path', /(\/Users\/|\/home\/)[A-Za-z0-9._-]+\/|[A-Z]:\\Users\\[A-Za-z0-9._-]+\\/]
    ];
    const self = 'tools/compliance.mjs';
    for (const f of tracked) {
        if (f === self || f === 'package-lock.json' || BINARY.test(f) && !/\.svg$/i.test(f)) continue;
        let text;
        try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
        if (text.includes('\0')) continue;
        for (const [label, re] of SECRETS) {
            const m = re.exec(text);
            if (m) fail(`${label} in ${f}: ${m[0].slice(0, 40).replace(/[A-Za-z0-9+/_=-]{12,}$/, '…')}`);
        }
    }
}

// --- 4. metadata ---------------------------------------------------------------------------------------------------
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.license || /^unlicensed$/i.test(pkg.license)) fail('package.json has no "license"');
if (!pkg.author) fail('package.json has no "author"');
if (!pkg.repository) fail('package.json has no "repository"');
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'public/THIRD_PARTY_LICENSES.txt']) {
    if (!fs.existsSync(f)) fail(`${f} is missing`);
}

// --- 5. build output -----------------------------------------------------------------------------------------------
if (!fs.existsSync('dist')) {
    if (requireDist) fail('dist/ is missing: run `npm run build` first');
    else notes.push('dist/ not built: skipped build-output checks (CI runs them with --require-dist)');
} else {
    for (const f of walk('dist')) {
        if (/\.(m?js|html|css|map)$/.test(f)) {
            const t = fs.readFileSync(f, 'utf8');
            if (/__dbg|window\.__game|__meta\b/.test(t)) fail(`dev hook (__dbg / __game / __meta) shipped in ${f}`);
        }
        if (/\.(mp3|wav|ogg|m4a|flac|opus)$/i.test(f) && !allow.has(f.replace(/^dist\//, 'public/'))) fail(`audio file shipped in build: ${f}`);
    }
    const html = fs.existsSync('dist/index.html') ? fs.readFileSync('dist/index.html', 'utf8') : '';
    if (!/Content-Security-Policy/i.test(html)) fail('dist/index.html has no Content-Security-Policy meta');
    if (/https?:\/\/(?!kirilpetrovski\.com|kirilp\.itch\.io)[^"'\s<)]+/.test(html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/i, '').replace(/<meta\s+(?:property|name)="(?:og|twitter):[^>]*>/gi, '').replace(/xmlns="[^"]*"/g, ''))) {
        fail('dist/index.html references an external URL (itch.io HTML5 games must not make external requests)');
    }
    // the only network the build may be allowed to reach is the one https API origin from VITE_API_URL (docs/PRIVACY.md)
    const connect = (html.replace(/&#39;/g, "'").match(/connect-src([^;"]*)/i)?.[1] || '').trim().split(/\s+/).filter((s) => s && !/^('self'|data:|blob:)$/.test(s));
    if (connect.length > 1) fail(`CSP connect-src allows more than one external origin: ${connect.join(' ')}`);
    if (connect.some((o) => !o.startsWith('https://'))) fail(`CSP connect-src allows a non-https origin (${connect.join(' ')}): build with the production VITE_API_URL`);
    notes.push(connect.length ? `online build: the game may contact ${connect[0]} (boards + anonymous telemetry, docs/PRIVACY.md)` : 'offline build: no network origin allowed by the CSP');
}

for (const n of notes) console.log(`note: ${n}`);
if (problems.length) {
    console.error(`compliance: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
}
console.log('compliance: OK');
