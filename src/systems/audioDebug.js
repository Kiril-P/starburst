// Dev-only audition helpers (installed by installAudio in dev builds; never shipped):
//   __audio.music('sector2' [, { intensity: 0..1, boss: bool }])   play any track          __audio.stopMusic()
//   __audio.sting('sting-boss')                                    play a music sting
//   __audio.sfx('graze' [, { rate, vol }])                         play any sound effect (ignores cooldowns)
//   __audio.list()                                                 -> { music, stings, sfx }     __audio.bake -> boot timing
// __dbg.music / __dbg.sfx / __dbg.sting are the same calls (the Game scene's __dbg also has them). tools/render-audio.mjs
// and /audio-lab.html render / audition the same code outside the game.
import { TRACK_KEYS } from '../audio/tracks/index.js';
import { STING_KEYS } from '../audio/stings.js';
import { SFX_KEYS } from '../audio/sfx/index.js';
import { bakeStats } from './synthSfx.js';
import * as music from './music.js';

export function installAudioLab(game, sfx) {
    const A = window.__audio;
    const scene = () => game.scene.getScenes(true)[0];
    A.bake = bakeStats;
    A.list = () => ({ music: TRACK_KEYS, stings: STING_KEYS, sfx: SFX_KEYS });
    A.music = (key, o = {}) => music.playMusic(key, { fadeIn: 250, fadeOut: 400, restart: true, ...o });
    A.stopMusic = (ms) => music.stopMusic(ms);
    A.sting = (key, o) => music.playSting(key, o);
    A.sfx = (key, o = {}) => !!sfx(scene(), key, { force: true, ...o });
    A.state = () => music.musicState();
    A.engine = () => music.musicEngine();
}

/** merged into window.__dbg by systems/debug.js */
export const audioDbg = () => ({
    music: (key, o) => window.__audio.music(key, o),
    sfx: (key, o) => window.__audio.sfx(key, o),
    sting: (key, o) => window.__audio.sting(key, o)
});
