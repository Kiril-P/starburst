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

## Results

BEFORE = the merged build at `9b492bd` plus the sniper fix (90 runs: 3 ships × 5 seeds per cell).
AFTER = this branch (180 runs: 3 ships × 10 seeds per cell). Bot code was the same for both (`--root` serves the
baseline checkout). Raw data: `tmp/bot/base.jsonl`, `tmp/bot/after.jsonl` (gitignored; regenerate with the commands above).

### Runs — median wave reached (21 = beat the final), share reaching wave 20, final kills

| difficulty / bot | BEFORE median | AFTER median | AFTER min-max | reached w20 before → after | beat final (of all runs) before → after | target |
|---|---|---|---|---|---|---|
| easy casual    | 10 | 17 | 5-21  | 13% → 47%  | 13% → 23%  | clearly further than normal |
| easy skilled   | 21 | 21 | 21-21 | 100% → 100% | 100% → 100% | forgiving |
| normal casual  | 3  | 10 (mean 9.5) | 5-16 | 0% → 0% | 0% → 0% | dies ~wave 5-9 |
| normal skilled | 11 | 21 | 8-21  | 27% → 73%  | 27% → 50%  | wave 12-20, beats final 30-50% |
| hard casual    | 3  | 4  | 3-11  | 0% → 0%    | 0% → 0%    | punishing |
| hard skilled   | 9  | 11 | 5-21  | 7% → 17%   | 7% → 3%    | rarely beats the final |

A larger normal-skilled sample during tuning (60 runs, round 9) beat the final in 55%; with 10 seeds the
confidence interval is about ±15 points, so "30-50%" is met at its upper edge.

Normal casual per ship: normal 10, speedy 5, tank 16 (BEFORE: 7 / 3 / 9).

### Boss fight length (median s of kills; kill rate)

| boss | type | BEFORE | AFTER | AFTER kill rate | target |
|---|---|---|---|---|---|
| Lancer (w3)     | mini | 81  | 41  | 93%  | 25-40 |
| Gyre (w8)       | mini | 26  | 28  | 88%  | 25-40 |
| Bastion (w13)   | mini | 8   | 39  | 100% | 25-40 |
| Manta (w18)     | mini | 9   | 32  | 100% | 25-40 |
| Warden (w5)     | main | 52  | 53  | 86%  | 40-90 |
| Hive            | main | 13  | 41  | 97%  | 40-90 |
| Prism           | main | 30  | 50  | 92%  | 40-90 |
| Tempest         | main | 28  | 49  | 95%  | 40-90 |
| Colossus        | main | 64  | 42  | 95%  | 40-90 |
| THE STARBURST (w20) | final | 20 | 150 | 75% | 120-180 |

(The main boss of waves 10/15 is drawn from Hive/Prism/Tempest/Colossus, so their fight counts differ.)

### Where runs end (share of runs that played the wave and died in it)

| wave | 3 | 5 | 8 | 9 | 11 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|
| BEFORE | 21% | 0% | 5% | **32%** | **34%** | 8% | 4% | 0% |
| AFTER  | 7%  | 14% | 12% | 2% | 8% | 11% | 13% | 25% |

BEFORE had a wall at the Lancer (w3) and two cliffs at waves 9 and 11 (the wave table running out, see bugs);
AFTER the difficulty rises with the sectors and peaks at the bosses and the final.

### Health

- Console / page errors: 0 in all 270 runs (and in the 15 oracle runs). Soft-locks: 0.
- Oracle (zero reaction lag, `tmp/bot/oracle.jsonl`, 15 runs normal): 15/15 beat the final, **0 point-blank hits and
  0 damage from any boss attack it couldn't dodge**; its few hits are from enemy bullets in crowded waves and Gyre's
  ram. Nothing in the game hit it in an undodgeable way.
- Remaining point-blank flags are mostly Starburst `shells` / `well` / `pinwheel`: mortar shells and gravity-well
  bursts that are telegraphed at the landing point and spawn their bullets there, so bullet age is short by design.
  The oracle took 0 hits from them; casual/skilled bots get hit because they stand in the telegraph too long.
- Upgrade uptake (AFTER, all runs): drones, missiles, forcefield, dash, blaster, phase, thrusters, then spread;
  heal 103 picks; synergies (swarm, hunter) are taken when available. Forcefield uses per run: 10.6 → 12.3
  (runs are much longer now), phase 3.6 → 5.0.

## Bugs fixed

