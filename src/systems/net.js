// The only place the game talks to a server (the online boards + anonymous telemetry, see docs/PRIVACY.md and server/).
// Everything is optional: with no API configured at build time (VITE_API_URL empty) this module does nothing and the
// game makes no network request at all. Calls never throw and never block gameplay; a failure just returns null.
import { save } from './Save.js';

const BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
// dev builds are tagged so the server never ranks them or mixes them into balance data (tools/online-smoke.mjs overrides it)
export const ENV = import.meta.env.PROD || import.meta.env.VITE_TELEMETRY_ENV === 'prod' ? 'prod' : 'dev';
const TIMEOUT_MS = 6000;

/** an API was configured at build time (the WORLD board and the settings switch only exist then) */
export const apiConfigured = BASE !== '';
/** configured AND the player has not switched online features off */
export const online = () => apiConfigured && save.online;

/** { status, data } or null when the request failed (offline, blocked, timed out) */
async function call(path, init) {
    if (!apiConfigured) return null;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : 0;
    try {
        const res = await fetch(BASE + path, { ...init, signal: ctl?.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        let data = null;
        try { data = await res.json(); } catch (e) { /* empty / non-JSON body */ }
        return { status: res.status, data };
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export const getJson = (path) => (online() ? call(path, { method: 'GET' }) : Promise.resolve(null));
export const postJson = (path, body) => (online()
    ? call(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'text/plain' }, keepalive: true })   // text/plain: no CORS preflight
    : Promise.resolve(null));
