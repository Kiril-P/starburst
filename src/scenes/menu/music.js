// Menu music. The sound manager is global, so music keeps playing across menu overlays and is found by key.
import { save } from '../../systems/Save.js';

const MUSIC_KEYS = ['title-music', 'main-music'];

const playing = (scene, key) => scene.sound.getAll(key).filter((s) => s.isPlaying);

/** Start the looping title theme (unless it is already playing, e.g. GameOver started it). Stops gameplay music. */
export function playTitleMusic(scene) {
    if (!scene.cache.audio.exists('title-music')) return null;
    scene.sound.getAll('main-music').forEach((s) => s.stop());
    const current = playing(scene, 'title-music')[0];
    if (current) return current;
    scene.sound.getAll('title-music').forEach((s) => s.destroy());
    const music = scene.sound.add('title-music', { loop: true, volume: 0 });
    music.play();
    // short fade-in so the first note doesn't slap
    scene.tweens.add({ targets: music, volume: save.musicVolume, duration: 900 });
    return music;
}

/** Apply a new music volume to whatever is playing right now (live preview from the settings slider). */
export function setMusicVolume(scene, v) {
    for (const key of MUSIC_KEYS) for (const s of scene.sound.getAll(key)) {
        scene.tweens.killTweensOf(s);
        s.setVolume(v);
    }
}

/** Fade the title theme out and stop it (START transition). The Game scene starts its own 'main-music'. */
export function fadeOutTitleMusic(scene, ms = 700) {
    for (const s of scene.sound.getAll('title-music')) {
        scene.tweens.killTweensOf(s);
        scene.tweens.add({ targets: s, volume: 0, duration: ms, onComplete: () => s.stop() });
    }
}

/** True when the browser hasn't allowed audio yet (needs a user gesture). */
export const audioLocked = (scene) => !!scene.sound.locked;
