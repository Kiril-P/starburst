// Menu music: thin wrappers over the music engine (systems/music.js), which is global, so the title theme keeps
// playing across menu overlays and crossfades into / out of the gameplay track.
import { playMusic, setMusicVolume as setBusVolume, duck, stopMusic } from '../../systems/music.js';
import { onBeat } from '../../systems/audioReact.js';

/** Start (or keep) the looping title theme, crossfading from gameplay music. Bass hits pulse the backdrop. */
export function playTitleMusic(scene) {
    playMusic('title-music', { fadeIn: 900, fadeOut: 1000 });
    if (!scene.__beatOff) {
        scene.__beatOff = onBeat((s) => scene.bg?.pulse(0.18 * (0.5 + 0.5 * s)));
        scene.events.once('shutdown', () => { scene.__beatOff(); scene.__beatOff = null; });
    }
}

/** Apply a new music volume live (settings slider). */
export function setMusicVolume(scene, v) { setBusVolume(v); }

/**
 * START transition: the title theme dips and closes its filter while the ship launches; the Game scene's
 * main track then crossfades it out, so there is never silence between them.
 */
export function fadeOutTitleMusic(scene, ms = 700) { duck('launch', true, ms); }

/** Stop all music (fade). */
export function stopAllMusic(ms = 600) { stopMusic(ms); }

/** True when the browser hasn't allowed audio yet (needs a user gesture). */
export const audioLocked = (scene) => !!scene.sound.locked;
