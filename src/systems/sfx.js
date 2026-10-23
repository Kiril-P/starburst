import { save } from './Save.js';

/** Play a one-shot sound honouring the user's SFX volume. opts: { vol = 1, rate = 1, jitter = 0 (random detune in cents) } */
export function sfx(scene, key, opts = {}) {
    const vol = (opts.vol ?? 1) * save.soundVolume;
    if (vol <= 0 || !scene.cache.audio.exists(key)) return;
    const detune = (opts.jitter ?? 0) ? (Math.random() * 2 - 1) * opts.jitter : 0;
    scene.sound.play(key, { volume: vol, rate: opts.rate ?? 1, detune });
}
