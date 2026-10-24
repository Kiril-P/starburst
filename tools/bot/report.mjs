// Summarise tools/bot.mjs results as markdown tables (pasted into docs/BALANCE.md).
//   node tools/bot/report.mjs tmp/bot/run.jsonl [more.jsonl ...] [--hits] [--waves]
import fs from 'node:fs';

const a = process.argv.slice(2);
const files = a.filter((x) => !x.startsWith('--'));
const all = files.flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
// crashed runs (harness problems: page failed to load, watchdog) carry no game data; they are listed at the end
const runs = all.filter((r) => r.result !== 'crash');
const by = (xs, f) => xs.reduce((m, x) => { const k = f(x); (m[k] ??= []).push(x); return m; }, {});
const med = (xs) => { if (!xs.length) return '-'; const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
const mean = (xs) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : 0);
const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '-');
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
// a run "reached" the wave it died on; a victory means wave 20 was beaten
const reached = (r) => (r.result === 'victory' ? 21 : r.wave);
const ORDER = { easy: 0, normal: 1, hard: 2, casual: 0, skilled: 1, oracle: 2 };
const sortKeys = (ks) => ks.sort((p, q) => p.split(' ').map((x) => ORDER[x] ?? 9).join() < q.split(' ').map((x) => ORDER[x] ?? 9).join() ? -1 : 1);

console.log(`### Runs (${runs.length})\n`);
const groups = by(runs, (r) => `${r.diff} ${r.profile}`);
console.log(table(['difficulty / bot', 'runs', 'median wave', 'mean', 'min-max', 'beat w5 boss', 'reached w10', 'reached w20', 'beat final', 'soft-locks', 'errors'],
    sortKeys(Object.keys(groups)).map((k) => {
        const g = groups[k], w = g.map(reached);
        const wonFinal = g.filter((r) => r.result === 'victory' || (r.bosses || []).some((b) => b.kind === 'final' && b.result === 'killed')).length;
        const finalTries = g.filter((r) => (r.bosses || []).some((b) => b.kind === 'final')).length;
        return [k, g.length, med(w), mean(w).toFixed(1), `${Math.min(...w)}-${Math.max(...w)}`, pct(g.filter((r) => reached(r) > 5).length, g.length),
            pct(g.filter((r) => reached(r) >= 10).length, g.length), pct(g.filter((r) => reached(r) >= 20).length, g.length),
            `${wonFinal}/${finalTries}`, g.filter((r) => r.result === 'softlock' || r.result === 'timeout').length, g.reduce((n, r) => n + (r.errors?.length || 0), 0)];
    })));

console.log('\n### Median wave reached per ship\n');
const ships = ['normal', 'speedy', 'tank'];
console.log(table(['difficulty / bot', ...ships], sortKeys(Object.keys(groups)).map((k) => [k, ...ships.map((s) => med(groups[k].filter((r) => r.ship === s).map(reached)))])));

console.log('\n### Boss fights (kills only: median s [min-max], kill rate)\n');
const fights = runs.flatMap((r) => (r.bosses || []).map((b) => ({ ...b, diff: r.diff, profile: r.profile })));
const bf = by(fights, (b) => `${b.kind} ${b.id}`);
console.log(table(['boss', 'fights', 'killed', 'median s', 'range s', 'dmg taken (median)', 'deaths in fight'],
    Object.keys(bf).sort().map((k) => {
        const f = bf[k], kills = f.filter((b) => b.result === 'killed'), s = kills.map((b) => Math.round(b.ms / 1000));
        return [k, f.length, pct(kills.length, f.length), med(s), s.length ? `${Math.min(...s)}-${Math.max(...s)}` : '-', med(f.map((b) => b.dmg)), f.filter((b) => b.result === 'died').length];
    })));

