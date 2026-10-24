// In-game audio: the music (sector tracks, boss themes, stings) via the music engine, the looping thruster hum,
// throttled one-shots, and the glue that makes music and visuals react to the run. Everything is derived here from
// scene state each frame (pause / upgrade screen / death / wave / combo / hull), so the Game scene only has to create
// and destroy this.
//   music: each sector has its own track (sectorTrack); intensity builds within a sector as its waves progress and with
//          the combo, so a fresh sector starts calm and fills out layer by layer; boss fights crossfade to the boss
//          theme (final boss: its own variant) and return to the sector track once the boss is down.
//   stings: boss warning, wave clear, upgrade screen. Ducks (low-pass + quieter) while paused / picking an upgrade.
//   beats: the sequencer's beats pulse the background and the bloom glow.
import { save } from './Save.js';
import { sfx } from './sfx.js';
import { ensureSynthSfx } from './synthSfx.js';
import { playMusic, playSting, duck, setIntensity, setBossMode } from './music.js';
import { onBeat, getPulse } from './audioReact.js';
import { sectorOf } from '../objects/sectors.js';
import { sectorTrack } from '../audio/tracks/index.js';
import { BOSS_EVERY } from '../objects/waves.js';

const INTENSITY_WAVES = 10;   // waves until the global share of the intensity is full
const BEAT_PULSE = 0.22;      // background pulse per beat (scaled by beat strength); big hits use 0.3-1
const LOW_HP = 0.3;           // hull fraction under which the heartbeat alarm plays
const LOW_HP_GAP = 1100;      // ms between alarm beats

export default class GameAudio {
    constructor(scene) {
        this.scene = scene;
        this.last = Object.create(null);
        this.trackKey = sectorTrack(sectorOf(scene.waves?.wave ?? 1));
        playMusic(this.trackKey, { restart: true, fadeIn: 700, fadeOut: 1400, intensity: 0 });
        this.hum = ensureSynthSfx(scene.game, 'thruster-hum') ? scene.sound.add('thruster-hum', { loop: true, volume: 0 }) : null;
        this.bossOn = false;
        this.intensity = 0;
        this.lastHp = 0;
        this.humVol = 0;
        this.combo = 1;
        this.bloomBase = null;
        this.offBeat = onBeat((s) => { if (!scene.paused) scene.bg?.pulse(BEAT_PULSE * (0.5 + 0.5 * s)); });
        scene.events.on('update', this.tick, this);
    }

    play(key, opts) { return sfx(this.scene, key, opts); }

    /** play unless the same key played less than `gapMs` ago */
    throttled(key, gapMs, opts) { return sfx(this.scene, key, { gap: gapMs, ...opts }); }

    /** boss intro: siren + the warning sting (riser into a slam), the music dips under it */
    bossWarning() {
        sfx(this.scene, 'warning', { vol: 0.6 });
        playSting('sting-boss', { vol: 0.9 });
    }

    /**
     * Boss fight on/off: crossfades to the boss theme (final = the final-boss variant) and, `delayMs` after the boss is
     * down (real time), back to the sector's track at the current intensity.
     */
    setBossMode(on, final = false, delayMs = 0) {
        clearTimeout(this.bossT);
        if (on === this.bossOn) return;
        if (on) {
            this.bossOn = true;
            playMusic(final ? 'boss-final' : 'boss', { fadeIn: 450, fadeOut: 900, restart: true, intensity: 1, boss: true });
            return;
        }
        const back = () => {
            this.bossOn = false;
            setBossMode(false);
            playMusic(this.trackKey, { fadeIn: 1400, fadeOut: 1600, restart: true, intensity: this.intensity });
        };
        if (delayMs > 0) this.bossT = setTimeout(back, delayMs); else back();
    }

    setIntensity(v) { this.intensity = v; setIntensity(v); }

    /** wave cleared: the clear sting (the upgrade screen follows with its own) */
    waveClear() { playSting('sting-clear', { vol: 0.9 }); }

    tick(time, dt) {
        const g = this.scene;
        if (!g.player) return;
        duck('pause', !!g.paused);
        duck('upgrade', !!g.upgradeScreen);
        if (!!g.upgradeScreen !== !!this.upgradeOpen) { this.upgradeOpen = !!g.upgradeScreen; if (this.upgradeOpen) playSting('sting-upgrade', { vol: 0.8 }); }
        if (g.dying) duck('gameover', true, 1400);
        const wave = g.waves?.wave ?? 1;
        if (this.wave !== undefined && wave > this.wave) {
            sfx(g, 'banner', { vol: 0.55 });
            this.enterSector(sectorOf(wave));
        }
        this.wave = wave;
        const mult = g.combo?.mult ?? 1;
        // global progress + progress through the sector (a new sector starts calm) + combo heat
        const within = ((wave - 1) % BOSS_EVERY) / (BOSS_EVERY - 1);
        this.setIntensity(Math.min(1, (wave - 1) / INTENSITY_WAVES) * 0.2 + within * 0.55 + Math.min(1, mult / 12) * 0.25);
        this.comboSfx(mult);
        this.lowHp(time);
        this.glow();
    }

    /** a new sector began: its own track (unless a boss theme is playing; it returns to the new track after) */
    enterSector(sector) {
        const key = sectorTrack(sector);
        if (key === this.trackKey) return;
        this.trackKey = key;
        if (!this.bossOn) playMusic(key, { fadeIn: 1400, fadeOut: 1600, restart: true, intensity: 0 });
    }

    /** critical hull: a heartbeat + alarm blip about once a second (real time) */
    lowHp(time) {
        const p = this.scene.player;
        if (!p || !p.alive || this.scene.paused || this.scene.dying) return;
        if (p.hp / p.maxHp > LOW_HP || time - (this.lastLow || 0) < LOW_HP_GAP) return;
        this.lastLow = time;
        sfx(this.scene, 'low-hp', { vol: 0.5 });
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
        clearTimeout(this.bossT);
        duck('launch', false);
        setBossMode(false);
        this.scene.events.off('update', this.tick, this);
        this.offBeat();
        if (this.hum) this.hum.destroy();
        this.hum = null;
    }
}
