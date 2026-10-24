# Asset licence

> **Status: confirmed by the owner (2026-10-24).**
> Until confirmed, treat everything below as a draft and do not rely on it.

Unless a file says otherwise, the original creative assets in this repository are licensed under
**[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)**:

- the pixel art, authored as ASCII sprite maps in `src/art/` and baked at startup (and the PNGs rendered from them:
  `public/favicon.png`, `public/icon-*.png`, `public/apple-touch-icon.png`, `public/og-image.png`, `docs/media/*`);
- the audio generated at runtime by the game's own synthesis code (no audio files ship in the build).

Attribution: "STARBURST by Kiril Petrovski" with a link to the project page.

## Not covered by this licence

- **Fonts** (Press Start 2P, Silkscreen) are SIL OFL 1.1, see `THIRD_PARTY_NOTICES.md` and `licenses/`.
- **`docs/concept-art/`** was generated with an AI image tool and is not part of the game. It is provided for reference only,
  see `docs/concept-art/README.md`. Whether AI-generated output can be copyrighted or licensed depends on jurisdiction, so no
  licence is claimed for it.
- Phaser, Vite and other dependencies: their own licences, see `THIRD_PARTY_NOTICES.md`.
