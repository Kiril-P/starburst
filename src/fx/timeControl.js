// Hit-stop and slow-mo for a scene. Both are driven by REAL time (performance.now / game.loop.delta), never by
// the scene clock they pause or slow down -- otherwise a frozen clock could never un-freeze itself.
// We only resume subsystems that we paused ourselves, so a pause menu that paused physics stays paused.

const MAX_STOP_MS = 160;   // repeated hit-stops extend the freeze, but never beyond this
const COOLDOWN_MS = 80;    // ...and a new freeze can't start right after one ends (no stutter-lock if spammed)

export default class TimeControl {
    constructor(scene) {
        this.scene = scene;
        this.stopUntil = 0;
        this.lastEnd = -Infinity;
        this.paused = null;               // which subsystems we paused: { physics, tweens, time, anims }
        this.slow = null;                 // { scale, start, end }
        this.scale = 1;                   // current effect time scale (0 while frozen)
        this.applied = 1;                 // scale last pushed into the scene's subsystems
    }

    get frozen() { return this.paused !== null; }

    hitStop(ms) {
        const now = performance.now();
        if (!this.paused) {
            if (now < this.lastEnd + COOLDOWN_MS) return;
            const s = this.scene, world = s.physics && s.physics.world;
            this.stopStart = now;
            this.paused = {
                physics: !!world && !world.isPaused,
                tweens: !s.tweens.paused,
                time: !s.time.paused,
                anims: !s.anims.paused
            };
            if (this.paused.physics) world.pause();
            if (this.paused.tweens) s.tweens.pauseAll();
            if (this.paused.time) s.time.paused = true;
            if (this.paused.anims) s.anims.pauseAll();
        }
        this.stopUntil = Math.min(Math.max(this.stopUntil, now + ms), this.stopStart + MAX_STOP_MS);
    }

    resume() {
        const p = this.paused;
        if (!p) return;
        this.paused = null;
        this.lastEnd = performance.now();
        const s = this.scene, world = s.physics && s.physics.world;
        if (p.physics && world) world.resume();
        if (p.tweens) s.tweens.resumeAll();
        if (p.time) s.time.paused = false;
        if (p.anims) s.anims.resumeAll();
    }

    slowmo(scale, ms) {
        const now = performance.now();
        if (this.slow && this.slow.end > now) {
            this.slow.scale = Math.min(this.slow.scale, scale);
            this.slow.end = Math.max(this.slow.end, now + ms);
        } else this.slow = { scale, start: now, end: now + ms };
    }

    /** call every frame (any order relative to the game's own update) */
    tick() {
        const now = performance.now();
        if (this.paused && now >= this.stopUntil) this.resume();
        let k = 1;
        if (this.slow) {
            const { scale, start, end } = this.slow;
            if (now >= end) this.slow = null;
            else {
                // dip fast, hold, then ease back over the last 40% so the return to speed doesn't jolt
                const t = (now - start) / (end - start);
                k = t < 0.6 ? scale : scale + (1 - scale) * ((t - 0.6) / 0.4) ** 2;
            }
        }
        this._applyScale(k);
        this.scale = this.paused ? 0 : k;
    }

    _applyScale(k) {
        if (k === this.applied) return;
        const s = this.scene, world = s.physics && s.physics.world;
        s.time.timeScale = k;
        s.tweens.timeScale = k;
        if (world) world.timeScale = 1 / k;     // arcade timeScale is inverted: 2 = half speed
        s.anims.globalTimeScale = k;            // global anim manager: restored to exactly 1 afterwards
        this.applied = k;
    }

    destroy() {
        this.resume();
        this.slow = null;
        if (this.applied !== 1) this._applyScale(1);
    }
}
