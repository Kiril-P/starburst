-- STARBURST online boards + telemetry (Cloudflare D1 / SQLite). Apply with:
--   npx wrangler d1 execute starburst --file=schema.sql [--remote]
-- Nothing in here identifies a player: no IP, no install id, no user agent. `id` is a random per-run token.
CREATE TABLE IF NOT EXISTS runs (
    id      TEXT PRIMARY KEY,            -- random per-run id from the client (de-duplicates retries)
    at      INTEGER NOT NULL,            -- server receive time, ms since epoch
    build   TEXT NOT NULL,               -- game build id, e.g. 2.0.0-mh3k2j
    env     TEXT NOT NULL,               -- 'prod' | 'dev'
    mode    TEXT NOT NULL,               -- 'normal' | 'daily'
    day     TEXT NOT NULL,               -- seed date (YYYY-MM-DD) for daily runs, '' otherwise
    ship    TEXT NOT NULL,
    diff    TEXT NOT NULL,
    outcome TEXT NOT NULL,               -- 'death' | 'win' | 'quit'
    won     INTEGER NOT NULL DEFAULT 0,  -- 1 once the final boss (wave 20) was beaten in this run
    score   INTEGER NOT NULL,
    wave    INTEGER NOT NULL,
    dur     INTEGER NOT NULL,            -- run length in ms of simulated play
    kills   INTEGER NOT NULL DEFAULT 0,
    graze   INTEGER NOT NULL DEFAULT 0,
    combo   INTEGER NOT NULL DEFAULT 1,
    bosses  INTEGER NOT NULL DEFAULT 0,
    killer  TEXT NOT NULL DEFAULT '',    -- what dealt the lethal hit ('' for quits)
    name    TEXT NOT NULL DEFAULT '',    -- 3-char callsign, only used by the boards
    ranked  INTEGER NOT NULL DEFAULT 0,  -- 1 = eligible for the public boards
    device  TEXT NOT NULL DEFAULT '',    -- 'keyboard' | 'gamepad' | 'touch'
    quality TEXT NOT NULL DEFAULT '',
    fps     INTEGER NOT NULL DEFAULT 0,  -- average frame rate during the run
    waves   TEXT NOT NULL DEFAULT '[]',  -- per wave: [wave, ms, hpLost, hits]
    dmg     TEXT NOT NULL DEFAULT '{}'   -- hull damage by source: { "basic": 20, "beam:pylon": 10 }
);
CREATE INDEX IF NOT EXISTS runs_board ON runs (ranked, mode, day, score DESC, at);
CREATE INDEX IF NOT EXISTS runs_build ON runs (build, env, at);

CREATE TABLE IF NOT EXISTS events (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    at    INTEGER NOT NULL,
    kind  TEXT NOT NULL,                 -- 'session' | 'error'
    build TEXT NOT NULL,
    env   TEXT NOT NULL,
    data  TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS events_kind ON events (kind, at);
