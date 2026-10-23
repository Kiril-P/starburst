// The playfield. Wires the systems together and runs the fixed simulation order each frame:
// player -> waves/enemies -> pattern sequencer -> bullets -> collisions -> combo.
// Everything gameplay advances on *simulation* dt = frame dt x scene clock timeScale, so Fx.hitStop /
// Fx.slowmo (which act on the scene clock) and the pause menu freeze or slow the whole playfield.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import Background from '../fx/Background.js';
import Fx from '../fx/Fx.js';
import Hud from '../ui/Hud.js';
import UpgradeScreen from '../ui/UpgradeScreen.js';
import PauseMenu from '../ui/PauseMenu.js';
import { save } from '../systems/Save.js';
import { COLORS } from '../art/palette.js';
import { ENEMY_BULLET, JUICE, TIER_BULLET_SPEED } from '../systems/tuning.js';
import { currentDifficulty } from '../systems/difficulty.js';
import { rollOptions, UPGRADES } from '../systems/upgrades.js';
import Combo from '../systems/combo.js';
import GameAudio from '../systems/gameAudio.js';
import { freeze, thaw } from '../systems/scenePause.js';
import { installDebug } from '../systems/debug.js';
import RunMeta from './run/RunMeta.js';
import { wipeTo } from './cine/wipe.js';
import Player from '../objects/Player.js';
import BulletPool from '../objects/BulletPool.js';
import WaveManager from '../objects/WaveManager.js';
import Combat from '../objects/Combat.js';
import Impacts from '../objects/Impacts.js';
import BossDirector from '../objects/bosses/BossDirector.js';
import { Sequencer } from '../objects/patterns.js';
import { bulletsVsPlayer, shotsVsEnemies, playerVsEnemies } from '../objects/collisions.js';
import Arsenal from '../objects/weapons/Arsenal.js';
import Loot from '../objects/pickups/Loot.js';
import PowerUps from '../objects/pickups/PowerUps.js';

const STEP_MS = 17;   // max simulation sub-step: keeps fast bullets from tunnelling on slow frames
const ABILITY_KEYS = { dash: 'SHIFT', forcefield: 'Z', phase: 'X' };

