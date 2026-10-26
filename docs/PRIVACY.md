# Privacy: what STARBURST sends, and what it does not

This applies to builds made with `VITE_API_URL` set (see [`server/README.md`](../server/README.md)). A build without it makes no network request at all.
The game is playable offline either way: everything below is fire-and-forget, never blocks play, and a failed send is queued and retried (runs only, at most 20).

## What is sent

**When a run ends** (you die, you beat the final boss and go to the menu, or you quit from the pause menu after 5 seconds of play):

| Field | Example | Why |
|---|---|---|
| random run id | `k3j9...` (new every run, never reused) | de-duplicates retries |
| game build, `prod` / `dev` | `2.0.0-mh3k2j` | compare versions, ignore playtests |
| mode, daily seed date, ship, difficulty | `normal`, `2026-10-25`, `tank`, `hard` | balance per ship and difficulty, daily boards |
| outcome, final boss beaten | `death`, `false` | where people quit |
| score, wave reached, run length, kills, grazes, best combo, bosses | `52000`, `9`, `241 s`, ... | boards, balance |
| per wave: time, hull lost, hits taken | `[2, 30114, 10, 1]` | which waves cost hull |
| hull lost by source, and the source of the lethal hit | `{"beam:pylon": 20}`, `boss:warden/p2` | what is too strong or too weak |
| input device, graphics setting, average frame rate | `keyboard`, `auto`, `58` | find slow devices |
| assist mode on / off | `false` | assist runs are never ranked |
| callsign (only if you set one) | `KIR` | public, shown on the world boards |

**Once per page load:** input device, graphics setting, window size and pixel ratio, the first two letters of the browser language (`en`), whether the game is installed as an app, whether it is embedded in another page (itch.io), whether the quality setting auto-lowered.

**Up to 5 times per page load:** an uncaught error: its message (cut to 200 characters) and the file and line it came from.

## What is not sent or stored

- No account, name, e-mail, or any id that lasts longer than one run. Runs cannot be linked to a person; the callsign is three characters you pick and is not unique.
- The server does not store IP addresses or user agents. It reads the IP only to rate-limit writes (20 per minute) and does not keep it. No cookies are set. Nothing is sent to third parties; there is no analytics service.
- Cloudflare, which hosts the API, sees request IPs as any host does and may log them under its own policy. That is outside this code.
- Nothing is read from the device except what is listed above. Your settings and progress stay in `localStorage` on your device.

The code that decides all of this is small: `src/systems/net.js`, `telemetry.js`, `runlog.js` on the client, `server/src/validate.js` on the server (it drops every field not in the list).

## Switching it off

**Settings → Online** (default on) stops all of it: no session event, no run upload, no board lookups, no outbox retries. The WORLD tabs then say the board is unreachable. Local boards, the daily run and everything else keep working.

## Retention and removal

Nothing is deleted automatically yet. The data holds no personal information, but the owner should pick a retention period and add a periodic `DELETE FROM runs WHERE at < ...` (**OWNER DECISION**). A callsign or score can be removed by hand (`server/README.md`).

## Owner checklist

- **OWNER DECISION: consent.** Telemetry is always on by design (no opt-in prompt), justified by the data being anonymous: no identifier that outlives a run, no IP stored. Whether that is enough where you distribute (EU/UK players, itch.io's own rules, store policies) is a legal question this repo does not answer: have it checked, or add a first-launch prompt. A prompt is a small change: gate `online()` in `src/systems/net.js` on a stored answer.
- Mention online features on the itch.io page and in the README (done in this repo; keep the itch text in sync).
- Never put the admin token in the repo or in a `VITE_` variable: those are compiled into the public bundle.
