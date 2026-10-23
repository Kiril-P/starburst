import { defineConfig } from 'vite';

export default defineConfig({
    // Relative base so the build works from any sub-path (itch.io, kpetrovski.me/play/starburst/)
    base: './',
    build: {
        chunkSizeWarningLimit: 2000
    }
});
