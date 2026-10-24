# Contributing

Bug reports and small fixes are welcome.

1. `npm ci`, then `npm run dev`.
2. Before opening a PR run `npm run check`, `npm run build`, `npm run test:smoke` and `npm run compliance`.
3. Read `docs/STYLE.md` and `docs/ARCHITECTURE.md` first. Pixel art is authored as ASCII sprite maps in `src/art/`.
4. **Assets:** do not add images, audio or fonts you did not create unless their licence allows redistribution, and list
   them (with source and licence) in `THIRD_PARTY_NOTICES.md`. New binary files under `public/` or `src/` must be added to
   `docs/ASSETS.allowlist`, otherwise `npm run compliance` fails. Do not submit AI-generated assets.
5. By contributing you agree your code is licensed under the project licence (see `LICENSE`).
