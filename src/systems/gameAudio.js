// In-game audio: main music, the looping thruster hum, and throttled one-shots (dozens of enemies firing
// in the same frame would otherwise stack into noise).
import { save } from './Save.js';
import { sfx } from './sfx.js';

export default class GameAudio {
    constructor(scene) {
        this.scene = scene;
        this.last = Object.create(null);
        scene.sound.stopByKey('title-music');
        scene.sound.stopByKey('main-music');
        const has = (k) => scene.cache.audio.exists(k);
        this.music = has('main-music') ? scene.sound.add('main-music', { loop: true, volume: save.musicVolume }) : null;
        if (this.music && save.musicVolume > 0) this.music.play();
        this.hum = has('thruster-hum') ? scene.sound.add('thruster-hum', { loop: true, volume: 0 }) : null;
        this.humVol = 0;
    }

    play(key, opts) { sfx(this.scene, key, opts); }

    /** play unless the same key played less than `gapMs` ago */
    throttled(key, gapMs, opts) {
        const now = this.scene.game.loop.time;
        if (now - (this.last[key] || -1e9) < gapMs) return;
        this.last[key] = now;
        sfx(this.scene, key, opts);
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

    stop() {
        this.stopHum();
        if (this.music) this.music.stop();
    }

    destroy() {
        this.stop();
        if (this.music) this.music.destroy();
        if (this.hum) this.hum.destroy();
    }
}
