// One HUD ability slot: icon inside a pixel ring whose lit arc is the recharge progress (clockwise from 12 o'clock).
// The ring is rasterised pixel-by-pixel into a small CanvasTexture (no antialiased arcs) and only redrawn when the
// quantised state changes, so update() is allocation-free.
import { PALETTE, COLORS } from '../art/palette.js';
import { pxText, centerText } from './text.js';
import { TEXT } from './widgets.js';

const S = 34;           // canvas size; ring outer diameter 28 + 1px outline + 2px ready halo
const C = S / 2;
const R_IN = 11, R_OUT = 14;
const STEPS = 72;       // quantisation of the sweep (about one ring pixel per step)

// ring/halo pixel lists, computed once: [x, y, angle01, band] band 0 = ring, 1 = outline, 2 = halo, 3 = inner disc
let PIXELS = null;
function pixels() {
    if (PIXELS) return PIXELS;
    PIXELS = [];
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const dx = x + 0.5 - C, dy = y + 0.5 - C;
            const r = Math.hypot(dx, dy);
            let a = Math.atan2(dx, -dy) / (Math.PI * 2);
            if (a < 0) a += 1;
            const band = r < R_IN ? 3 : r < R_OUT ? 0 : r < R_OUT + 1 ? 1 : r < R_OUT + 2.5 ? 2 : -1;
            if (band >= 0) PIXELS.push([x, y, a, band, r]);
        }
    }
    return PIXELS;
}

// colour ramps per ability: [dark, mid, bright, highlight]
const RAMP = { cyan: ['n', 'c', 'C', 'b'], magenta: ['p', 'm', 'M', 'q'], lime: ['g', 'l', 'L', 'j'], steel: ['1', '2', '3', '4'] };

export default class AbilitySlot {
    /** opts { icon, ramp: 'cyan'|'magenta'|'lime', key: 'SHIFT', name } */
    constructor(scene, x, y, index, opts) {
        this.scene = scene;
        this.opts = opts;
        const key = `hud_ring_${index}`;
        this.tex = scene.textures.exists(key) ? scene.textures.get(key) : scene.textures.createCanvas(key, S, S);
        this.ctx = this.tex.getContext();
        this.ring = scene.add.image(x - C, y - C, key).setOrigin(0, 0);
        this.icon = scene.add.image(x - 8, y - 8, opts.icon).setOrigin(0, 0);
        this.label = pxText(scene, x, y + R_OUT + 2, opts.key, { color: TEXT.dim });
        centerText(this.label, x);
        this.x = x;
        this.objects = [this.ring, this.icon, this.label];
        this.drawKey = -2;
        this.wasReady = true;
        this.pulseT = 0;     // ms left of the "ready" flash
        this.glintT = 0;     // ms clock for the idle glint that circles a ready ring
        this.state = 'ready';
    }

    /** a = { unlocked, cooldown01, active, key } (may be undefined: treated as locked) */
    update(a, dt) {
        const unlocked = !!(a && a.unlocked);
        const cd = unlocked ? Math.min(1, Math.max(0, a.cooldown01 || 0)) : 0;
        const ready = unlocked && cd <= 0;
        const active = unlocked && !!a.active;
        if (ready && !this.wasReady && !active) this.pulseT = 320;
        this.wasReady = ready;
        if (this.pulseT > 0) this.pulseT -= dt;
        this.glintT = (this.glintT + dt) % 2400;

        const state = !unlocked ? 'locked' : active ? 'active' : ready ? 'ready' : 'cool';
        if (state !== this.state) {
            this.state = state;
            this.icon.setTexture(unlocked ? this.opts.icon : 'icon_lock');
            if (state === 'cool') this.icon.setTint(COLORS[4]); else this.icon.clearTint();
            this.label.setColor(state === 'locked' ? TEXT.muted : state === 'cool' ? TEXT.dim : TEXT.light);
            if (a && a.key && a.key !== this.label.text) { this.label.setText(a.key); centerText(this.label, this.x); }
        }

        // the active state blinks; ready shows a glint running round the ring for the first 600ms of every 2.4s
        const blink = active ? ((this.glintT / 90) | 0) & 1 : 0;
        const glint = state === 'ready' && this.glintT < 600 ? (this.glintT / 600 * 24) | 0 : -1;
        const pulse = this.pulseT > 0 ? 1 + (((this.pulseT / 80) | 0) & 1) : 0;
        const k = state === 'locked' ? -1 : state === 'cool' ? Math.floor((1 - cd) * STEPS) : 1000 + blink * 100 + pulse * 30 + glint + (active ? 500 : 0);
        if (k !== this.drawKey) {
            this.drawKey = k;
            this.draw(state, 1 - cd, blink, glint, pulse);
        }
    }

    draw(state, ready01, blink, glint, pulse) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, S, S);
        const ramp = RAMP[state === 'locked' ? 'steel' : this.opts.ramp];
        const glintA = glint / 24;
        for (const [x, y, a, band, r] of pixels()) {
            let ch = null;
            if (band === 3) ch = state === 'locked' ? 'k' : 'u';
            else if (band === 1) ch = 'k';
            else if (band === 0) {
                const inner = r < R_IN + 1; // 1px inner bevel row is one step darker
                if (state === 'locked') ch = inner ? '1' : '2';
                else if (state === 'cool') {
                    const lit = a <= ready01;
                    // leading edge pixels of the sweep get the highlight so motion reads
                    ch = lit ? (ready01 - a < 0.03 ? ramp[3] : inner ? ramp[1] : ramp[2]) : inner ? 'k' : ramp[0];
                } else if (state === 'active') ch = blink ? (inner ? ramp[2] : 'w') : inner ? ramp[2] : ramp[3];
                else {
                    ch = inner ? ramp[1] : ramp[2];
                    if (pulse) ch = inner ? ramp[3] : 'w';
                    else if (glint >= 0 && Math.abs(a - glintA) < 0.045) ch = ramp[3];
                }
            } else if (band === 2) {
                // halo: dithered checkerboard ring during the ready flash and while active
                if ((pulse || state === 'active') && ((x + y) & 1) === (pulse === 2 ? 1 : 0)) ch = ramp[2];
            }
            if (!ch) continue;
            ctx.fillStyle = PALETTE[ch];
            ctx.fillRect(x, y, 1, 1);
        }
        this.tex.refresh();
    }

    setVisible(v) { this.objects.forEach((o) => o.setVisible(v)); }
}
