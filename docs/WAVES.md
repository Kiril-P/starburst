# Wave identities (waves 1-20)

Data: `src/objects/waveScripts.js` (per-wave scripts), `waveEvents.js` (event runtime), `formationsSet.js` (set pieces).
Each timed wave replaces the sector filler mix with one idea, introduced alone and then combined; the banner shows the
name + a one-line hint. Boss waves (3, 5, 8, 10, 13, 15, 18, 20) keep their own intros. Endless play reuses wave
`((n-1) % 20) + 1`. Event timing is relative to the wave timer (`pct`/`end`), so retuning durations keeps the arc.

| Wave | Theme | Mechanic / idea | Mid-wave beat |
|---|---|---|---|
| 1 | FIRST CONTACT | basic ships only, a row of three opens it; teaches "shot goes straight up, slide under them" | toast: graze for combo |
| 2 | INTERCEPTORS | V formations + a sweeping snake (formations introduced) | toast: chain kills for combo |
| 3 | mid-boss (Lancer) | - | - |
| 4 | CROSSFIRE (sector 1 finale) | spread needles join; **wall with a gap** blockade (shoot ships to widen it) | **AMBUSH**: kamikaze zippers; **FINAL PUSH** (surge + wall + pincer) |
| 5 | boss (Warden) | - | - |
| 6 | ROCK SHOWER | meteors alone, big rocks split; shower bands always leave a lane | lane showers, closing rockfall |
| 7 | MINEFIELD | mine layers; **chain explosions**: shooting a mine pops every mine within reach | **MINE BLOOM**: ring of 8 mines, one shot pops the ring |
| 8 | mid-boss (Gyre/Bastion/Manta) | - | - |
| 9 | SWARM (sector 2 finale) | splitter pods + kamikaze swarms; **fuse line** of amber-blinking volatile ships ripple-explode | **BROOD** kamikaze rushes; **FINAL PUSH** |
| 10 | boss | - | - |
| 11 | TURRET LINE | three bolted spinners across the top, slip through the rest beats; snipers join late | toast: snipers lock on |
| 12 | SALVAGE (**rest/reward**) | half length, half enemies; three supply trails (gems, hull repair, SCORE X2, magnet) | **AMBUSH** escorted carrier + rush after the calm |
| 13 | mid-boss | - | - |
| 14 | GAUNTLET (sector 3 finale) | turrets + shield carriers + snipers; **shield-carrier escorts** (kill the gunships, flank the carrier) | wall + escort; **FINAL PUSH** (surge + wall + pincer) |
| 15 | boss | - | - |
| 16 | KAMIKAZE RUSH | drone zippers dive in straight lines, sidestep | **SOLAR FLARE** triple rush; surge at the end |
| 17 | SPIRAL DANCE | ships **spiral** out from the top centre as one arm; ring casters + snipers | two counter arms; closing spiral |
| 18 | mid-boss | - | - |
| 19 | LAST STAND (finale before THE STARBURST) | everything: wall, escorts, fuse line, spiral, rush, turret line, circular casters | **LAST STAND** banner at 60%; **FINAL PUSH** with wall + rush + pincer |
| 20 | THE STARBURST | final boss | - |

## Juice added
- **Chain explosions**: `volatile` ships (amber blink) and mines blow up neighbours in a rippling sequence; each chained kill pays score + combo and shows `CHAIN xN`.
- **Kill streaks**: kills within 0.7s build a streak; every 5th pays a flat bonus with a lime popup by the ship.
- **Banners**: wave start shows `NAME` + `WAVE n // hint`; wave clear shows a per-wave line; mid-wave events use the same banner (with the `warning` sfx) or an amber toast.

## Set pieces (`formationsSet.js`, usable via `__dbg.formation('<name>')`)
`line`, `wall`, `spiral`, `turretline`, `rush`, `escort`, `fuse`, `bloom` (plus the existing `vee sweep pincer circle swarm shower turrets snipers minefield`).

## Spawner extras
Spawn entries accept a third value = first-spawn delay (ms), so late-arriving enemies stay out of a wave's first seconds. Events: `banner`, `toast`, `form` (array staggers by `gapMs`), `supply`, `calm` (spawn lull), `surge` (spawn-rate multiplier).
