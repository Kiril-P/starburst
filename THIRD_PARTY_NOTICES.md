# Third-party notices

STARBURST bundles the components below. Their licence texts are in [`licenses/`](licenses/) and a combined copy ships
with every build as `THIRD_PARTY_LICENSES.txt` (next to `index.html`). Audited with `npx license-checker` on 2026-10-24
(lockfile as committed; `npm audit` reported 0 known vulnerabilities, production and full).

## Shipped in the game (production dependencies)

| Component | Version | Licence | Copyright / author | Notes |
|---|---|---|---|---|
| [Phaser](https://phaser.io) | 3.90.0 | MIT | Richard Davey, Phaser Studio Inc. | game engine, bundled into `assets/index-*.js` |
| [eventemitter3](https://github.com/primus/eventemitter3) | 5.0.4 | MIT | Arnout Kazemier | Phaser dependency (the only transitive production dependency) |
| [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) via `@fontsource/press-start-2p` | 5.3.0 | SIL OFL 1.1 | The Press Start 2P Project Authors (CodeMan38), Reserved Font Name "Press Start 2P" | `.woff`/`.woff2` subsets in `dist/assets/` |
| [Silkscreen](https://fonts.google.com/specimen/Silkscreen) via `@fontsource/silkscreen` | 5.3.0 | SIL OFL 1.1 | The Silkscreen Project Authors (Jason Kottke) | `.woff`/`.woff2` latin subset in `dist/assets/` |

**Fonts, OFL 1.1.** Bundling the fonts inside a game and redistributing them unmodified with their licence text is
allowed (OFL conditions 1 and 2). The licence text and copyright lines travel with the build
(`THIRD_PARTY_LICENSES.txt`). The fonts are not sold on their own and are not renamed. Fontsource serves Google Fonts
files converted to WOFF/WOFF2 and split into unicode subsets; this is the same transformation Google Fonts applies, but
strictly speaking subsetting is a "modification" under OFL, which only matters for the Reserved Font Name. Risk: low.

## Build and development tools (not shipped in the game)

| Component | Licence | Notes |
|---|---|---|
| Vite 8 (and its bundled toolchain) | MIT | build tool |
| pngjs | MIT | icon generation (`tools/make-favicon.mjs`) |
| puppeteer-core, @puppeteer/browsers, chromium-bidi, webdriver-bidi-protocol | Apache-2.0 | headless smoke tests |
| lightningcss (+ platform binary) | **MPL-2.0** | CSS minifier used by Vite at build time. File-level copyleft, applies only if you modify lightningcss itself; we use it unmodified and do not ship it |
| devtools-protocol, source-map-js | BSD-3-Clause | |
| picocolors, cliui, get-caller-file, y18n, yargs-parser | ISC | |
| detect-libc | Apache-2.0 | |
| ~29 other MIT packages | MIT | |

Summary of `license-checker --summary` (all installed packages incl. dev, 46 entries counting this package): MIT 29, Apache-2.0 5, ISC 5, OFL-1.1 2,
BSD-3-Clause 2, MPL-2.0 2, plus this package itself. **No GPL, AGPL, LGPL, SSPL or unknown licences found.** (The
"UNLICENSED" row `license-checker` printed was this project, fixed by adding `"license": "MIT"` to `package.json`, see
[docs/COMPLIANCE.md](docs/COMPLIANCE.md) for the pending owner confirmation.)

Re-run: `npx license-checker --production --csv` and `npm audit --omit=dev`.

## Not third-party, but worth stating

- **Pixel art**: authored in this repository as ASCII sprite maps (`src/art/sprites/*.js`) and baked to textures at
  startup. The icons and favicon are rendered by `tools/make-favicon.mjs`; `public/og-image.png` is a screenshot of the
  game's own title screen. No sprite sheets or images from external sources are included in the current tree.
- **Audio**: synthesized by the game's own code at runtime; no audio files are shipped. (Earlier versions used audio
  from the Bullet Hell Jam 6 release whose licence could not be established; it has been removed, see
  [docs/COMPLIANCE.md](docs/COMPLIANCE.md).)
- **`docs/concept-art/`**: AI-generated reference images, not part of the game. See its README.
