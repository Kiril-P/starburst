// Balance aggregates for GET /v1/admin/summary (prod runs only). Mirrors tools/bot/report.mjs so real players can be
// compared with the bot: per wave how many runs reached it, how long it took, how much hull it cost, and what killed.
// Optional query: ?build=<prefix> to look at one build, ?days=<n> (default 30).

export async function summary(db, url) {
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
    const build = (url.searchParams.get('build') || '').replace(/[^0-9A-Za-z.+-]/g, '');
    const since = Date.now() - days * 864e5;
    const where = 'env = \'prod\' AND at >= ?1 AND build LIKE ?2';
    const args = [since, build + '%'];
    const all = async (sql) => (await db.prepare(sql).bind(...args).all()).results;
    const one = async (sql) => await db.prepare(sql).bind(...args).first();

    const totals = await one(`SELECT COUNT(*) AS runs, SUM(outcome = 'quit') AS quits, SUM(won) AS wins, CAST(AVG(dur) AS INTEGER) AS avgDurMs, MAX(wave) AS bestWave, MAX(score) AS bestScore FROM runs WHERE ${where}`);
    const perWave = await all(
        `SELECT CAST(json_extract(j.value, '$[0]') AS INTEGER) AS wave, COUNT(*) AS reached, CAST(AVG(json_extract(j.value, '$[1]')) AS INTEGER) AS avgMs,
                ROUND(AVG(json_extract(j.value, '$[2]')), 1) AS avgHpLost, ROUND(AVG(json_extract(j.value, '$[3]')), 2) AS avgHits
         FROM runs, json_each(runs.waves) AS j WHERE ${where} GROUP BY 1 ORDER BY 1`);   // (GROUP BY wave would bind to runs.wave, not the alias)
    const deaths = await all(`SELECT wave, COUNT(*) AS n FROM runs WHERE ${where} AND outcome = 'death' GROUP BY wave ORDER BY wave`);
    const quits = await all(`SELECT wave, COUNT(*) AS n FROM runs WHERE ${where} AND outcome = 'quit' GROUP BY wave ORDER BY wave`);
    const killers = await all(`SELECT killer, COUNT(*) AS n, CAST(AVG(wave) AS INTEGER) AS avgWave FROM runs WHERE ${where} AND outcome = 'death' AND killer != '' GROUP BY killer ORDER BY n DESC LIMIT 25`);
    const damage = await all(`SELECT j.key AS src, SUM(j.value) AS hp FROM runs, json_each(runs.dmg) AS j WHERE ${where} GROUP BY src ORDER BY hp DESC LIMIT 25`);
    const byShip = await all(`SELECT ship, diff, COUNT(*) AS runs, CAST(AVG(wave) AS INTEGER) AS avgWave, CAST(AVG(score) AS INTEGER) AS avgScore FROM runs WHERE ${where} GROUP BY ship, diff ORDER BY runs DESC`);
    const byDevice = await all(`SELECT device, quality, COUNT(*) AS runs, CAST(AVG(fps) AS INTEGER) AS avgFps FROM runs WHERE ${where} GROUP BY device, quality ORDER BY runs DESC`);
    const builds = await all(`SELECT build, COUNT(*) AS runs, CAST(AVG(wave) AS INTEGER) AS avgWave FROM runs WHERE ${where} GROUP BY build ORDER BY MAX(at) DESC LIMIT 10`);
    const sessions = await db.prepare("SELECT COUNT(*) AS n FROM events WHERE kind = 'session' AND env = 'prod' AND at >= ?1 AND build LIKE ?2").bind(...args).first();
    const errors = await db.prepare("SELECT json_extract(data, '$.msg') AS msg, COUNT(*) AS n FROM events WHERE kind = 'error' AND env = 'prod' AND at >= ?1 AND build LIKE ?2 GROUP BY msg ORDER BY n DESC LIMIT 15").bind(...args).all();
    return { days, build, totals, sessions: sessions?.n ?? 0, perWave, deaths, quits, killers, damage, byShip, byDevice, builds, errors: errors.results };
}
