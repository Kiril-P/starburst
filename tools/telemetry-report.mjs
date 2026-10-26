// Real-player balance report from the online telemetry (docs/PRIVACY.md, server/README.md). Same shape as the bot report
// (tools/bot/report.mjs) so the two can be read side by side: which waves cost hull, what kills, where people quit.
//   STARBURST_API=https://starburst-api.<you>.workers.dev STARBURST_ADMIN_TOKEN=... node tools/telemetry-report.mjs [--days 30] [--build 2.0.0] [--json]
//   (npm run telemetry -- --days 7). Against the local API: STARBURST_API=http://localhost:8787 STARBURST_ADMIN_TOKEN=dev
const a = process.argv.slice(2);
const get = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a[i + 1]; };
const api = (process.env.STARBURST_API || get('--api', '')).replace(/\/$/, ''), token = process.env.STARBURST_ADMIN_TOKEN || get('--token', '');
if (!api || !token) { console.error('set STARBURST_API and STARBURST_ADMIN_TOKEN (see server/README.md)'); process.exit(2); }

const q = new URLSearchParams({ days: get('--days', '30') });
if (get('--build', '')) q.set('build', get('--build', ''));
const res = await fetch(`${api}/v1/admin/summary?${q}`, { headers: { authorization: `Bearer ${token}` } });
if (!res.ok) { console.error(`API said ${res.status}`); process.exit(1); }
const s = await res.json();
if (a.includes('--json')) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }

const pad = (v, n) => String(v).padStart(n), left = (v, n) => String(v).padEnd(n);
const sec = (ms) => (ms / 1000).toFixed(0) + 's';
const t = s.totals || {};
console.log(`STARBURST telemetry: last ${s.days} days${s.build ? `, build ${s.build}*` : ''}`);
console.log(`  sessions ${s.sessions}   runs ${t.runs ?? 0}   quits ${t.quits ?? 0}   final boss beaten ${t.wins ?? 0}   avg run ${sec(t.avgDurMs || 0)}   best wave ${t.bestWave ?? '-'}   best score ${t.bestScore ?? '-'}`);

const deaths = new Map(s.deaths.map((r) => [r.wave, r.n])), quits = new Map(s.quits.map((r) => [r.wave, r.n]));
const first = s.perWave[0]?.reached || 1;
console.log('\nper wave (rows only exist for waves players reached)');
console.log(`  ${left('wave', 5)}${pad('reached', 9)}${pad('% of w1', 9)}${pad('time', 7)}${pad('hp lost', 9)}${pad('hits', 7)}${pad('deaths', 8)}${pad('death %', 9)}${pad('quits', 7)}`);
for (const w of s.perWave) {
    const d = deaths.get(w.wave) || 0;
    console.log(`  ${left(w.wave, 5)}${pad(w.reached, 9)}${pad(Math.round((w.reached / first) * 100) + '%', 9)}${pad(sec(w.avgMs), 7)}${pad(w.avgHpLost, 9)}${pad(w.avgHits, 7)}${pad(d, 8)}${pad(Math.round((d / w.reached) * 100) + '%', 9)}${pad(quits.get(w.wave) || 0, 7)}`);
}
const totalHp = s.damage.reduce((n, r) => n + r.hp, 0) || 1;
console.log('\nwhat kills (lethal hit)');
for (const k of s.killers) console.log(`  ${left(k.killer, 34)}${pad(k.n, 6)}   avg wave ${k.avgWave}`);
console.log('\nhull damage by source');
for (const d of s.damage) console.log(`  ${left(d.src, 34)}${pad(Math.round(d.hp), 8)} hp  ${pad(Math.round((d.hp / totalHp) * 100) + '%', 4)}`);
console.log('\nship / difficulty');
for (const r of s.byShip) console.log(`  ${left(r.ship, 8)}${left(r.diff, 8)}${pad(r.runs, 6)} runs   avg wave ${r.avgWave}   avg score ${r.avgScore}`);
console.log('\ndevices / quality');
for (const r of s.byDevice) console.log(`  ${left(r.device || '?', 10)}${left(r.quality || '?', 6)}${pad(r.runs, 6)} runs   avg fps ${r.avgFps}`);
console.log('\nbuilds');
for (const r of s.builds) console.log(`  ${left(r.build, 18)}${pad(r.runs, 6)} runs   avg wave ${r.avgWave}`);
if (s.errors.length) { console.log('\nerrors'); for (const e of s.errors) console.log(`  ${pad(e.n, 4)}x  ${e.msg}`); }
