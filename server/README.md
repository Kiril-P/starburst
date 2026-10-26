# STARBURST online API (boards + telemetry)

A small Cloudflare Worker with a D1 (SQLite) database. It does two things:

1. **World leaderboards** (all-time and daily) with 3-letter arcade callsigns.
2. **Anonymous telemetry** that feeds the balance work with real player data: where people die, what kills them, how long waves take, who quits.

The game works without it. If the game is built without `VITE_API_URL` it makes no network request at all and the WORLD tabs and the ONLINE setting do not appear.
What is collected and why is in [`docs/PRIVACY.md`](../docs/PRIVACY.md).

```
server/
  src/index.js      Worker entry (3 lines)
  src/handler.js    routes: POST /v1/run, POST /v1/event, GET /v1/board, GET /v1/admin/summary, GET /v1/health
  src/validate.js   input validation, clamping, the score plausibility check, callsign blocklist
  src/summary.js    SQL aggregates behind the admin summary / tools/telemetry-report.mjs
  src/d1shim.js     D1 look-alike over node:sqlite (local dev server + tests only, not deployed)
  schema.sql        tables: runs, events
  wrangler.toml     Worker + D1 + rate-limit binding
  dev.mjs           local API on :8787 (npm run server:dev)
  test/             node --test (npm run test:server)
```

**Deployed:** `https://starburst-api.kirilp.workers.dev` (Worker `starburst-api`, D1 database `starburst`, id in `wrangler.toml`). `npm run build:online` builds the game against it. The admin token lives only in Cloudflare and in the git-ignored `.env.telemetry`.

## One-time setup (about 10 minutes, free tier is plenty)

You need a Cloudflare account. From this folder:

```bash
cd server
npx wrangler login
npx wrangler d1 create starburst            # prints a database_id: paste it into wrangler.toml
npx wrangler d1 execute starburst --remote --file=schema.sql
npx wrangler secret put ADMIN_TOKEN         # any long random string; guards the admin summary
npx wrangler deploy                         # prints https://starburst-api.<your-subdomain>.workers.dev
```

Then build the game against it (the API origin is added to the CSP `connect-src`, nothing else is):

```bash
VITE_API_URL=https://starburst-api.<your-subdomain>.workers.dev npm run build
npm run compliance -- --require-dist        # prints "online build: the game may contact ..."
```

Upload `dist/` to itch.io / your site as before. A custom domain (`api.kirilpetrovski.com`) works the same way: add a route in the Cloudflare dashboard and use that URL instead.

`.env` files are git-ignored in this repo, so either pass `VITE_API_URL` inline as above or put it in the CI environment. There is no secret in it: the API URL is public by nature.

### Rate limiting

`wrangler.toml` declares a Workers rate-limit binding (`RL`, 20 writes per minute per IP; reads are not limited). If your wrangler version predates `[[ratelimits]]`, delete that block: the handler skips the check when the binding is missing. For anything beyond a hobby audience also add a Cloudflare WAF rate-limiting rule on `/v1/run`.

## Local development

```bash
npm run server:dev                                   # API on http://localhost:8787, data in tmp/server-dev.sqlite
VITE_API_URL=http://localhost:8787 npm run dev       # the game, pointed at it (tagged env=dev: never ranked)
npm run test:server                                  # unit tests for validation, ranking, summary, rate limit, CORS
npm run test:online                                  # the real game in headless Chrome against the real handler
```

Dev builds are tagged `env: "dev"`. The server stores them but never ranks them and the admin summary ignores them, so playtesting never pollutes the boards or the balance data.

## Reading the data

```bash
STARBURST_API=https://starburst-api.<you>.workers.dev STARBURST_ADMIN_TOKEN=... npm run telemetry -- --days 14 [--build 2.0.0]
```

prints, in the same shape as the bot report (`npm run bot:report`): runs reached per wave, time per wave, hull lost, deaths and quits per wave, what delivers the lethal hit, hull damage by source, ship and difficulty mix, devices and frame rates, errors. `--json` gives the raw numbers. Or query D1 directly:

```bash
npx wrangler d1 execute starburst --remote --command "SELECT wave, COUNT(*) FROM runs WHERE outcome='death' GROUP BY wave"
```

Killer / damage labels: an enemy type (`basic`, `strafer`), `boss:<id>/p<phase>`, `beam:<type>`, `ram:<type>`, `shards:<type>`. A bullet is blamed on whoever was firing when it was created, so delayed boss attacks keep the attack's label.

## Anti-cheat: what it does and does not do

The repo is public and the game runs in the player's browser, so a score can always be forged. The server therefore:

- validates every field (types, ranges, enums, size limit 16 KB), strips unknown keys, de-duplicates by run id;
- ranks a run only if it is plausible for its length: `score <= 4000 + 6000/s * duration` and `score <= 4000 + 12000 * wave^2`, waves cleared at no more than one per 5 s, kills capped per second (`LIMITS` in `src/validate.js`, calibrated on the balance bot, see docs/BALANCE.md);
- never ranks assist-mode runs, dev builds, abandoned runs or runs without a clean callsign (profanity blocklist);
- stores rejected-for-ranking runs anyway, so you can see tampering attempts in the data.

It does **not** verify that the run really happened. A determined cheater can submit a plausible fake. If that becomes a problem, the next step is replay verification (send the seed and an input log, re-simulate on the server), which needs a deterministic fixed-step simulation. Until then, remove entries by hand:

```bash
npx wrangler d1 execute starburst --remote --command "UPDATE runs SET ranked = 0 WHERE id = '<run id>'"
```

(run ids are in `GET /v1/board`).
