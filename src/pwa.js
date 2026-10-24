// Registers the offline service worker (public/sw.js) in production builds only: in dev it would cache Vite's unhashed
// modules and serve stale code. Loaded as its own entry from index.html so the game bootstrap stays untouched.
// __BUILD_ID__ is injected by vite.config.js (package version + build timestamp).

// Tell the worker which same-origin files this page already loaded (they were fetched before it was installed).
function sendLoaded(reg) {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
    urls.push(location.href.split('#')[0]);
    if (reg.active) reg.active.postMessage({ type: 'cache', urls });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`sw.js?v=${__BUILD_ID__}`)
            .then(() => navigator.serviceWorker.ready)
            .then((reg) => {
                sendLoaded(reg);
                // audio and late chunks arrive after 'load' while Preload runs; send again once the game is up
                setTimeout(() => sendLoaded(reg), 8000);
            })
            .catch(() => { /* private mode / blocked: the game works fine without offline support */ });
    });
}
