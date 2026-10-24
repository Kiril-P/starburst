// One-shot sounds. Every key is a procedural recipe (audio/sfx) baked into Phaser's audio cache; sfx() plays them.
// Per-key rules keep bullet spam musical instead of clipping or tiring: a cooldown (min gap between triggers), a voice
// cap (the oldest voice is stolen when exceeded), default pitch jitter so repeats don't sound like a machine gun, and
// each extra voice of the same key plays a little quieter. A global budget drops the lowest-priority sounds (shots,
// grazes) first when many voices are already sounding, and nothing is started while the tab is hidden or audio is
// suspended (otherwise the queued sounds would all burst out on return).
import { save } from './Save.js';
import { registerSynthSfx, ensureSynthSfx, SYNTH_KEYS } from './synthSfx.js';
import * as music from './music.js';
import * as react from './audioReact.js';
import { installAudioLab } from './audioDebug.js';

// gap: ms cooldown, cap: max simultaneous voices, jitter: default detune in cents
const RULES = {
    'player-shoot': { gap: 45, cap: 3, jitter: 120 },
    'shoot-spread': { gap: 60, cap: 3, jitter: 100 },
    'shoot-lance': { gap: 70, cap: 2, jitter: 80 },
    'shoot-missile': { gap: 90, cap: 3, jitter: 150 },
    'shoot-drone': { gap: 60, cap: 2, jitter: 200 },
    'charge-tick': { gap: 80, cap: 2 },
    'charge-blast': { gap: 150, cap: 2, jitter: 60 },
    'enemy-shoot': { gap: 70, cap: 4, jitter: 200 },
    'enemy-death': { gap: 35, cap: 5, jitter: 250 },
    'enemy-death-big': { gap: 120, cap: 2, jitter: 120 },
    'chain-pop': { gap: 45, cap: 4, jitter: 0 },
    streak: { gap: 250, cap: 1 },
    banner: { gap: 600, cap: 1 },
    'player-damaged': { gap: 120, cap: 2 },
    graze: { gap: 55, cap: 3, jitter: 90 },
    'combo-up': { gap: 60, cap: 2 },
    pickup: { gap: 40, cap: 4, jitter: 0 },
    'pickup-repair': { gap: 200, cap: 1 },
    'pickup-magnet': { gap: 200, cap: 1 },
    'pickup-rapid': { gap: 200, cap: 1 },
    'pickup-x2': { gap: 200, cap: 1 },
    'pickup-shield': { gap: 200, cap: 1 },
    'low-hp': { gap: 700, cap: 1 },
    'boss-phase': { gap: 400, cap: 1 },
    'boss-death': { gap: 800, cap: 1 },
    'button-sound': { gap: 30, cap: 3 },
    'ui-hover': { gap: 35, cap: 2, jitter: 40 },
    'ui-select': { gap: 40, cap: 2 },
    'ui-back': { gap: 40, cap: 2 },
    'upgrade-card': { gap: 60, cap: 3, jitter: 30 },
    'shield-hit': { gap: 60, cap: 3, jitter: 150 },
    warning: { gap: 1200, cap: 1 },
    'boss-explosion': { gap: 300, cap: 2 },
    'boss-stinger': { gap: 400, cap: 1 }
};
const DEFAULT_RULE = { gap: 0, cap: 4, jitter: 0 };
// when this many voices are already sounding, these are dropped first (the sounds that fire most and matter least)
const LOW_PRIORITY = new Set(['player-shoot', 'shoot-spread', 'shoot-lance', 'shoot-missile', 'shoot-drone', 'enemy-shoot', 'graze', 'ui-hover', 'enemy-death']);
const BUDGET = 20;
const voices = new Map();     // key -> [{ snd, t }]
const lastAt = new Map();     // key -> last trigger time (ms)
let active = 0;               // voices sounding across all keys

/**
 * Play a one-shot honouring the SFX volume and the key's rules.
 * opts { vol = 1, rate = 1, jitter (cents, overrides the rule), gap (ms, overrides the rule), force (skip cooldown) }.
 * Returns the sound or null when skipped.
 */
export function sfx(scene, key, opts = {}) {
    const vol = (opts.vol ?? 1) * save.soundVolume;
    if (vol <= 0 || document.hidden || scene.game.__blurred) return null;
    const ctx = scene.sound.context;
    if (ctx && ctx.state === 'closed') return null;
    if (!ensureSynthSfx(scene.game, key)) return null;
    const rule = RULES[key] || DEFAULT_RULE;
    if (active >= BUDGET && !opts.force && LOW_PRIORITY.has(key)) return null;
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
    active++;
    let done = false;
    const drop = () => { if (done) return; done = true; active--; const i = list.indexOf(entry); if (i >= 0) list.splice(i, 1); };
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
    registerSynthSfx(game);   // time-sliced: menu sounds now, the rest in idle slices
    // brick-wall-ish limiter after Phaser's master volume: dozens of overlapping one-shots + music can't clip
    // (a gentle glue stage first: loud sfx pull the music down a little, which is what keeps it "under" them)
    try {
        const glue = ctx.createDynamicsCompressor();
        glue.threshold.value = -16; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.25;
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -4; lim.knee.value = 4; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
        sm.masterVolumeNode.disconnect();
        sm.masterVolumeNode.connect(glue).connect(lim).connect(ctx.destination);
    } catch (e) { /* keep Phaser's default routing */ }
    sm.setVolume(save.masterVolume);
    music.initMusic(game);
    react.installAudioReact(game);
    if (import.meta.env.DEV) { window.__audio = { music, react, sfx, uiSfx, setMasterVolume, synthKeys: SYNTH_KEYS }; installAudioLab(game, sfx); }   // console / headless checks
    // Phaser unlocks on the first gesture; this also covers a context left suspended later (e.g. OS audio focus)
    // ('interrupted' is Safari's state after a phone call / lock screen)
    const resume = () => { if (ctx.state !== 'running' && ctx.state !== 'closed' && !game.__blurred && !document.hidden) ctx.resume().catch(() => {}); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, resume, { passive: true });
    // back from a hidden tab: Phaser's own focus handling resumes the context, this covers browsers that only fire visibilitychange
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { game.__blurred = false; resume(); } });
    game.events.on('blur', () => { game.__blurred = true; });
    game.events.on('focus', () => { game.__blurred = false; resume(); });
}

/** Apply the master volume setting (0..1) live. */
export function setMasterVolume(scene, v) {
    save.masterVolume = v;
    scene.sound.setVolume(v);
}