| commit | bug |
|---|---|
| `86902f6` | **Sniper never initialised** `hoverMs` / `nextFire` (swallowed by a trailing comment) — both stayed undefined (NaN timers), so snipers never fired and never left. |
| `60f7a89` | **Sector timed-wave plan 3 unreachable**: the mid-boss waves (3/8/13/18) replaced the third timed wave of every sector, so its new enemy (e.g. snipers) first appeared a sector late. Dropped those plan slots and folded their enemies into the next plan. |
| `24ebc98` | **Wave table ran out at wave 11**: the 10-row v1 table was indexed by wave number, so from wave 11 on it went into endless-mode scaling (the w9/w11 death cliffs). New `WAVES.tableRowByWave` spreads the rows over 20 waves. |
| `24ebc98` | **Flat boss HP**: late bosses melted (Bastion 8 s, Manta 9 s, final 20 s). `BOSSES.hpByWave` scales by the wave the boss is fought on. |
| `cde3e58` | **Gyre plunge lane narrower than its ram contact zone** — standing just outside the drawn lane still got rammed. Lane 46 → 58 px. |
| `da28580` | **Point-blank shots**: v1 enemies could fire with the muzzle on top of the player, and gravity-well rings could spawn around a player touching the core. Both now hold fire within 56 / 48 px. |

## Tuning changes

| knob | before | after | why |
|---|---|---|---|
| `WAVES.tableRowByWave` | wave = row | 20-wave curve, rows 1-12 | smooth curve; no endless scaling before wave 20 |
| `WAVES.tierByWave` | — | 0,0,0,1×5,2×6,3×6 | enemy tier rises with the sectors |
| `BOSSES.hpByWave` | 1 | w3 0.5, w5 1.1, w8 1.2, w10 1.3, w13 4.5, w15 2.4, w18 4, w20 10; `cycleHp` 0.6 | fight lengths toward 25-40 / 40-90 / 120-180 s |
| Lancer `lance5` | 16°, 800 ms | 20°, 850 ms | the w3 wall: casual bots couldn't read the 5-lance fan |
| Hive / Tempest base HP | 1500 / 1700 | 2000 / 2000 | 13 s / 28 s fights |
| Starburst `density` / `damage` (new `def.damage` knob in `Boss.dmg`) | 1 / 1 | 1.5 / 1.65 | with HP alone the final was long but harmless |
| forcefield cooldown | 15 / 12 / 9 s | 18 / 15 / 12 s | skilled bots blocked almost every hit with it |
| phase cooldown / duration | 15 / 12.5 / 10 s, 3 / 3.5 / 4 s | 16 / 14 / 12 s, 2.5 / 2.8 / 3.2 s | same |
| speedy / tank hull | 70 / 150 | 80 / 140 | speedy far behind, tank far ahead (still true, see below) |
| hard `enemyHealth` / `enemyDamage` | 1.3 / 1.3 | 1.4 / 1.5 | hard skilled still beat the final too often after the curve fix |

## Off target / needs a human playtest

1. **Skilled final win rate (50-55% on normal) is at the top of the band**, and the bot uses abilities with perfect
   timing. Humans will likely win less — check before lowering it further. Knobs: `BOSSES.hpByWave[20]`,
   Starburst `damage`.
2. **Normal casual median is wave 10** (mean 9.5, target 5-9) — one wave long. The casual bot is a guess at a casual
   human; play waves 5-12 on normal and decide.
3. **Easy casual reaches wave 20 in 47% of runs** — maybe too forgiving, maybe exactly what easy is for.
4. **Ship spread is still wide**: speedy dies ~5 waves earlier than normal and tank ~6 later (normal casual). The bot
   can't use speedy's mobility as well as a human might; worth feeling out before touching hull/speed again.
5. **Gyre ram** (w8) is the second biggest killer (15 deaths). The lane fix made it fair (the oracle never died to it)
   but the bot keeps getting caught; check that the plunge telegraph reads well.
6. **Warden at wave 5** is now the first real filter (14% die there): broadside + lances + pod fans. Check it feels
   learnable rather than cheap.
7. Feel of the nerfed **forcefield / phase** cooldowns and of keyboard ("move") aim against strafing bosses
   (Lancer, Manta) — the bot needed target leading to cope.
8. Starburst mortar shells / wells: telegraphed, but if humans also stand in them, lengthen the telegraph.

---

# Pass 2: "I didn't even have to move" (2026-10-24)

A playtester found sector 3 lackluster, boring and easy, and never moved. The bot confirmed it, so this pass adds enemies and
mechanics that make standing still fail, and scales every sector's enemies up so a strong build can't delete a wave before it fires.

## What the bot said before (12 runs, skilled + casual, normal / tank, same bot code)

Mean damage the skilled pilot took per timed wave: wave 6 **0**, wave 11 **3**, wave 12 **1**, wave 13 **3**, wave 16 **0**,
wave 18 **1**. It reached wave 20 in 100 % of runs and beat the final in 4 of 6. Sector 3 (waves 11-15) cost 3 / 1 / 3 / 20 / 25 HP.

## What changed

Content (details in `docs/WAVES.md`): five new enemies (strafer, seeker, pylon, emitter, warper), a real laser-beam mechanic
(`objects/beams.js`: telegraph, lock, hit test, graze), five new set pieces, a rewrite of waves 2, 4, 6, 7, 9, 11, 12, 14, 16, 17, 19
(sector 3 is now LOCKDOWN / SECURITY SWEEP / GAUNTLET), light reinforcements during mid-boss fights, ELITE enemies, a FLAWLESS bonus.
Numbers: enemy HP x1 / 1.25 / 1.6 / 2 and enemy fire interval x1 / 0.94 / 0.86 / 0.78 by sector.

