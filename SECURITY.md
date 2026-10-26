# Security policy

STARBURST is a client-side browser game: no accounts, and no network calls unless the build sets `VITE_API_URL`, in which case it
talks to exactly one https origin (the CSP `connect-src` says which) for the world boards and anonymous run statistics
(`docs/PRIVACY.md`, backend in `server/`). Settings and progress are stored in your browser's `localStorage`.

## Reporting a problem

Please report security issues privately rather than in a public issue:

- GitHub: use **Security → Report a vulnerability** on <https://github.com/Kiril-P/starburst> (private advisory), or
- open an issue titled "Security contact request" without details and the maintainer will reach out.

Include the game URL or version (`package.json` version), browser, and steps to reproduce. You can expect an
acknowledgement within a week. This is a hobby project, so fixes are best-effort.

## Scope

In scope: the shipped game bundle, the service worker (`public/sw.js`), the CSP in `index.html`, the build tooling, and the API in `server/`
(input validation, ranking, the admin endpoint). Forged leaderboard scores are a known limit, not a vulnerability: see "Anti-cheat" in `server/README.md`.
Out of scope: third-party hosting platforms (itch.io, GitHub Pages) and vulnerabilities in browsers.
