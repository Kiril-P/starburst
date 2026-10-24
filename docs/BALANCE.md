# Balance pass — waves 1-20 with a headless autopilot

Nobody had hand-played the merged build (weapons, pickups, 6 new enemies, 4 sectors, 9 bosses, hangar, free-aim
ship) end to end. This pass plays it with a bot, many times, and tunes the numbers toward the targets below.
**The bot is a proxy, not a player**: every number here needs a human sanity check (list at the end).

## How to run it

```
npm run bot -- --diffs easy,normal,hard --seeds 1,2,3,4,5 --par 7 --out tmp/bot/x.jsonl   # ~30-60 min on a laptop
npm run bot:report -- tmp/bot/x.jsonl --waves                                            # markdown tables
npm run bot -- --boss starburst --start-wave 20 --profiles skilled --seeds 1,2,3          # one fight, with the gear
                                                                                          # the bot would have by then
```

Other flags: `--ships`, `--profiles casual,skilled,oracle`, `--max-wave`, `--trace` (pilot state twice a second),
`--shots DIR` (a screenshot every 20 s of game time), `--render-every N`. `BOT_DEBUG=1` logs every chunk.

## Method

- **Real game, virtual clock.** `tools/bot.mjs` boots the dev build in headless Chrome (puppeteer-core, like the smoke
  test), stops Phaser's rAF loop and steps the game itself with an exact 1/60 s delta as fast as the CPU allows
  (`tools/bot/probe.js`). `performance.now()` returns the virtual time, so hit-stop / slow-mo / death timers last the
  same *simulated* time as in a real session. Only every 120th frame is rendered. Single run ≈ 30-60× real time;
  7 in parallel on a loaded laptop ≈ 4-10× each.
- **No game code changes for the bot.** The recorder wraps a few methods of the live scene (bullet spawn, enemy update,
  boss attacks, Combat.hurt / ram / bulletHit, loot collect, abilities) to attribute every bullet and every point of
  damage to a source (`boss:lancer/p2/lance5`, `spread`, `ram:kamikaze`, `shards:meteor_m` ...).
- **The pilot (`tools/bot/brain.js`) uses the keyboard** — synthetic `keydown`/`keyup` with the default bindings, so
  it plays with exactly the ship physics, 8-way facing and fire key a player has. Every `think` ms it scores 25
  short plans (9 directions held / held then released / tapped to turn) over a lookahead horizon against predicted
  bullet positions (skilled: real kinematics incl. accel/turn; casual: straight lines), enemy and boss bodies
  (velocity-extrapolated), telegraphs (walls, lanes, rings, lines, sniper lasers), screen edges, a preferred height,
  lining up / facing a target, and pickups. Abilities fire when a hit is predicted within 200 ms. Upgrade cards are
  picked by a per-profile policy.
- **Profiles** (human-ish limits):

  | profile | reaction lag | decision every | perception noise | bullets attended | horizon | prediction | telegraph reading | lapses |
  |---|---|---|---|---|---|---|---|---|
  | casual  | 280 ms | 100 ms | ±4 px | nearest 18 | 480 ms | straight lines | 40% | 5%/s, 450 ms |
  | skilled | 170 ms | 50 ms  | ±1.5 px | nearest 60 | 750 ms | kinematic | full | none |
  | oracle  | 0      | 33 ms  | 0 | 250 | 900 ms | kinematic | full | none — what it can't dodge is a fairness suspect |

  Casual picks cards almost at random (heal when low, likes NEW); skilled values synergies, shield/dash, its primary's
  levels, missiles/drones, and heals below 50%.
- **Fresh profile per run** (empty storage: no hangar upgrades, all ships unlocked), sound off, LOW quality.
- **Not deterministic.** Math.random is seeded per run, but cosmetic code shares it and how much of it runs depends on
  which frames are rendered, so in practice a seed doesn't replay the same run; treat results as samples (5 seeds × 3 ships per cell).
- **Fairness flags** collected per run: hits from bullets younger than 250 ms spawned within 40 px (point-blank),
  timed waves overrunning their timer, boss invulnerable > 30 s, stuck wave states > 60 s, boss fights > 6 min
  (the last four end the run as a soft-lock). Every page error / console.error / HTTP ≥ 400 is recorded.

## Targets

| | target |
|---|---|
| casual, normal | dies around wave 5-9 |
| skilled, normal | reaches wave 12-20, beats THE STARBURST in ~30-50% of runs |
| easy | forgiving: casual clearly further than on normal |
| hard | punishing: skilled rarely beats the final |
| fights | main bosses 40-90 s, mid-bosses 25-40 s, final 2-3 min |
| always | no unfair pattern deaths, no soft-locks, no console errors |
