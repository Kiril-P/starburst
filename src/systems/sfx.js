// One-shot sounds. Sample keys (Preload) and synth keys (synthSfx.js) play the same way.
// Per-key rules keep bullet spam musical instead of clipping: a cooldown (min gap between triggers), a voice cap
// (the oldest voice is stolen when exceeded) and default pitch jitter so repeats don't sound like a machine gun.
// Voices also get a little quieter the more of the same key are already sounding.
import { save } from './Save.js';
import { registerSynthSfx, SYNTH_KEYS } from './synthSfx.js';
import * as music from './music.js';
import * as react from './audioReact.js';

// gap: ms cooldown, cap: max simultaneous voices, jitter: default detune in cents
const RULES = {
    'player-shoot': { gap: 45, cap: 3, jitter: 120 },
    'enemy-shoot': { gap: 70, cap: 4, jitter: 200 },
    'enemy-death': { gap: 35, cap: 5, jitter: 250 },
    'player-damaged': { gap: 120, cap: 2 },
    graze: { gap: 55, cap: 3, jitter: 90 },
    'combo-up': { gap: 60, cap: 2 },
    pickup: { gap: 40, cap: 4, jitter: 60 },
    'button-sound': { gap: 30, cap: 3 },
    'ui-hover': { gap: 35, cap: 2, jitter: 40 },
    'ui-select': { gap: 40, cap: 2 },
    'ui-back': { gap: 40, cap: 2 },
    'shield-hit': { gap: 60, cap: 3, jitter: 150 },
    warning: { gap: 1200, cap: 1 },
    'boss-explosion': { gap: 300, cap: 2 }
};
const DEFAULT_RULE = { gap: 0, cap: 4, jitter: 0 };
const voices = new Map();     // key -> [{ snd, t }]
const lastAt = new Map();     // key -> last trigger time (ms)

/**
 * Play a one-shot honouring the SFX volume and the key's rules.
 * opts { vol = 1, rate = 1, jitter (cents, overrides the rule), gap (ms, overrides the rule), force (skip cooldown) }.
 * Returns the sound or null when skipped.
 */
export function sfx(scene, key, opts = {}) {
    const vol = (opts.vol ?? 1) * save.soundVolume;
    if (vol <= 0 || !scene.cache.audio.exists(key)) return null;
    const rule = RULES[key] || DEFAULT_RULE;
    const now = performance.now();
    if (!opts.force && now - (lastAt.get(key) ?? -1e9) < (opts.gap ?? rule.gap)) return null;
    lastAt.set(key, now);

    let list = voices.get(key);
    if (!list) voices.set(key, (list = []));
    while (list.length >= rule.cap) {
        const old = list.shift();
        if (old.snd.manager) old.snd.destroy();   // stealing: the newest trigger matters most
    }
    const jitter = opts.jitter ?? rule.jitter ?? 0;
    const detune = jitter ? (Math.random() * 2 - 1) * jitter : 0;
    const snd = scene.sound.add(key, { volume: vol / (1 + 0.18 * list.length), rate: opts.rate ?? 1, detune });
    const entry = { snd, t: now };
    list.push(entry);
    const drop = () => { const i = list.indexOf(entry); if (i >= 0) list.splice(i, 1); };
    snd.once('complete', () => { drop(); snd.destroy(); });
    snd.once('destroy', drop);
    snd.play();
    return snd;
}

/** Menu blips: 'hover' (focus moved), 'select' (activate), 'back' (close/cancel). */
export function uiSfx(scene, kind = 'select', opts = {}) {
    return sfx(scene, kind === 'hover' ? 'ui-hover' : kind === 'back' ? 'ui-back' : 'ui-select', { vol: kind === 'hover' ? 0.5 : 0.7, ...opts });
}

/**
 * One-time audio setup (Preload.create): synth buffers, master limiter, master volume, music bus, reactivity,
 * and a resume-on-first-input fallback for the browser autoplay policy.
 */
export function installAudio(game) {
    const sm = game.sound;
    if (!sm || !sm.context || game.__audioInstalled) return;
    game.__audioInstalled = true;
    const ctx = sm.context;
    registerSynthSfx(game);
    // brick-wall-ish limiter after Phaser's master volume: dozens of overlapping one-shots + music can't clip
    try {
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -4; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
        sm.masterVolumeNode.disconnect();
        sm.masterVolumeNode.connect(lim).connect(ctx.destination);
    } catch (e) { /* keep Phaser's default routing */ }
    sm.setVolume(save.masterVolume);
    music.initMusic(game);
    react.installAudioReact(game);
    if (import.meta.env.DEV) window.__audio = { music, react, sfx, uiSfx, setMasterVolume, synthKeys: SYNTH_KEYS };   // console / headless checks
    // Phaser unlocks on the first gesture; this also covers a context left suspended later (e.g. OS audio focus)
    const resume = () => { if (ctx.state === 'suspended' && !game.__blurred) ctx.resume().catch(() => {}); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, resume, { passive: true });
    game.events.on('blur', () => { game.__blurred = true; });
    game.events.on('focus', () => { game.__blurred = false; });
}

/** Apply the master volume setting (0..1) live. */
export function setMasterVolume(scene, v) {
    save.masterVolume = v;
    scene.sound.setVolume(v);
}
