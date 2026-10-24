// Procedural SFX registration: bakes every recipe in audio/sfx into Phaser's audio cache under its key, so
// sfx(scene, key) / scene.sound.play(key) work like they would for loaded files. There are no sample files in the
// game; see docs/AUDIO.md. Rendering costs a few ms per sound (about 200 ms in total), so the bake is time-sliced:
// a first slice at boot (menu sounds first), the rest in idle slices, and anything still missing when it is needed is
// rendered on demand by ensureSynthSfx().
import { SFX_KEYS, RECIPES, bakeSfx } from '../audio/sfx/index.js';

export const SYNTH_KEYS = SFX_KEYS;
const FIRST = ['ui-hover', 'ui-select', 'ui-back', 'button-sound', 'player-shoot', 'enemy-shoot', 'enemy-death', 'wave-complete', 'thruster-hum', 'dash', 'upgrade', 'level-up'];
const SLICE_MS = 6, BOOT_MS = 30;
const ORDER = [...FIRST, ...SFX_KEYS.filter((k) => !FIRST.includes(k))];
export const bakeStats = { ms: 0, slices: 0, keys: 0 };

/** Bake recipes (time-sliced). Returns immediately after the first slice; `onDone` fires when everything is baked. */
export function registerSynthSfx(game, onDone) {
    const ctx = game.sound && game.sound.context;
    if (!ctx) return;
    const has = (k) => game.cache.audio.exists(k), add = (k, buf) => game.cache.audio.add(k, buf);
    const pending = ORDER.filter((k) => !has(k));
    const slice = (budget) => {
        const t0 = performance.now();
        bakeStats.slices++;
        while (pending.length && performance.now() - t0 < budget) { bakeSfx(ctx, has, add, [pending.shift()]); bakeStats.keys++; }
        bakeStats.ms += performance.now() - t0;
        if (pending.length) setTimeout(() => slice(SLICE_MS), 0); else if (onDone) onDone();
    };
    slice(BOOT_MS);
}

/** Make sure one key exists in the cache, rendering it now if the background bake hasn't reached it. */
export function ensureSynthSfx(game, key) {
    if (game.cache.audio.exists(key)) return true;
    if (!RECIPES[key] || !game.sound.context) return false;
    bakeSfx(game.sound.context, () => false, (k, buf) => game.cache.audio.add(k, buf), [key]);
    return true;
}
