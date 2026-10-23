# itch.io page draft

Copy-paste material for https://kirilp.itch.io/starburst. Upload: zip the *contents* of `dist/` (after `npm run build`,
or download the `starburst-dist` artifact from CI) with `index.html` at the zip root.

## Page settings

- **Kind of project:** HTML
- **Embed:** "Embed in page", viewport **1280 × 720**. Turn on "Mobile friendly" (orientation: landscape) and "Fullscreen button". Leave "Automatically start on page load" off so audio starts after a click.
- **SharedArrayBuffer support:** off (not needed)
- **Classification:** Games → Shooter / Bullet hell
- **Genre:** Shooter
- **Tags:** bullet-hell, shmup, pixel-art, arcade, retro, neon, space, roguelite, 2d, short
- **Input methods:** Keyboard, Mouse, Xbox controller, Touchscreen
- **Accessibility:** Configurable controls, Color-blind friendly, High-contrast
- **Average session:** A few minutes
- **Languages:** English
- **Cover image:** 630 × 500 crop of `public/og-image.png`. Screenshots: `docs/media/title.png`, `gameplay.png`, `boss.png`. GIF: `docs/media/gameplay.gif`.
- **Theme colours (Edit theme):** background `#070b1a`, text `#dbe6ff`, links/buttons `#39e7ff`, secondary `#ff43c8`

## Short description (tagline)

Dodge the neon storm. Graze for combo. Break the bosses.

## Page text

**STARBURST** is a fast neon pixel-art bullet hell for your browser.

Fly through timed waves of enemy fire, slip through gaps a few pixels wide, and *graze* bullets on purpose. Every near
miss feeds your combo multiplier. After each wave, pick an upgrade: unlock a **dash**, a bullet-erasing **forcefield**
or a **phase shift** that lets you pass through everything, then level them up. Every fifth wave a boss arrives with
telegraphed attack phases. Survive past the authored waves and the endless mode keeps raising the pressure.

**Features**
- Three ships: balanced **Pulsar**, the fast **Nova Dart**, and the armoured **Titan**
- Readable patterns: orbs, rings, needles, and shards each have their own silhouette, and your true hitbox is always visible
- Bosses with multiple phases, quests to complete, three difficulty levels, and best-run tracking
- Keyboard, mouse aim, gamepad, and touch controls
- Installable and playable offline

**Accessibility**
- Fully rebindable keys (two per action)
- Mouse aim or movement aim
- High-contrast bullets, plus an orange colour-blind-safe palette that keeps hostile bullets distinct from your cyan shots
- Assist mode: slower bullets, more hull, wider graze window (clearly labelled, and kept off leaderboards)
- Flash effects toggle, screen-shake slider, low graphics mode, and an FPS counter

**Controls**
- Move: Arrow keys / WASD · Fire: Space (hold) · Dash: Shift · Forcefield: Z · Phase shift: X
- Pause: Esc · Fullscreen: F
- Gamepad: stick to move, A to fire, LB/RB to dash, X for forcefield, Y for phase shift, B/Start to pause
- Touch: drag on the left side to move, buttons on the right side

Originally made for Bullet Hell Jam 6, then rebuilt from scratch.

## Devlog post draft: "STARBURST 2.0 is out"

STARBURST has been rebuilt. Here's what's new:
- New pixel art for everything
- Bosses
- Upgrades between waves
- Quests
- Gamepad and touch support
- A full accessibility menu: rebinding, mouse aim, high-contrast and colour-blind-safe bullets, and assist mode

It also works offline once loaded. Have fun, and tell me your best wave!
