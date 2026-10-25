import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Content-Security-Policy for the production build (see docs/COMPLIANCE.md). Everything the game loads is same-origin:
// bundled JS/CSS/fonts/audio/images, Phaser decodes audio from ArrayBuffers and loads images through blob: URLs, and
// textures are built from canvases / data: URLs. No network calls, no eval, no inline scripts.
// style-src keeps 'unsafe-inline' because index.html has a small <style> block and Phaser sets element style attributes.
// (frame-ancestors cannot be set from a <meta>; itch.io and the owner's site embed the game, so it is intentionally open.)
const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' data: blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
].join('; ');

// Injected at build time only: the dev server needs inline HMR scripts and a websocket.
const cspPlugin = () => ({
    name: 'starburst-csp',
    apply: 'build',
    transformIndexHtml: () => [{
        tag: 'meta', injectTo: 'head-prepend',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }
    }]
});

export default defineConfig({
    // Relative base so the build works from any sub-path (itch.io, a portfolio sub-path, ...)
    base: './',
    // Unique per build: the service worker cache is keyed by it, so every deploy replaces the previous cache even if
    // package.json's version was not bumped (public/ files such as icons are not content-hashed).
    define: { __BUILD_ID__: JSON.stringify(`${version}-${Date.now().toString(36)}`) },
    plugins: [cspPlugin()],
    build: {
        chunkSizeWarningLimit: 2000
    }
});
