// In-game audio: main music (via the music engine), the looping thruster hum, throttled one-shots, and the
// glue that makes music and visuals react to the run. Everything is derived here from scene state each frame
// (pause / upgrade screen / death / wave / combo), so the Game scene only has to create and destroy this.
//   music: crossfades in from the title, ducks (low-pass + quieter) while paused / picking an upgrade, closes
//          down on death and stays ducked under GameOver; opens up as waves progress; boss mode via setBossMode.
//   beats: bass hits pulse the background and the bloom glow.
import { save } from './Save.js';
import { sfx } from './sfx.js';
import { playMusic, duck, setIntensity, setBossMode } from './music.js';
import { onBeat, getPulse } from './audioReact.js';

const INTENSITY_WAVES = 10;   // waves until the music is fully open
const BEAT_PULSE = 0.22;      // background pulse per beat (scaled by beat strength); big hits use 0.3-1

export default class GameAudio {
    constructor(scene) {
        this.scene = scene;
        this.last = Object.create(null);
        playMusic('main-music', { restart: true, fadeIn: 700, fadeOut: 1400, intensity: 0 });
        this.hum = scene.cache.audio.exists('thruster-hum') ? scene.sound.add('thruster-hum', { loop: true, volume: 0 }) : null;
        this.humVol = 0;
        this.combo = 1;
        this.bloomBase = null;
        this.offBeat = onBeat((s) => { if (!scene.paused) scene.bg?.pulse(BEAT_PULSE * (0.5 + 0.5 * s)); });
        scene.events.on('update', this.tick, this);
    }

    play(key, opts) { return sfx(this.scene, key, opts); }

    /** play unless the same key played less than `gapMs` ago */
    throttled(key, gapMs, opts) { return sfx(this.scene, key, { gap: gapMs, ...opts }); }

    /** boss intro: siren + a short duck so it cuts through */
    bossWarning() {
        sfx(this.scene, 'warning', { vol: 0.8 });
        duck('launch', true, 200);
        // real time: the scene clock may be slowed / hit-stopped / paused
        clearTimeout(this.warnT);
        this.warnT = setTimeout(() => duck('launch', false, 800), 1600);
    }

    setBossMode(on) { setBossMode(on); }
    setIntensity(v) { setIntensity(v); }

    tick(time, dt) {
        const g = this.scene;
        if (!g.player) return;
        duck('pause', !!g.paused);
        duck('upgrade', !!g.upgradeScreen);
        if (g.dying) duck('gameover', true, 1400);
        const wave = g.waves?.wave ?? 1;
        if (this.wave !== undefined && wave > this.wave) sfx(g, 'wave-start', { vol: 0.5 });
        this.wave = wave;
        const mult = g.combo?.mult ?? 1;
        setIntensity(Math.min(1, (wave - 1) / INTENSITY_WAVES) * 0.85 + Math.min(1, mult / 12) * 0.15);
        this.comboSfx(mult);
        this.glow();
    }

    /** rising chirp per combo tier, a drop when a big chain breaks */
    comboSfx(mult) {
        if (mult > this.combo && mult >= 2) sfx(this.scene, 'combo-up', { vol: 0.45, rate: Math.min(2, Math.pow(2, (mult - 2) / 8)) });
        else if (mult === 1 && this.combo >= 4) sfx(this.scene, 'combo-lost', { vol: 0.5 });
        this.combo = mult;
    }

    /** bloom strength breathes with the beat (only when the glow post-FX is on) */
    glow() {
        const pipe = this.scene.fx?.bloom ? this.scene.cameras.main.getPostPipeline('NeonBloom') : null;
        if (!pipe || Array.isArray(pipe)) return;
        if (this.bloomBase === null) this.bloomBase = pipe.strength;
        pipe.strength = this.bloomBase * (1 + 0.6 * getPulse());
    }

    /** thrust 0..1: hum fades in while moving, out when idle */
    thrust(amount, dt) {
        if (!this.hum) return;
        const target = amount * 0.55 * save.soundVolume;
        this.humVol += (target - this.humVol) * Math.min(1, dt / 120);
        if (this.humVol > 0.01) {
            if (!this.hum.isPlaying && !this.hum.isPaused) this.hum.play();
            this.hum.setVolume(this.humVol);
        } else if (this.hum.isPlaying) this.hum.stop();
    }

    stopHum() { if (this.hum) { this.hum.stop(); this.humVol = 0; } }

    /** run is over (quit / game over): the music keeps going ducked; the next scene crossfades or restarts it */
    stop() {
        this.stopHum();
        duck('gameover', true, 600);
    }

    destroy() {
        this.stopHum();
        clearTimeout(this.warnT);
        duck('launch', false);
        setBossMode(false);
        this.scene.events.off('update', this.tick, this);
        this.offBeat();
        if (this.hum) this.hum.destroy();
        this.hum = null;
    }
}