console.log('\n### Death causes (top 15)\n');
const deaths = runs.filter((r) => r.death);
const dc = by(deaths, (r) => r.death.src.replace(/\/p\d+\//, '/'));
console.log(table(['killed by', 'deaths', 'waves'], Object.entries(dc).sort((p, q) => q[1].length - p[1].length).slice(0, 15)
    .map(([k, v]) => [k, v.length, [...new Set(v.map((r) => r.wave))].sort((p, q) => p - q).join(',')])));

console.log('\n### Damage sources (all hits, top 20)\n');
const hits = runs.flatMap((r) => r.hits || []);
const hs = by(hits, (h) => h.src.replace(/\/p\d+\//, '/'));
console.log(table(['source', 'hits', 'share', 'point-blank (<250ms, <40px)', 'median bullet age ms'], Object.entries(hs).sort((p, q) => q[1].length - p[1].length).slice(0, 20)
    .map(([k, v]) => [k, v.length, pct(v.length, hits.length), v.filter((h) => h.age < 250 && h.sd < 40).length, med(v.map((h) => h.age))])));

if (a.includes('--waves')) {
    console.log('\n### Per wave (all runs that played it): median time s, mean damage, mean hits, max bullets, deaths\n');
    const rows = [];
    for (let w = 1; w <= 21; w++) {
        const ws = runs.map((r) => r.waves?.[w]).filter(Boolean);
        if (!ws.length) continue;
        const dead = runs.filter((r) => r.result === 'died' && r.wave === w).length;
        rows.push([w, ws.length, med(ws.map((x) => Math.round(x.ms / 1000))), mean(ws.map((x) => x.dmg)).toFixed(0), mean(ws.map((x) => x.hits)).toFixed(1),
            Math.max(...ws.map((x) => x.maxBullets)), Math.round(mean(ws.map((x) => x.avgBullets))), Math.max(...ws.map((x) => x.maxEnemies)), pct(dead, ws.length)]);
    }
    console.log(table(['wave', 'runs', 'time s', 'dmg', 'hits', 'max bullets', 'avg bullets', 'max enemies', 'died here'], rows));
}

console.log('\n### Upgrades taken / pickups / abilities (per run means)\n');
const took = by(runs.flatMap((r) => r.picks || []), (p) => p.took);
console.log('picks: ' + Object.entries(took).sort((p, q) => q[1].length - p[1].length).map(([k, v]) => `${k} ${v.length}`).join(', '));
const pk = {};
for (const r of runs) for (const [k, v] of Object.entries(r.pickups || {})) pk[k] = (pk[k] || 0) + v;
console.log('pickups/run: ' + Object.entries(pk).map(([k, v]) => `${k} ${(v / runs.length).toFixed(1)}`).join(', '));
const ab = {};
for (const r of runs) for (const [k, v] of Object.entries(r.abil || {})) ab[k] = (ab[k] || 0) + v;
console.log('ability uses/run: ' + Object.entries(ab).map(([k, v]) => `${k} ${(v / runs.length).toFixed(1)}`).join(', '));

const flags = runs.flatMap((r) => (r.flags || []).map((f) => ({ ...f, run: `${r.diff}/${r.profile}/${r.ship}/s${r.seed}` })));
const fl = by(flags, (f) => f.kind === 'point-blank' ? `point-blank ${f.src}` : f.kind);
console.log('\n### Flags\n');
console.log(Object.keys(fl).length ? table(['flag', 'count', 'example'], Object.entries(fl).map(([k, v]) => [k, v.length, `${v[0].run} wave ${v[0].wave}`])) : 'none');
const errs = runs.flatMap((r) => r.errors || []);
console.log(`\nerrors: ${errs.length}${errs.length ? '\n' + [...new Set(errs)].slice(0, 10).join('\n') : ''}`);
const crash = all.filter((r) => r.result === 'crash');
if (crash.length) console.log(`crashed runs: ${crash.length}: ${crash.map((r) => r.why).slice(0, 3).join(' | ')}`);
const perf = runs.filter((r) => r.perf);
console.log(`\nperf (ms per sim step, CPU, SwiftShader box): update p50 ${med(perf.map((r) => r.perf.updP50))} p99 ${med(perf.map((r) => r.perf.updP99))} worst ${Math.max(0, ...perf.map((r) => r.perf.updMax))}; render p50 ${med(perf.map((r) => r.perf.rndP50))} p95 ${med(perf.map((r) => r.perf.rndP95))}; max bullets ${Math.max(0, ...runs.flatMap((r) => Object.values(r.waves || {}).map((w) => w.maxBullets)))}`);
