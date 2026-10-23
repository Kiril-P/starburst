# STARBURST v2 — Architecture & Contracts

Phaser 3.90 + Vite. Native 640×360, pixel-art. Read `docs/STYLE.md` first. Old (v1) code for reference lives in `legacy/` (800×600, messy, **do not import from it** — read it to preserve mechanics/behaviour, then write clean code).

## Layout
```
src/config.js            W,H,DEPTH,FONT constants
src/game.js              Phaser config  (+ window.__game in dev)
src/scenes/              Boot, Preload (loads audio, bakes art), MainMenu, Game, GameOver (+ extra scenes registered in scenes/index.js)
src/art/palette.js       THE palette
src/art/bake.js          text-map -> texture baker
src/art/contract.js      every texture key + size the code may use   <-- the interface between art and code
src/art/placeholder.js   auto labelled placeholder for contract keys that aren't drawn yet
src/art/sprites/*.js     pixel art (ships, projectiles, enemies, fx, icons, ui)
src/fx/Fx.js, Background.js
src/ui/text.js (pxText), widgets.js, Hud.js, UpgradeScreen.js
src/systems/Save.js (persistence), sfx.js (play sounds), + gameplay systems
src/objects/             Player, Enemy types, bullets, WaveManager (gameplay)
tools/render-sprites.mjs LOOK at sprites;  tools/shot.mjs headless screenshots of the running game
```

## Module ownership (do NOT edit files you don't own; ask via your final report if you need something changed)
| Agent | Owns |
|---|---|
| art-ships | `src/art/sprites/ships.js` |
| art-enemies | `src/art/sprites/enemies.js`, `src/art/sprites/projectiles.js` |
| art-ui | `src/art/sprites/icons.js`, `src/art/sprites/ui.js` |
| fx-bg | `src/art/sprites/fx.js`, `src/fx/*` |
| ui | `src/ui/widgets.js`, `src/ui/Hud.js`, `src/ui/UpgradeScreen.js`, `src/ui/PauseMenu.js`, `src/scenes/GameOver.js` (and `src/ui/text.js` if it needs a fix) |
| menu | `src/scenes/MainMenu.js` + any new menu scenes (Settings, Quests, ...) + `src/systems/quests.js`; registers extra scenes in `src/scenes/index.js` |
| gameplay | `src/scenes/Game.js`, `src/objects/*`, `src/systems/{difficulty,upgrades,combo,...}.js` |
| lead (me) | config, palette, bake, contract (art agents may edit *their own* lines in `contract.js` if a size changes), Save, Preload, docs, tools |

## Interfaces (stubs exist for all of them so every module runs standalone)
- **Fx** (`src/fx/Fx.js`) — `new Fx(scene)`; `explosion(x,y,size,palette)`, `hitSpark`, `shockwave`, `debris`, `floatText`, `shake`, `hitStop`, `flash`, `grazeSpark`, `muzzle`, `slowmo`, `update(dt)`, `destroy()`. See the stub for exact signatures. The Game scene creates one and passes it to everything that needs it.
- **Background** — `new Background(scene,{biome})`, `update(dt,intensity)`, `setBiome(i,fadeMs)`, `pulse(strength)`, `destroy()`.
- **Hud** — `new Hud(scene)`, `update(state)` every frame (state shape documented in the stub), `announce(title,sub)`, `toast(text,color)`, `destroy()`.
- **UpgradeScreen** — `new UpgradeScreen(scene, options, onPick)`; option = `{id,title,desc,icon,tag}`.
- **widgets** — `createPanel`, `Button`, `MenuNav`, `createBar`, `createSlider`, `createToggle` (stub shows the contract).
- **GameOver** scene — `scene.start('GameOver', { score, wave, stats:{graze,maxCombo,kills} })`; it calls `save.recordRun`.
- **Scenes** — `scene.start('Game')` reads `save.ship` and `save.difficulty`; Game ends with `scene.start('GameOver', ...)`.
- **Textures** — only keys in `src/art/contract.js`. Static sprite: `add.image(x,y,key)`; multi-frame: `add.sprite(x,y,key,frameIndex)` or `.play(key)` for ones with `fps` (animations are registered under the same key as the texture). Variants: `bullet_orb_m_amber`.
- **Audio keys** (all loaded in Preload): music `title-music`, `main-music`; sfx `button-sound player-shoot enemy-shoot enemy-death player-death player-damaged thruster-hum wave-complete dash dash-alt forcefield phase-shift`. Play with `sfx(scene,key,{vol,rate,jitter})` from `systems/sfx.js`; music volume from `save.musicVolume`.
- **Save** (`systems/Save.js`) — the only place that touches localStorage.

## Rules
1. Pixel-perfect: integer positions, scale 1, `roundPixels`. Text only via `pxText`. Colours from `COLORS`/`PALETTE`.
2. Depth values from `DEPTH`. No magic numbers for layout that relate to screen size: use `W`/`H`.
3. Clean small modules (aim < 300 lines/file). No giant scenes. Comments explain *why*.
4. Performance: pool bullets and particles; avoid per-frame allocations in hot loops; 60 fps with ~300 bullets on screen.
5. Don't edit `legacy/`. Don't commit `tmp/`, `node_modules/`, `dist/`.
6. Keep every file you own importable even when other modules are still stubs.

## How to run / look at things
- `npm install` if `node_modules` is missing (or symlink the main checkout's). Dev server: `npx vite --port <YOUR PORT>` (run in background).
- URL `http://localhost:<port>/?scene=Game` (or `MainMenu`, `GameOver`, …) jumps straight into a scene (dev only).
- `node tools/shot.mjs --url http://localhost:<port>/?scene=Game --wait 2500 --out tmp/<you>/x.png` then **Read the PNG**. `--eval "<js using __game>"` + `--then-wait ms` to drive state; `--seq "ms::js::file;;ms::js::file"` for several shots. Errors thrown in the page are printed. Always look at your screenshots; never ship what you haven't seen.
- `node tools/render-sprites.mjs [module]` for sprite sheets (pixel authors).
