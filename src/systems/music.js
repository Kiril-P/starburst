// Music for the game: a thin adapter over the generated-music engine (audio/engine.js), sharing Phaser's AudioContext
// and master volume. There are no music files: tracks are sequenced synth patterns (docs/AUDIO.md), so looping is
// seamless by construction and nothing has to be decoded or fetched. Why not Phaser sounds: we need crossfades, a
// shared filter/gain bus for ducking + intensity layers, beat events and an analyser tap for visuals.
//
// Every export is no-op safe: before init (or without Web Audio) calls simply do nothing.
import { createEngine } from '../audio/engine.js';
import { save } from './Save.js';

const ALIAS = { 'main-music': 'sector1' };      // old key, kept so stray callers still get a gameplay track
let E = null;

export function initMusic(game) {
    const sound = game.sound;
    if (E || !sound || !sound.context || !sound.destination) return;
    E = createEngine(sound.context, sound.destination, { volume: save.musicVolume });
    game.events.once('destroy', () => { E?.stop(0); E = null; });
}

/** Analyser on the music bus (pre user volume), or null. Used by audioReact. */
export const musicAnalyser = () => E?.analyser || null;
/** Key of the track currently playing (not fading out), or null. */
export const currentTrack = () => E?.current() ?? null;
/** The engine itself (dev tools / audition). */
export const musicEngine = () => E;

/**
 * Play a looping track, crossfading from whatever is playing. opts { fadeIn = 600 ms, fadeOut = 1200 ms,
 * restart = false (restart even if it is already the current track), intensity = 1, boss = false }.
 * Clears ducks and boss mode: a new track is a new context (menu, run, ...).
 */
export function playMusic(key, opts = {}) { return E ? E.play(ALIAS[key] || key, opts) : false; }

/** One-shot music sting ('sting-boss' | 'sting-clear' | 'sting-gameover' | 'sting-upgrade' | 'sting-victory'). */
export function playSting(key, opts) { return save.musicVolume > 0 && E ? E.sting(key, opts) : 0; }

/** Fade out and stop all music. */
export function stopMusic(ms = 600) { E?.stop(ms); }

/** User music volume 0..1 (settings slider). */
export function setMusicVolume(v) { E?.setVolume(v); }

/** Duck the music for a reason ('pause' | 'upgrade' | 'gameover' | 'launch'): low-pass + quieter. */
export function duck(reason, on = true, ms = 350) { E?.duck(reason, on, ms); }

/** Gameplay intensity 0 (calm: bass, kick, pad) .. 1 (every layer, wide open). */
export function setIntensity(v) { E?.setIntensity(v); }

/** Boss fight state: every layer open, filter fully open, extra low-end weight and air, a bit louder. */
export function setBossMode(on) { E?.setBoss(on); }

/** Beats (from the sequencer) whose audio time has arrived; fn(strength 0..1). audioReact calls this once per frame. */
export function popBeats(fn) { E?.popBeats(fn); }

/** Debug/verification snapshot. */
export const musicState = () => E?.state() ?? null;
