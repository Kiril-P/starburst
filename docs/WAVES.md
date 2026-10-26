# Wave identities (waves 1-20)

Data: `src/objects/waveScripts.js` (per-wave scripts), `waveEvents.js` (event runtime), `formationsSet.js` + `formationsStation.js` (set pieces).
Each timed wave replaces the sector filler mix with one idea, introduced alone and then combined; the banner shows the
name + a one-line hint. Boss waves (3, 5, 8, 10, 13, 15, 18, 20) keep their own intros. Endless play reuses wave
`((n-1) % 20) + 1`. Event timing is relative to the wave timer (`pct`/`end`), so retuning durations keeps the arc.

| Wave | Theme | Mechanic / idea | Mid-wave beat |
|---|---|---|---|
| 1 | FIRST CONTACT | basic ships only, a row of three opens it; teaches "shot goes straight up, slide under them" | toast: graze for combo |
| 2 | INTERCEPTORS | V formations + a sweeping snake (formations introduced) | toast: chain kills for combo; **RAIDERS** (strafers) cross the screen |
| 3 | mid-boss (Lancer) | - | - |
| 4 | CROSSFIRE (sector 1 finale) | spread needles join; **wall with a gap** blockade (shoot ships to widen it); raider pairs from both sides | **AMBUSH**: kamikaze zippers; **FINAL PUSH** (surge + wall + pincer + crossfire) |
| 5 | boss (Warden) | - | - |
| 6 | ROCK SHOWER | meteors, big rocks split; shower bands always leave a lane; raiders cross | lane showers; **SEEKERS** (slow homing drones) introduced |
| 7 | MINEFIELD | mine layers; **chain explosions**: shooting a mine pops every mine within reach; raiders | **MINE BLOOM**: ring of 8 mines, one shot pops the ring |
| 8 | mid-boss (Gyre/Bastion/Manta) | - | - |
| 9 | SWARM (sector 2 finale) | splitter pods + kamikaze swarms; **fuse line** of amber ships; seekers and raiders | **BROOD** rushes + seekers; **FINAL PUSH** |
| 10 | boss | - | - |
| 11 | LOCKDOWN (sector 3 opener) | **laser pylons** on the ceiling: the amber line tracks you, LOCKS (strobes), then fires a beam; at tier 2+ the beam also sweeps and the telegraph shows the whole sector; raiders, snipers | seeker pack; **WALL EMITTERS** (horizontal beams, they track your height); turret line; **FINAL PUSH** |
| 12 | SECURITY SWEEP (**rest/reward**, half length, light enemies) | three supply trails (gems, hull repair, SCORE X2, magnet) **guarded by beams**: collect while dodging | emitters sweep the loot; **AMBUSH** escorted carrier + rush after the calm |
| 13 | mid-boss | - | - |
| 14 | GAUNTLET (sector 3 finale) | pylons + turrets + shield carriers + snipers + raiders; **shield-carrier escorts** | **CROSSBEAM** (wall emitters + seekers); wall + escort; **FINAL PUSH** (wall + lasergate + pincer) |
| 15 | boss | - | - |
| 16 | KAMIKAZE RUSH | drone zippers dive in straight lines, sidestep; raiders | **WARPERS** (blink in and out; only hittable while solid); **SOLAR FLARE** triple rush; surge |
| 17 | SPIRAL DANCE | ships **spiral** out from the top centre; ring casters + snipers + warpers | two counter arms; warpers + seekers; closing spiral with **crossbeam** |
| 18 | mid-boss | - | - |
| 19 | LAST STAND (finale before THE STARBURST) | everything: wall, escorts, fuse line, spiral, rush, turret line, raiders | **LASER GRID** (pylons + emitters); **LAST STAND** banner: rush + warpers + turret line; **FINAL PUSH** with wall + rush + seekers + pincer |
| 20 | THE STARBURST | final boss | - |

## Juice added
- **Chain explosions**: `volatile` ships (amber blink) and mines blow up neighbours in a rippling sequence; each chained kill pays score + combo and shows `CHAIN xN`.
- **Kill streaks**: kills within 0.7s build a streak; every 5th pays a flat bonus with a lime popup by the ship.
- **Banners**: wave start shows `NAME` + `WAVE n // hint`; wave clear shows a per-wave line; mid-wave events use the same banner (with the `warning` sfx) or an amber toast.

## Set pieces (`formationsSet.js`, usable via `__dbg.formation('<name>')`)
`line`, `wall`, `spiral`, `turretline`, `rush`, `escort`, `fuse`, `bloom` (plus the existing `vee sweep pincer circle swarm shower turrets snipers minefield`).

## Spawner extras
Spawn entries accept a third value = first-spawn delay (ms), so late-arriving enemies stay out of a wave's first seconds. Events: `banner`, `toast`, `form` (array staggers by `gapMs`), `supply`, `calm` (spawn lull), `surge` (spawn-rate multiplier).

## New enemies (`enemyTypes4.js`, sprites `art/sprites/enemies3.js`)

| Type | Behaviour | Counterplay |
|---|---|---|
| `strafer` (raider) | crosses the screen at 90-110 px/s on a bobbing line, firing aimed single / pair / fan bursts, leaves by the far side. Pairs enter from both walls (`crossfire`) | never stops, so lead it; the two sides cover each other |
| `seeker` | homing drone, turn rate limited (1.15-1.6 rad/s), 2 shots to kill; blinks amber for its last second and bursts into a slow ring | a wide arc loses it; shooting it needs a line-up |
| `pylon` | ceiling-mounted beam: drifts to your column, charges 1.0-1.35 s (amber line tracks, last 430 ms LOCKED and strobing), fires a 380 ms band; tier 2+: 520 ms sweeping band, the telegraph draws both edges of the sector | keep moving; shoot the pylon during the charge to cancel the shot |
| `emitter` | the same on the walls: slides to your height, a horizontal band across the whole screen | hop vertically after the lock; a graze counts |
| `warper` | blinks in near you, flares, fires (fan / rings / aimed triples), blinks out; armoured (0 damage) except while solid | the window is the second between flare and exit |

Beams are `objects/beams.js` (telegraph, hit test, graze, draw); the damage source shows up in the bot report as `beam:pylon` / `beam:emitter`.

## Pacing rules added in the same pass

- **Sector scaling** (`tuning.js` `WAVES.hpBySector`, `fireBySector`): enemy HP x1 / 1.25 / 1.6 / 2 and enemy fire intervals x1 / 0.94 / 0.86 / 0.78
  by sector (endless: +0.3 HP per extra sector). A strong build used to delete a wave before it fired, so sector 3 asked for no movement.
- **ELITES** (wave 4+, `WaveManager.spawnGroup` / `Enemy.makeElite`): a basic / spread / circular / splitter / shield spawn can arrive as an
  elite (amber halo, 2.6x hull, an extra amber ring on every other volley). One at a time. Killing it pays triple score and a guaranteed
  drop (3 large gems + a repair when hurt, else a power-up).
- **FLAWLESS** (`Game.js` onClear): clearing any wave or boss without a single hull hit pays `300 + 60 x wave` points and a lime toast.
