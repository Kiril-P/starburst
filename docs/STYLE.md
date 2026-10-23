# STARBURST — Pixel Art Style Bible

This is the single source of truth for how everything looks. If a decision isn't covered, copy the closest existing sprite.

**Reference:** `docs/concept-art/*.png` shows the target **composition, palette, mood and HUD layout**. The concept art is painted, not pixel art — we reproduce its *look and feel* as honest, hand-placed pixel art. The old game's art (`public/assets/images/sprites/`, viewable in git history) is chunky pixel art with purple/magenta enemy ships, silver player ships and fiery meteors; keep that DNA (silver hero ships, purple-magenta enemies, burning meteors) but cleaner, more consistent and neon.

## Rules of the grid
- Native resolution **640×360**. The canvas is scaled with nearest-neighbour (2× at 1280×720). **1 sprite pixel = 1 native pixel. Never scale a sprite by anything but 1** (exception: pure transparency/tint effects, and `shockwave`/glow textures which are meant to be stretched). No "mixels": never mix pixel sizes within one screen.
- Positions are integers. Sprites are drawn facing **up** (player) or **down** (enemies). Mirroring is fine; non-90° rotation only for bullets/meteors/debris.
- **No anti-aliasing, no gradients, no semi-transparent pixels in sprites.** Transparency is on/off. Soft glow = *dither* (checkerboard) + the additive blend mode on a separate halo, never alpha-blended blurry pixels. (Glow textures `glow_*` are dithered white discs tinted at runtime.)
- Palette: only the characters in `src/art/palette.js`. Each hue is a 4-step ramp (dark → mid → bright → highlight). Hulls use the 6-step steel ramp `1–6`.

## Colour meaning (never break this — it's gameplay readability)
| Colour | Means |
|---|---|
| **Cyan** `n c C b` | player, friendly bullets, engines, shields, UI chrome |
| **Magenta** `p m M q` | hostile energy: enemy bullets (orbs/rings), basic/circular enemies, phase shift |
| **Amber** `y a A z` | spread enemies & needles, warnings, fire, "heads-up" |
| **Lime** `g l L j` | meteors' crystals/shards, speed, healing |
| **Red** `r R` | damage, low HP, danger |
| **Violet** `u v V x` | space, nebula, rock |
| **Steel** `1–6` + white `w` | ship hulls, metal, text |

## Ship class accents
All player ships are silver/steel hulls (ramp `1–6`) with a class accent: **normal = cyan** (balanced), **speedy = lime** (slim, swept, fast), **tank = amber** (wide, armoured, heavy plating). Engine flames, thruster particles and the HUD portrait use the accent colour. Cyan remains the colour of player *bullets/shields* for every class.

## Light and shape
- Light comes from the **upper-left**. Hull ramp: highlight upper-left edges (5,6), mid (3,4) body, shade (1,2) lower-right.
- Ships/enemies/meteors get a **1px dark outline** (`k`) *except* where an emissive part (engine, cannon glow, crystal) breaks the silhouette. Emissive pixels are the brightest ramp step + a single dark-ramp pixel halo ring around them.
- Bullets: **no outline**. Structure = white-hot core pixel(s) `w`/highlight → bright → mid → dark-ramp rim. Silhouettes must read in <100 ms at 2×: orbs round, needles long & thin, rings hollow, shards diamond. Sizes (px): orb 5/7/11, needle 3×11, ring 9, shard 5×9.
- Player hitbox is tiny (≈3px radius) and drawn as the `hitbox_dot` marker so the player trusts it. Visual size ≠ hitbox.
- Silhouette first. Each enemy type must be identifiable as a solid black shape.
- Animation: 2–4 frames, 6–14 fps, subtle (engine flicker, light pulse, 1px bob). Ship bank frames: 0 straight, 1 left, 2 right.

## UI style
- Panels: 1px cyan border (`C` on `n`/`c` shading) with **chamfered (clipped) corners made by stair-step pixels**, fill `k`@~85% (alpha is applied by the game object, not the texture), tiny corner ticks. Active/hot variant uses brighter `b`/`w` border + inner glow row.
- Buttons: same family; states normal / hover (brighter border, 1px lift) / press (1px down) / disabled (steel ramp).
- Text: **Press Start 2P** (`font: 'TITLE'`) for headings (sizes 8/16/24), **Silkscreen** (`font: 'UI'`) for body/labels (sizes 8/16). Never other sizes. Colour from the palette hexes. 1px dark drop shadow (done by `pxText`). All text at integer positions.
- Numbers: score uses thousands separators; combo shown `x8`.
- HUD layout (see concept 01): wave top-left, score+combo top-right, HP curved/segmented bar bottom-left, three ability icons with radial cooldown bottom-centre, quest tracker bottom-right.

## Effects language
- Everything that glows uses `blendMode: ADD` over dark space. Particles are **square pixels** (`px1/px2/px3`), never round/soft.
- Explosions: white → amber → orange → red → violet-smoke, 6–8 frames, plus shockwave ring + a handful of square debris + 1–3px screen shake. Size scales with enemy value.
- Hit-stop (30–50 ms) on kills of big targets and on player damage. Screen flash only when `save.flashEffects` is on; shake scaled by `save.screenShake`.
- Parallax background (see fx-bg task): 3–4 layers, nebula built from **dithered 4-tone** ramps (u v V x range), stars as 1px/2px crosses, speed streaks of 1px×N. No smooth gradients: use ordered 4×4 Bayer dithering.

## Process for pixel art authors
Author sprites as text maps in `src/art/sprites/*.js` (format in `src/art/bake.js`), then run `node tools/render-sprites.mjs <module>` and **Read the generated PNG** (`tmp/sprites/<module>.big.png` for detail, `.actual.png` for true size). Iterate until it looks good *at actual size*. Compare against the concept art and against your sibling sprites for consistency (same outline rule, same light direction, same ramp usage). Silhouette and readability beat detail.