## Results (36 runs: 3 ships x 6 seeds x skilled / casual, normal difficulty)

| | before (12 runs) | after (36 runs) | target |
|---|---|---|---|
| skilled, median wave reached | 21 | 21 | 12-20, final beaten in 30-50 % |
| skilled, reached wave 20 | 100 % | 72 % | |
| skilled, beat the final (of all skilled runs) | 4/6 (67 %) | 9/18 (50 %) | 30-50 % |
| casual, median wave | 10 | 11 (normal 11, speedy 5, tank 15) | dies around 5-9 |
| soft-locks / console errors | 0 / 0 | 0 / 0 | 0 |

Mean damage the skilled pilot takes per timed wave (HP):

| wave | 6 | 7 | 9 | 11 | 12 | 13 | 14 | 16 | 17 | 18 | 19 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 0 | 12 | 7 | 3 | 1 | 3 | 20 | 0 | 26 | 1 | 16 |
| after  | 3 | 11 | 12 | **45** | **23** | **24** | **53** | **36** | **50** | 6 | 35 |

Deaths in a wave (casual + skilled): wave 11 4 %, 14 5 %, 17 18 %, 19 0 %, wave 20 (final) 36 % of runs that played it.
`px/s moved` in the sector 3 waves is now 155-180 (was 128-166) and the time the pilot spends standing still is 11-17 % there.
Waves 6 and 18 are still gentle (rock shower and the Manta); they are the bot's best case for dodging rocks and blinks.

## Difficulty ladder (6 runs per cell, an earlier build of this pass)

easy casual median wave 17, easy skilled beats the final 5/5; hard casual median 3, hard skilled beat the final 0/2.

## Fairness (oracle pilot: zero reaction lag, sees everything)

16 oracle runs from wave 1 (two earlier builds of this pass, normal + tank): 16/16 beat the final. After the last change, starting directly at waves 14 and 19 (12 runs each):
**0 beam hits**, and the only hits are ordinary bullets in crowded rooms. This check removed a first version of the emitters: with a
sweeping horizontal beam on both walls even the oracle was hit 1-8 times a run in wave 19 (the two wedges leave no safe row), so
emitter beams are now a fixed band and only the ceiling pylons sweep (tier 2+).

## Bot changes

`tools/bot/brain.js`: reads beams (a live band costs 1.8x a bullet hit, sweeping beams cover their whole sector) and has a
`statue` profile that never moves (it dies in wave 1, so it is not a useful gate; the per-wave movement numbers are).
`tools/bot/probe.js`: per-wave `dist` (px travelled) and `still` (share of frames standing still), `beamHit` attribution
(`beam:pylon` / `beam:emitter`, age = ms since the band went live, distance = to the emitter). `report.mjs --waves`: two new columns.

## Still needs a human

- How the beams *feel*: the lock time (430 ms strobing), the 1.0-1.5 s charge and the sweep speed are numbers from a bot with 170 ms
  reaction time; a human with a gamepad or a laptop trackpad may want more warning. `chargeMs` / `restMs` in `enemyTypes4.js`.
- Elite frequency (`min(20 %, 4 % + 1 % x wave)` per eligible spawn, one at a time) and whether the reward feels worth the extra HP.
- Whether wave 17 (SPIRAL DANCE with warpers, 18 % of bot deaths) and wave 20 are the right peak.

## Online boards: score limits (calibration, 2026-10-25)

`server/src/validate.js` only ranks a run whose score is plausible for its length. The limits come from 12 full bot runs (3 ships x oracle / skilled x 2 seeds, `tmp/bot/score-calib.jsonl`, scores sampled every 10 s of game time by `tools/bot/probe.js`):

| | oracle (6 runs) | skilled (6 runs) |
|---|---|---|
| ended | 6 victories | 4 victories, 2 deaths (waves 12 and 17) |
| final score | 1.8 - 2.9 M | 22 k - 3.2 M |
| average score per second of play | 1316 - 2317 | 88 - 2856 |
| time per wave (incl. upgrade screens) | 62 - 70 s | 50 - 65 s |
| kills per second | 0.60 - 0.86 | 0.08 - 1.01 |
| best 10-second window | 16789 points/s (a boss kill) | |

Score grows much faster late in a run (combo and sector scaling), so one points-per-second figure is loose early and tight late: hence two limits. Plausible = `score <= 4000 + 6000 * seconds` (about twice the best average) **and** `score <= 4000 + 12000 * wave^2` (wave 20: 4.8 M against the best clear of 3.2 M), at most one wave per 5 s, at most `6 * seconds + 50` kills. Humans can graze and combo better than the bots, so these have headroom on purpose: a false rejection (a real record that never shows up) is worse than a forged score that is plausible anyway. The telemetry report shows rejected runs (`ranked = 0` with a name): check it after launch and loosen the limits if real runs land there.
