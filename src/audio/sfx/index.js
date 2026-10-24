// Procedural sound effects: every key the game plays is rendered from a recipe (no sample files anywhere).
// Recipes live in recipes*.js; renderSfx() turns one into mono Float32 samples. Phaser-free, so tools/render-audio.mjs
// can render them in Node and the audio lab can play them on any AudioContext.
import { kit } from './kit.js';
import { BASE } from './recipesBase.js';
import { COMBAT } from './recipesCombat.js';
import { GAME } from './recipesGame.js';

export const RECIPES = { ...BASE, ...COMBAT, ...GAME };
export const SFX_KEYS = Object.keys(RECIPES);
const RMS_CAP = 0.16;   // -16 dBFS

/**
 * Render a recipe to Float32 samples, normalised to its `peak` with a 4 ms de-click fade at the end. Loop recipes are
 * rendered over two cycles and the second is kept, so filter state carries over and the buffer wraps without a click.
 */
export function renderSfx(key, sr) {
    const r = RECIPES[key];
    const n = Math.ceil(r.len * sr), out = new Float32Array(n), fn = r.fn(kit(sr));
    let max = 0;
    if (r.loop) {
        for (let i = 0; i < n; i++) fn(i / sr);              // warm-up cycle
        for (let i = 0; i < n; i++) { const v = fn(i / sr); out[i] = v; max = Math.max(max, Math.abs(v)); }
    } else {
        for (let i = 0; i < n; i++) { const v = fn(i / sr); out[i] = v; max = Math.max(max, Math.abs(v)); }
    }
    // loudness-consistent: scale to the recipe's peak, but never past its RMS cap (dense tonal blips are far louder than
    // noise bursts at the same peak), so one volume number means roughly the same loudness for every key
    let sq = 0;
    for (let i = 0; i < n; i++) sq += out[i] * out[i];
    const rms = Math.sqrt(sq / n) || 1, g = max > 0 ? Math.min(r.peak / max, (r.rms ?? RMS_CAP) / rms) : 0, fade = r.loop ? 0 : Math.min(n, Math.round(sr * 0.004));
    for (let i = 0; i < n; i++) out[i] *= g * (i >= n - fade ? (n - i) / fade : 1);
    return out;
}

/** Bake recipes into AudioBuffers: add(key, buffer) is called for each key `has` says is missing. Returns the keys. */
export function bakeSfx(ctx, has, add, keys = SFX_KEYS) {
    const done = [];
    for (const key of keys) {
        if (has(key)) continue;
        const data = renderSfx(key, ctx.sampleRate), buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buf.copyToChannel(data, 0);
        add(key, buf);
        done.push(key);
    }
    return done;
}
