// The meta layer's single hook into a run. Game.js creates one at the very start of create() and calls
// update(rawDt) every unpaused frame; everything else is observed by polling the scene's public state, so the
// gameplay code doesn't need to know about credits, achievements, daily seeds or cinematics:
//   - run mode: Daily Run seeds the rng streams and forces NORMAL difficulty (same run for everyone that day)
//   - permanent hangar upgrades applied to the player on the first frame
//   - achievement checks (polled) + unlock toasts
//   - per-wave "no damage" / "clutch" tracking
//   - sector-complete screen after each boss, death slow-mo moment
import { currentDifficulty, DIFFICULTY } from '../../systems/difficulty.js';
import { runInfo, applyMeta, creditsForRun } from '../../systems/meta.js';
import { seedRun, rngStream } from '../../systems/rng.js';
import { beginSession, checkAchievements, onUnlock } from '../../systems/achievements.js';
import AchievementToast from './AchievementToast.js';
import DeathMoment from './DeathMoment.js';

const CHECK_MS = 300;
const SECTOR_DELAY_MS = 1300;   // after a boss wave clears: let the "<BOSS> DOWN" banner land first

export default class RunMeta {
    constructor(game) {
        this.g = game;
        this.info = runInfo();
        this.daily = this.info.mode === 'daily';
        seedRun(this.daily ? this.info.seed : null);
        this.upgradeRng = rngStream('upgrades');
        this.diff = this.daily ? { id: 'normal', ...DIFFICULTY.normal } : currentDifficulty();
        beginSession();
        this.toast = new AchievementToast(game, { y: 64 });   // under the HUD score + combo panels
        this.offUnlock = onUnlock((a) => this.toast.show(a));
        this.started = false;
        this.checkT = CHECK_MS;
        this.lastHp = null;
        this.hitThisWave = false;
        this.cleanWave = false;
        this.clutchWave = false;
        this.waveState = null;
        this.sectorShownFor = 0;
        this.sectorT = 0;
        this.sectorMs = 0;
        this.sectorStart = { score: 0, kills: 0, graze: 0 };
        this.bossName = null;
        this.death = null;
    }

    /** first frame: the player exists now */
    start() {
        const g = this.g;
        this.started = true;
        applyMeta(g.player);
        this.lastHp = g.player.hp;
        if (this.daily) g.hud.toast(`DAILY RUN  ${this.info.date}`, '#ffb547', 2600);
    }

    snapshot() {
        const g = this.g, s = g.combat.stats;
        return {
            score: g.combat.score, wave: g.waves.wave, kills: s.kills, graze: s.graze, maxCombo: s.maxCombo,
            bosses: s.bosses ?? 0, ship: g.player.shipType, difficulty: this.diff.id, mode: this.info.mode,
            cleanWave: this.cleanWave, clutchWave: this.clutchWave
        };
    }

    update(dt) {
        const g = this.g, p = g.player;
        if (!this.started) this.start();
        this.sectorMs += dt;
        if (g.bosses.boss) this.bossName = g.bosses.boss.def.name;

        if (p.hp < this.lastHp) this.hitThisWave = true;
        this.lastHp = p.hp;
        const st = g.waves.state;
        if (st !== this.waveState) {
            if (st === 'intro' || st === 'boss') this.hitThisWave = false;
            if (st === 'cleared' && p.alive) {
                if (!this.hitThisWave) this.cleanWave = true;
                if (p.hp / p.maxHp <= 0.1) this.clutchWave = true;
                if (g.waves.isBoss) this.sectorT = SECTOR_DELAY_MS;
            }
            this.waveState = st;
        }
        if (this.sectorT > 0 && (this.sectorT -= dt) <= 0) this.showSector();

        if ((this.checkT -= dt) <= 0) {
            this.checkT = CHECK_MS;
            if (!g.dying) checkAchievements(this.snapshot());
        }
        if (g.dying && !this.death) this.death = new DeathMoment(g);
    }

    /** pause the playfield and recap the sector that just ended (scenes/SectorComplete.js) */
    showSector() {
        const g = this.g;
        const wave = g.waves.wave;
        if (g.dying || this.sectorShownFor === wave || !g.scene.get('SectorComplete')) return;
        this.sectorShownFor = wave;
        const s = this.snapshot(), a = this.sectorStart;
        checkAchievements(s);
        g.scene.launch('SectorComplete', {
            sector: Math.round(wave / 5), boss: this.bossName, timeMs: this.sectorMs,
            score: s.score - a.score, kills: s.kills - a.kills, graze: s.graze - a.graze, maxCombo: s.maxCombo,
            hull: Math.round((g.player.hp / g.player.maxHp) * 100), total: s.score,
            credits: creditsForRun(s, this.info.mode, this.diff.id).total
        });
        g.scene.pause();
        this.sectorStart = { score: s.score, kills: s.kills, graze: s.graze };
        this.sectorMs = 0;
    }

    destroy() {
        this.offUnlock();
        this.toast.destroy();
        this.death?.destroy();
        seedRun(null);   // menus and other scenes go back to Math.random
    }
}
