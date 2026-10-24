# Security policy

STARBURST is a client-side browser game: no server, no accounts, no network calls at runtime. The only data it stores is
settings and progress in your browser's `localStorage`.

## Reporting a problem

Please report security issues privately rather than in a public issue:

- GitHub: use **Security → Report a vulnerability** on <https://github.com/Kiril-P/starburst> (private advisory), or
- open an issue titled "Security contact request" without details and the maintainer will reach out.

Include the game URL or version (`package.json` version), browser, and steps to reproduce. You can expect an
acknowledgement within a week. This is a hobby project, so fixes are best-effort.

## Scope

In scope: the shipped game bundle, the service worker (`public/sw.js`), the CSP in `index.html`, and the build tooling.
Out of scope: third-party hosting platforms (itch.io, GitHub Pages) and vulnerabilities in browsers.
