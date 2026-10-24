// Presentation around a boss fight: the dimmed backdrop, amber hazard stripes and the intro sequence per boss
// kind (mid-boss: short INTERCEPT; main: WARNING siren; final: a long two-beat FINAL WARNING build-up).
// Everything advances on simulation dt so it freezes with pause / hit-stop like the fight itself.
import { W, H, DEPTH } from '../../config.js';
import { COLORS } from '../../art/palette.js';

const STRIPE_MS = { mini: 1600, main: 2600, final: 4800 };
const DIM = { mini: 0.35, main: 0.5, final: 0.65 };
export const FIGHT_DIM = 0.25;

export default class BossStage {
    constructor(game) {
        this.g = game;
        this.dim = game.add.rectangle(0, 0, W, H, COLORS.k, 1).setOrigin(0, 0).setDepth(DEPTH.PICKUP - 1).setAlpha(0).setVisible(false);
        this.stripes = game.add.graphics().setDepth(DEPTH.HUD + 4).setVisible(false);
        this.dimTarget = 0;
        this.stripeT = 0;
        this.beats = [];        // timed intro beats [{ t, fn }]
    }

    /** stage the arrival of boss b (def.kind decides how loud) */
    intro(b, cycle) {
        const g = this.g, d = b.def, kind = d.kind, mk = cycle ? `  MK ${cycle + 1}` : '';
        this.beats.length = 0;
        this.dimTarget = DIM[kind];
        this.dim.setVisible(true);
        this.stripeT = STRIPE_MS[kind];
        this.stripes.setVisible(true);
        g.audio.setBossMode(true, kind === 'final');
        if (kind === 'mini') {
            g.hud.announce('INTERCEPT', `MID-BOSS  //  ${d.name}${mk}`, 2000);
            g.audio.play('boss-stinger', { vol: 0.7, rate: 1.15 });
            g.fx.shake(1, 900);
            g.bg.pulse(0.5);
            return;
        }
        g.fx.flash(COLORS.r, 0.18, 300);
        g.bg.pulse(0.8);
        g.audio.bossWarning();
        g.audio.play('forcefield', { vol: 0.7, rate: 0.5 });
        if (kind === 'main') {
            g.hud.announce('WARNING', `${d.name}  //  ${d.title}${mk}`, 2800);
            g.fx.shake(1, 2400);
            g.audio.play('wave-complete', { vol: 0.5, rate: 0.6 });
            return;
        }
        // final: the warning, a rumble that grows, then the name drops with a stinger as the star rises into view
        g.hud.announce('FINAL WARNING', 'SECTOR CORE APPROACHING', 2300);
        g.fx.shake(1, 2300);
        this.beat(1200, () => { g.bg.pulse(1); g.fx.flash(COLORS.M, 0.15, 200); });
        this.beat(2400, () => {
            g.hud.announce(d.name, `${d.title}${mk}`, 2600);
            g.audio.play('boss-stinger', { vol: 0.9, rate: 0.85 });
            g.audio.play('wave-complete', { vol: 0.6, rate: 0.5 });
            g.fx.shake(2, 2400);
            g.fx.flash(COLORS.w, 0.3, 300);
            g.bg.pulse(1);
        });
    }

    beat(t, fn) { this.beats.push({ t, fn }); }

    /** called once the boss is fighting: keep a little gloom */
    settle() { if (this.dimTarget > FIGHT_DIM) this.dimTarget = FIGHT_DIM; }
    lift() { this.dimTarget = 0; }

    update(dt) {
        for (let i = this.beats.length - 1; i >= 0; i--) if ((this.beats[i].t -= dt) <= 0) { const b = this.beats.splice(i, 1)[0]; b.fn(); }
        const a = this.dim.alpha, step = dt / 600;
        if (a !== this.dimTarget) {
            const na = a < this.dimTarget ? Math.min(this.dimTarget, a + step) : Math.max(this.dimTarget, a - step);
            this.dim.setAlpha(na).setVisible(na > 0);
        }
        if (this.stripeT > 0) { this.stripeT -= dt; this.drawStripes(); if (this.stripeT <= 0) this.stripes.clear().setVisible(false); }
    }

    drawStripes() {
        // two amber hazard bands framing the banner, stripes crawl sideways; stepped blink
        const g = this.stripes.clear();
        if (((this.stripeT / 220) | 0) % 4 === 3) return;
        const y0 = Math.round(H * 0.3) - 23 - 7, y1 = Math.round(H * 0.3) + 23 + 1;
        const off = ((this.stripeT / 40) | 0) % 12;
        for (const y of [y0, y1]) {
            g.fillStyle(COLORS.k, 0.85).fillRect(0, y, W, 6);
            g.fillStyle(COLORS.A, 1);
            for (let x = -12 + off; x < W; x += 12) for (let r = 0; r < 6; r++) g.fillRect(x + r, y + r, 5, 1);
        }
    }

    clear() { this.beats.length = 0; this.stripeT = 0; this.stripes.clear().setVisible(false); this.dimTarget = 0; }

    destroy() { this.dim.destroy(); this.stripes.destroy(); }
}
