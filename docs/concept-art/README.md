# STARBURST — Neon Geometry-Wars-meets-Ikaruga

> **AI-GENERATED CONCEPT ART: not part of the game.** Every image in this folder was produced by an AI image-generation
> tool from the prompts in [PROMPTS.md](PROMPTS.md). None of it ships in the build, none of it is hand-made pixel art, and
> the game's real art is authored as ASCII sprite maps in `src/art/`. Do not present these images as screenshots or as
> hand-drawn work. The images are excluded from the proposed asset licence ([ASSET-LICENSE.md](../../ASSET-LICENSE.md)):
> copyright status of AI output varies by jurisdiction and by the generator's terms. See `docs/COMPLIANCE.md`.

Concept art for visual approval before implementation. All six screens were generated with the built-in image generation tool and visually reviewed; the shared style sheet and completed screens served as references for subsequent images. No generation failed.

## Images

- [01-gameplay-intense.png](01-gameplay-intense.png) — Mid-wave battle with the silver twin-engine player fighter, all four enemy families, magenta orb arcs, amber needle fans, and lime shards. Includes graze/combo feedback, an explosion shockwave, curved HP gauge, radial ability cooldowns, and quest progress.
- [02-title-screen.png](02-title-screen.png) — Glowing STARBURST wordmark, glass Start / Quests / Settings / Difficulty navigation, and best-run panel. Normal, Speedy, and Tank share the same faceted silhouettes and cyan thrust used throughout the set.
- [03-boss-fight.png](03-boss-fight.png) — VOID CROWN's ring-core entrance/fight with a large magenta bullet spiral and amber needle curtains. A warning strip and boss HP bar complement the shared gameplay HUD.
- [04-upgrade-screen.png](04-upgrade-screen.png) — Four between-wave glass cards present Dash, Forcefield, Phase Shift, and Speed / Heal. Phase Shift has the bright magenta raised hover state and Select action over a dimmed arena.
- [05-sprite-sheet.png](05-sprite-sheet.png) — Visual style sheet covering three player classes, four enemy types, color-coded projectile shapes/patterns, all five upgrade icons, and labeled palette swatches. This is concept reference art rather than an implementation-ready sliced atlas; illustrative stat labels are not balance specifications.
- [06-game-over.png](06-game-over.png) — Optional results screen with score, wave, combo, graze count, new-best-run highlight, Retry / Main Menu buttons, and quest progress.

## Palette

| Role | Hex |
| --- | --- |
| Deep-space navy | #070B1A |
| Violet nebula atmosphere | #20103F |
| Friendly shots, engines, UI, shield | #39E7FF |
| Basic/circular enemies, hostile orbs/rings, phase shift | #FF43C8 |
| Spread enemies/needles, warnings, heavy armor accents | #FFB547 |
| Meteor shards, speed, healing | #B7FF4A |
| White-hot cores, highlights, primary text | #F4FAFF |

Use sharp luminous cores with soft additive halos; keep dark interiors and visible negative space between projectiles. Cyan engine trails preserve the original game's identity. Layered violet nebulae and star streaks provide depth beneath the neon action.

## Typography and HUD

The generated lettering uses a wide, squared, geometric uppercase sci-fi display style with generous tracking, paired with small monospaced telemetry. It is drawn lettering, not an embedded or licensed font; choose a matching font during implementation.

The shared HUD uses slim translucent navy glass, clipped corners, cyan hairline borders, wave at upper left, score/combo at upper right, a shallow curved cyan HP gauge at lower left, and circular Dash / Forcefield / Phase Shift cooldown arcs below the playfield. Boss information occupies a separate top-center strip.

## Format and review

The generator returned native **1672 × 941 PNGs** for all six images, approximately 16:9 (within one pixel of the ideal height), above the requested 1280 × 720 logical frame. Higher resolution was requested; these are the native outputs, without upscaling.

Open [gallery.html](gallery.html) to switch between the six concepts at full width. [PROMPTS.md](PROMPTS.md) records the full generation prompts and final HUD edit. All authored repository files for this task are contained in this directory.

