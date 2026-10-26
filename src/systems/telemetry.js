// Anonymous telemetry + run submission (docs/PRIVACY.md). Always on unless the player switches ONLINE off in SETTINGS.
//   session  once per page load: input device, screen size, quality tier, language (2 letters), installed / embedded
//   error    uncaught errors, at most 5 per session
//   run      one per finished or abandoned run (see runlog.js): the server keeps it for balance data and, when the run is
//            eligible, on the public boards under the player's 3-letter callsign
// No cookies, no ids that outlive a run, no IP / user agent stored (the server never records them). Runs that cannot be
// sent (offline, rate limited) wait in the save's outbox and go out on the next launch.
import { save } from './Save.js';
import { BUILD, ENV, online, postJson } from './net.js';
import { touchWanted } from '../ui/TouchControls.js';

let started = false;

const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } };
const embedded = () => { try { return window.top !== window; } catch (e) { return true; } };

/** call once the menu is up: session event, error hook, outbox flush */
export function startTelemetry() {
    if (started || !online()) return;
    started = true;
    const dev = touchWanted() ? 'touch' : 'keyboard';
    postJson('/v1/event', {
        kind: 'session', build: BUILD, env: ENV,
        data: { device: dev, quality: save.quality, w: innerWidth, h: innerHeight, dpr: Math.round(devicePixelRatio || 1), lang: navigator.language || '', pwa: standalone(), embed: embedded(), lowFps: save.autoLow }
    });
    let errors = 0;
    const report = (msg, at) => {
        if (!online() || errors >= 5) return;
        errors++;
        postJson('/v1/event', { kind: 'error', build: BUILD, env: ENV, data: { msg, at: String(at || '').replace(/^https?:\/\/[^/]+/, '') } });
    };
    addEventListener('error', (e) => report(e.message, `${e.filename}:${e.lineno}`));
    addEventListener('unhandledrejection', (e) => report(String(e.reason?.message ?? e.reason ?? 'rejection'), ''));
    setTimeout(flushOutbox, 3000);
}

/**
 * Send a finished run. Resolves { ranked, rank } (rank 0 = not on a board), { queued: true } when it will be retried later,
 * or null when nothing was sent (online features are off).
 */
export async function submitRun(payload, name = save.callsign) {
    if (!online()) return null;
    const body = { ...payload, name: name || '' };
    const res = await postJson('/v1/run', body);
    if (res && res.status === 200 && res.data?.ok) {
        if (res.data.ranked) save.worldRuns = [...save.worldRuns, body.id];
        return { ranked: !!res.data.ranked, rank: res.data.rank || 0 };
    }
    if (!res || res.status === 429 || res.status >= 500) { save.outbox = [...save.outbox, body]; return { queued: true }; }
    return { ranked: false, rank: 0 };   // 4xx: the server refused it, retrying would not help
}

export async function flushOutbox() {
    if (!online()) return;
    const box = save.outbox;
    if (!box.length) return;
    save.outbox = [];
    const keep = [];
    for (const body of box.slice(0, 5)) {
        const res = await postJson('/v1/run', body);
        if (res && res.status === 200 && res.data?.ok) { if (res.data.ranked) save.worldRuns = [...save.worldRuns, body.id]; continue; }
        if (!res || res.status === 429 || res.status >= 500) keep.push(body);
    }
    save.outbox = [...keep, ...box.slice(5), ...save.outbox];
}
