// Title-screen sky dressing on top of the shared Background: shooting stars, burning meteor streaks, a few big rocks
// drifting at the screen edges (framing, like the concept), and the warp-speed streaks used by the START transition.
// Streaks are drawn as whole-pixel runs on a Graphics object (no scaled sprites, no anti-aliasing).
import Phaser from 'phaser';
import { W, H, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';

const STAR_TAIL = [COLORS.w, COLORS.b, COLORS.C, COLORS.c, COLORS.c, COLORS.n, COLORS.n];
const FIRE_TAIL = [COLORS.w, COLORS.z, COLORS.A, COLORS.A, COLORS.a, COLORS.a, COLORS.y, COLORS.y, COLORS.v];
const WARP = [COLORS.w, COLORS.b, COLORS.C, COLORS.c, COLORS.n];
const rnd = Phaser.Math.Between;

// Big framing rocks: [texture, x, y, drift px/s x, y, spin deg/s, tint]
const ROCKS = [
    ['meteor_l_0', 18, 330, 1.2, -0.6, 6, COLORS[3]],
    ['meteor_m_1', 600, 300, -0.8, 0.5, -9, COLORS[3]],
    ['meteor_l_1', 622, 40, -0.6, 0.4, 4, COLORS[2]],
    ['meteor_s_0', 40, 58, 0.9, 0.7, -14, COLORS[2]],
    ['meteor_s_1', 168, 342, 1.1, -0.3, 12, COLORS[3]]
];

export default class SkyFx {
    constructor(scene) {
        this.scene = scene;
        this.g = scene.add.graphics().setDepth(DEPTH.BG_NEAR + 1);
        this.warpG = scene.add.graphics().setDepth(DEPTH.FX_TOP).setBlendMode(Phaser.BlendModes.ADD);
        this.streaks = [];
        this.warps = [];
        this.warpLevel = 0;
        this.nextStreak = 600;
        this.rocks = ROCKS.map(([key, x, y, vx, vy, spin, tint]) => ({
            img: scene.add.image(x, y, key).setDepth(DEPTH.BG_NEAR).setTint(tint).setAngle(rnd(0, 359)),
            x, y, x0: x, y0: y, vx, vy, spin
        }));
    }

    spawnStreak(fire = Math.random() < 0.25) {
        // fall diagonally right-to-left or left-to-right, 2:1 or 1:1 slope keeps pixel steps clean
        const dir = Math.random() < 0.5 ? 1 : -1;
        const slope = Math.random() < 0.5 ? 1 : 0.5;
        this.streaks.push({
            x: dir > 0 ? rnd(-40, W * 0.6) : rnd(W * 0.4, W + 40), y: rnd(-20, H * 0.35),
            dx: dir, dy: slope, speed: fire ? rnd(140, 200) : rnd(260, 380),
            len: fire ? rnd(9, 14) : rnd(8, 16), life: rnd(600, 1100), t: 0,
            tail: fire ? FIRE_TAIL : STAR_TAIL, head: fire ? 2 : 1
        });
    }

    /** 0 = off, 1 = full warp. Spawns long cyan streaks rushing downward (ship flying "up" into hyperspace). */
    setWarp(v) { this.warpLevel = v; }

    update(dt) {
        const s = dt / 1000;
        // occasional streaks (fewer while warping, the warp field dominates then)
        this.nextStreak -= dt;
        if (this.nextStreak <= 0 && this.warpLevel < 0.2) {
            this.spawnStreak();
            this.nextStreak = rnd(900, 2600);
        }
        const g = this.g;
        g.clear();
        for (let i = this.streaks.length - 1; i >= 0; i--) {
            const st = this.streaks[i];
            st.t += dt;
            const d = (st.speed * st.t) / 1000;
            const hx = Math.round(st.x + st.dx * d), hy = Math.round(st.y + st.dy * d);
            // fade = shorten the tail near end of life
            const k = Math.min(1, (st.life - st.t) / 250);
            const len = Math.max(1, Math.round(st.len * k));
            for (let p = 0; p < len; p++) {
                const ci = Math.min(st.tail.length - 1, Math.floor((p / len) * st.tail.length));
                const px = Math.round(hx - st.dx * p), py = Math.round(hy - st.dy * p);
                g.fillStyle(st.tail[ci]).fillRect(px, py, 1, 1);
            }
            if (st.head > 1 && k > 0.5) g.fillStyle(st.tail[1]).fillRect(hx - 1, hy, 2, 2).fillStyle(st.tail[0]).fillRect(hx, hy, 1, 1);
            if (st.t >= st.life) this.streaks.splice(i, 1);
        }

        for (const r of this.rocks) {
            r.x += r.vx * s; r.y += r.vy * s;
            // drift back and forth a few px around the anchor so the frame never empties
            if (Math.abs(r.x - r.x0) > 10) r.vx = -r.vx;
            if (Math.abs(r.y - r.y0) > 8) r.vy = -r.vy;
            r.img.setPosition(Math.round(r.x), Math.round(r.y));
            r.img.angle += r.spin * s;
        }

        this.updateWarp(dt);
    }

    updateWarp(dt) {
        const wg = this.warpG;
        wg.clear();
        if (this.warpLevel <= 0 && !this.warps.length) return;
        const want = Math.round(this.warpLevel * 110);
        while (this.warps.length < want) {
            this.warps.push({ x: rnd(0, W - 1), y: rnd(-H / 2, H), v: rnd(500, 1100), len: rnd(14, 48) });
        }
        for (let i = this.warps.length - 1; i >= 0; i--) {
            const wv = this.warps[i];
            wv.y += (wv.v * (0.4 + this.warpLevel) * dt) / 1000;
            const len = Math.round(wv.len * (0.5 + this.warpLevel));
            const y = Math.round(wv.y);
            // segmented colour runs: white head at the bottom, fading up
            const seg = Math.max(1, Math.ceil(len / WARP.length));
            for (let c = 0; c < WARP.length; c++) wg.fillStyle(WARP[c]).fillRect(wv.x, y - (c + 1) * seg, 1, seg);
            if (wv.y - len > H) {
                if (this.warps.length > want) this.warps.splice(i, 1);
                else { wv.y = rnd(-60, 0); wv.x = rnd(0, W - 1); }
            }
        }
    }

    destroy() {
        this.g.destroy(); this.warpG.destroy();
        this.rocks.forEach((r) => r.img.destroy());
    }
}
