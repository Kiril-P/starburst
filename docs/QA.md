# QA pass (item #4) — what was tested, what changed

Tested headless (Chrome + SwiftShader via puppeteer) by driving the real build and reading screenshots.
Re-run the core of it any time: `npx vite --port 5173` then `node tools/qa.mjs --url http://localhost:5173`
(walks every screen, screenshots into `tmp/qa-run/`, loops play → die → retry/menu and fails on errors or growth).

## Flows covered
| Area | Result |
|---|---|
| Boot → MainMenu, ship select (←/→, A/D, click) | OK |
| Settings / Quests / Difficulty panels (open, navigate, ESC/BACKSPACE/click-outside close) | OK |
| START launch sequence → Game | OK (white flash, or fade to black with FLASH EFFECTS off) |
| Upgrade screen (wave clear via `__dbg`), keyboard + number keys | OK |
| Pause menu (ESC), QUIT needs a 2nd press | OK |
| Death → GameOver stats count-up, NEW BEST RUN, `save.recordRun` | OK |
| Restart loop ×4 (retry and menu paths) | **2 bugs fixed** (below); counts now flat |
| Window sizes 1280×720, 1366×768, 1920×1080, 800×600, 900×700, 844×390, 390×844 + live resize | **fixed** fractional scaling |
| Window blur / tab hidden during a run | **added** auto-pause |
| Console | **fixed** the lone 404 (favicon) — zero errors in dev and production build |

## Bugs found and fixed
1. **Main menu ignored the keyboard after a run** (menu → game → … → menu). `startGame()` sets `input.keyboard.enabled = false`
   and the scene's KeyboardPlugin keeps that across restarts. `MainMenu.init` now re-enables input.
2. **GameOver buttons dead on the 2nd game over.** `leaving` was never reset, so after one RETRY, later RETRY/MAIN MENU did nothing.
3. **Favicon 404** — added a pixel-art starburst favicon + apple-touch-icon (`tools/make-favicon.mjs`), description,
   theme-color, OG/Twitter tags, OG image; letterbox colour matches the game background.
4. **Uneven pixels at fractional scales** (FIT at 1.25×/2.13× makes some art pixels wider than others).
   `systems/display.js` uses the largest integer zoom when it fills ≥85% of the FIT size, FIT otherwise; touch devices always FIT.
5. **Hitbox marker invisible on the ship** — it was cyan on the cyan cockpit. Now a white core in a 1px near-black ring (`hitbox_dot`).
6. Background twinkles called `setFrame` every frame for every star (allocates + emits); now only on change.

## Leak check (4 loops, `tools/qa.mjs`)
Per step type the counts are identical across loops: Game ≈1337 children / 55 scene listeners / 1 keyboard listener,
GameOver 66 / 52 / 7, MainMenu 95 / 53 / 10; textures 167–180 depending on the scene (per-scene dynamic textures are
freed); game-level listeners 21; tweens 0 at rest; heap oscillates 70–93 MB with no trend.

## Performance (SwiftShader, so relative numbers only)
- CPU profile with ~400 bullets: main thread ~92% idle. Our code is <1% each (BulletPool.update, Background.update).
  Most JS allocation is inside Phaser's WebGL batcher (matrix temporaries) — not ours to fix.
- Bloom post-FX is the measurable cost: avg frame 18.5 ms with bloom vs 16.7 ms (vsync) without, at 400 bullets.
- No per-frame Graphics redraws in gameplay (0 `Graphics.clear` calls per frame); ~0.5 `Text.setText` changes per frame.
- **Added `Settings > GRAPHICS` AUTO / HIGH / LOW** (`systems/quality.js`). LOW = no bloom, half particle counts, half
  particle cap. AUTO starts HIGH and, during a run, drops to LOW after two 90-frame windows averaging >22 ms (remembered in
  `save.autoLow`; choosing AUTO again re-measures). Verified by feeding slow frame samples.
- **Added `Settings > SHOW FPS`** (default off): colour-coded counter at the top centre, drawn by the always-on `SysOverlay` scene.

## Input
- Movement: arrows **and WASD**. Fire SPACE, dash SHIFT, forcefield Z, phase X, pause ESC, **F = fullscreen**.
- **Gamepad** (standard mapping): stick/D-pad move & navigate, A/RT fire/confirm, B/START/BACK back & pause, LB/RB/LT dash,
  X forcefield, Y phase. Implemented as virtual key presses (`systems/virtualKeys.js`, `systems/gamepad.js`), so every menu works
  with a pad without per-scene code. Tested with a faked `navigator.getGamepads`.
- **Touch** (only on coarse-pointer touch devices, or force with `?touch=1`): floating stick on the left 45%, FIRE (hold) +
  dash / forcefield / phase buttons (dimmed until unlocked) and a pause button. Hidden while paused / dying / picking an upgrade
  so taps reach those menus. Tested with puppeteer touch events. Not tested on a real phone.

## Accessibility / readability
- FLASH EFFECTS off: Fx skips full-screen flashes (incl. the low-HP pulse), the menu launch uses a fade to black, and the
  background beat pulse is cut to 30%. SCREEN SHAKE slider scales Fx shake (0 = none) and the menu launch rumble.
- Colour-blind check: simulated deuteranopia / protanopia / tritanopia on a dense 400-bullet screenshot. Enemy bullets stay
  distinct from the player by **shape** (orbs/rings/needles/shards vs the silver ship and thin upward shots) and by the dark-ringed
  hitbox marker. Under deuteranopia magenta orbs turn pale lavender, close in hue to the player's cyan shots; acceptable because
  player shots only travel upward from the ship, but a future option could add a white outline to enemy bullets.

## Remaining / not done
- Player shots vs magenta orbs under deuteranopia (see above) — optional high-contrast bullet mode.
- Upgrade screen: the (dimmed) ship can sit between the cards and the "< > CHOOSE" hint; readable, but the player could be hidden
  or moved while the screen is up (gameplay/ui owners).
- Keyboard rebinding UI was not added (fixed layout + WASD + gamepad covers the common cases).
- Touch controls need a pass on a real device (button sizes, thumb reach, notch safe areas); portrait phones get a small letterboxed game.
- `sortByDepth` runs whenever particles spawn (every spawn sets depth on a pooled sprite); cheap now, worth batching particles
  into a Layer if particle counts grow.