export default class Game extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        // a previous run's slow-mo / hit-stop must not leak into this one
        this.time.timeScale = 1;
        this.time.paused = false;
        this.tweens.timeScale = 1;
        this.run = new RunMeta(this);   // meta layer: run mode/seed, hangar upgrades, achievements, cinematics
        this.diff = this.run.diff ?? currentDifficulty();
        this.bg = new Background(this, { biome: 0 });
        this.fx = new Fx(this);
        this.hud = new Hud(this);
        this.audio = new GameAudio(this);
        this.combo = new Combo();
        this.seq = new Sequencer();
        this.enemyBullets = new BulletPool(this, { size: 1200, depth: DEPTH.PLAYER + 1 });  // above the ship: never hide a bullet
        this.shots = new BulletPool(this, { size: 160, depth: DEPTH.PLAYER_BULLET, cullMargin: 12 });
        this.impacts = new Impacts(this);
        this.combat = new Combat(this);
        this.player = new Player(this, W / 2, H - 76, save.ship, this.playerHooks());
        this.waves = new WaveManager(this, this.diff, this.waveHooks());
        this.bosses = new BossDirector(this);
        this.arsenal = new Arsenal(this, this.player);   // weapons (objects/weapons)
        this.loot = new Loot(this);                      // drops + pickups (objects/pickups)
        this.powerups = new PowerUps(this);
        this.enemyCtx = {
            pool: this.enemyBullets, seq: this.seq, px: 0, py: 0, speed: 1, density: this.diff.patternDensity,
            damage: ENEMY_BULLET.damage * this.diff.enemyDamage, fireRateMod: 1,
            onShoot: () => this.audio.throttled('enemy-shoot', JUICE.sfxThrottleMs, { vol: 0.3, jitter: 200 })
        };
        this.hudState = { hp: 0, maxHp: 0, score: 0, combo: 1, comboT01: 0, wave: 1, waveTimeLeft: null, abilities: null };
        this.intensity = 1;
        this.lowHpT = 0;
        this.dying = false;
        this.god = false;
        this.paused = false;
        this.pauseMenu = new PauseMenu(this, { onResume: () => this.setPaused(false), onQuit: () => this.quit() });
        this.lastPauseToggle = 0;
        this.input.keyboard.on('keydown-ESC', () => this.setPaused(!this.paused));
        this.events.once('shutdown', () => this.cleanup());
        this.waves.start(1);
        installDebug(this);
    }

    playerHooks() {
        return {
            onFire: (x, y, angle) => {
                this.arsenal.fire(x, y, angle);
            },
            onDash: () => {
                this.intensity = JUICE.dashIntensity;
                this.bg.pulse(0.3);
                this.fx.flash(this.player.stats.accent, 0.12, 60);
                this.audio.play(Math.random() < 0.5 ? 'dash' : 'dash-alt', { vol: 0.6 });
            },
            onForcefield: () => {
                const p = this.player;
                this.combat.cancelBullets(true);
                this.fx.shockwave(p.x, p.y, COLORS.C, 3);
                this.fx.flash(COLORS.C, 0.3, 250);
                this.fx.shake(2, 200);
                this.bg.pulse(0.6);
                this.audio.play('forcefield', { vol: 0.8 });
            },
            onPhase: (on) => {
                if (on) { this.fx.flash(COLORS.M, 0.18, 200); this.audio.play('phase-shift', { vol: 0.7 }); }
                else this.fx.shockwave(this.player.x, this.player.y, COLORS.M, 0.4);
            },
            onAbilityDenied: () => {}
        };
    }

    waveHooks() {
        return {
            onIntro: (wave, cfg) => {
                this.bg.setBiome(this.waves.biome);
                this.enemyCtx.speed = TIER_BULLET_SPEED[this.waves.tier] * cfg.bulletSpeed * this.diff.bulletSpeed;
                if (!this.bosses.intro(wave)) this.hud.announce(`WAVE ${wave}`, `SURVIVE ${Math.round(cfg.duration / 1000)}S`);
            },
            onStart: () => {},
            onClear: (wave) => {
                this.audio.play('wave-complete', { vol: 0.8 });
                this.waves.clearEnemies((e) => this.combat.killEnemy(e, false));
                this.combat.cancelBullets(false);
                this.loot.vacuum();
                this.fx.flash(COLORS.A, 0.25, 400);
                if (!this.waves.isBoss) this.hud.announce(`WAVE ${wave} CLEAR`, 'NICE FLYING');   // bosses get their own banner
                if (wave > save.highestWaveCompleted) save.highestWaveCompleted = wave;
            },
            onUpgrade: (wave, done) => {
                if (this.dying) return;
                this.player.controllable = false;
                this.upgradeScreen = new UpgradeScreen(this, rollOptions(this.player.levels, this.run.upgradeRng, this.arsenal, { boss: this.waves.isBoss }), (opt) => {
                    this.upgradeScreen = null;
                    if (!this.arsenal.apply(opt.id)) this.player.applyUpgrade(opt.id);
                    this.player.controllable = true;
                    this.announceUpgrade(opt);
                    done();
                }, this.waves.isBoss ? { title: 'BOSS DESTROYED' } : undefined);
            },
            onEscape: () => {}
        };
    }

    announceUpgrade(opt) {
        if (opt.id === 'heal' || opt.id === 'hull') { this.hud.toast('HULL REPAIRED', '#b7ff4a'); return; }
        if (opt.id === 'thrusters') { this.hud.toast('THRUSTERS UPGRADED', '#b7ff4a'); return; }
        if (opt.tag === 'SYNERGY' || opt.id.startsWith('w:')) { this.hud.toast(`${opt.title} ${opt.tag === 'SYNERGY' ? 'SYNERGY' : 'ONLINE'}`, opt.tag === 'SYNERGY' ? '#ffb547' : '#39e7ff'); return; }
        const lv = this.player.levels[opt.id];
        this.hud.toast(lv === 1 ? `${UPGRADES[opt.id].title} UNLOCKED  [${ABILITY_KEYS[opt.id]}]` : `${UPGRADES[opt.id].title} LV${lv}`, '#39e7ff');
    }

    update(time, delta) {
        const raw = Math.min(delta, 50);
        if (this.paused) return;
        this.run.update(raw);
        this.fx.update(raw);
        const sim = raw * (this.time.paused ? 0 : this.time.timeScale);
        const n = Math.ceil(sim / STEP_MS);
        for (let i = 0; i < n; i++) this.step(sim / n);
        this.impacts.update(sim);
        this.intensity = Math.max(1, this.intensity - (JUICE.intensityDecay * raw) / 1000);
        this.bg.update(raw, this.intensity);
        this.updateFeedback(raw);
        this.updateHud();
        if (this.dying && this.game.loop.time >= this.deathAt) this.gameOver();   // real time: unaffected by slow-mo or frame clamping
    }

    step(dt) {
        const p = this.player;
        p.update(dt);
        this.arsenal.update(dt);
        this.enemyCtx.px = p.x;
        this.enemyCtx.py = p.y;
        this.waves.update(dt, this.enemyCtx);
        this.bosses.update(dt);
        this.seq.update(dt);
        this.enemyBullets.update(dt);
        this.shots.update(dt);
        const enemies = this.waves.live;
        shotsVsEnemies(this.shots, enemies, (s, e) => this.combat.shotHit(s, e));
        if (!this.dying) {
            bulletsVsPlayer(this.enemyBullets, p, this.collideHooks || (this.collideHooks = { onHit: (b) => this.combat.bulletHit(b), onGraze: (b) => this.combat.graze(b) }));
            playerVsEnemies(p, enemies, (e) => this.combat.ram(e));
        }
        const boss = this.bosses.targets;   // boss hit circles behave like enemies that never die from Combat
        if (boss.length) {
            shotsVsEnemies(this.shots, boss, (s, e) => this.combat.shotHit(s, e));
            if (!this.dying) playerVsEnemies(p, boss, (e) => this.combat.ram(e));
        }
        this.loot.update(dt);
        this.powerups.update(dt);
        this.combo.update(dt);
    }

    updateFeedback(raw) {
        const p = this.player;
        const k = p.keys;
        const moving = p.alive && p.controllable && (k.left.isDown || k.right.isDown || k.up.isDown || k.down.isDown);
        this.audio.thrust(moving ? 1 : 0, raw);
        // low hull warning: slow red pulse + one toast when first crossing the threshold
        const low = p.alive && p.hp / p.maxHp <= JUICE.lowHp;
        if (low) {
            if (!this.wasLow) this.hud.toast('HULL CRITICAL', '#ff6a5c');
            if ((this.lowHpT -= raw) <= 0) { this.lowHpT = JUICE.lowHpPulseMs; this.fx.flash(COLORS.r, 0.14, 220); }
        }
        this.wasLow = low;
    }

    updateHud() {
        const s = this.hudState, p = this.player;
        s.hp = p.hp; s.maxHp = p.maxHp;
        s.score = this.combat.score;
        s.combo = this.combo.mult; s.comboT01 = this.combo.t01;
        s.wave = this.waves.wave; s.waveTimeLeft = this.waves.secondsLeft;
        s.abilities = p.abilityState();
        this.hud.update(s);
    }

    setPaused(on) {
        const now = this.game.loop.time;
        // PauseMenu may also react to ESC and call onResume: ignore a second toggle in the same instant
        if (on === this.paused || now - this.lastPauseToggle < 150) return;
        if (on && (this.dying || this.upgradeScreen)) return;
        this.lastPauseToggle = now;
        this.paused = on;
        if (on) {
            this.audio.stopHum();
            this.frozen = freeze(this);
            this.pauseMenu.show();
        } else {
            this.pauseMenu.hide();
            thaw(this, this.frozen);
            this.frozen = null;
        }
    }

    quit() {
        thaw(this, this.frozen);
        this.audio.stop();
        wipeTo(this, 'MainMenu');
    }

    startDeath() {
        const p = this.player;
        this.dying = true;
        this.deathAt = this.game.loop.time + JUICE.deathToGameOverMs;
        this.audio.stopHum();
        this.audio.play('player-death', { vol: 0.9 });
        this.fx.hitStop(90);
        this.fx.slowmo(JUICE.deathSlowmo, 1400);
        this.fx.explosion(p.x, p.y, 'l', 'cyan');
        this.fx.shockwave(p.x, p.y, COLORS.w, 2);
        this.fx.debris(p.x, p.y, 14, p.stats.accent);
        this.fx.flash(COLORS.w, 0.5, 220);
        this.fx.shake(3, 450);
        this.bg.pulse(1);
        this.combo.reset();
    }

    gameOver() {
        this.dying = false;
        this.audio.stop();
        wipeTo(this, 'GameOver', { score: this.combat.score, wave: this.waves.wave, stats: { ...this.combat.stats }, biome: this.waves.biome, build: this.arsenal.summary() }, { edge: COLORS.r });
    }

    cleanup() {
        this.input.keyboard.off('keydown-ESC');
        this.audio.destroy();
        this.run.destroy();
        for (const k of ['bosses', 'pauseMenu', 'hud', 'fx', 'bg']) this[k]?.destroy();
        this.upgradeScreen?.destroy();
        this.waves.destroy();
        this.enemyBullets.destroy();
        this.shots.destroy();
        this.impacts.destroy();
        this.player.destroy();
        for (const k of ['arsenal', 'loot', 'powerups']) this[k]?.destroy();
        if (window.__dbg?.scene === this) delete window.__dbg;
    }
}
