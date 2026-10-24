// Runtime for wave-script events (waveScripts.js): banners, toasts, formations, supply drops, lulls and surges.
// An event fires once, at `pct` (fraction of the wave timer), `at` (ms into the wave) or `end` (ms before the timer ends).
import { W } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function eventDue(wm, ev) {
    if (ev.pct !== undefined) return wm.elapsed >= ev.pct * wm.cfg.duration;
    if (ev.end !== undefined) return wm.timeLeft <= ev.end;
    return wm.elapsed >= (ev.at ?? 0);
}

/** a falling trail of pickups that snakes down the screen: the reward beat */
function supply(wm, spec) {
    const pk = wm.scene.loot?.pickups;
    if (!pk) return;
    const cx = rand(150, W - 150), phase = rand(0, 6);
    let i = 0;
    for (const [type, n] of Object.entries(spec)) {
        for (let k = 0; k < n; k++, i++) {
            if (type === 'gem_m' || type === 'gem_l' || type === 'gem_s') pk.spawn(type, Math.round(cx + Math.sin(i * 0.55 + phase) * 80), -8 - i * 13, 0, 40);
            else pk.spawn(type, Math.round(rand(80, W - 80)), -8 - i * 13, 0, 40);   // repair / buffs drop alone
        }
    }
}

export function runEvent(wm, ev) {
    const sc = wm.scene;
    if (ev.banner) { sc.hud?.announce(ev.banner[0], ev.banner[1] ?? '', 1600); sc.audio?.play('warning', { vol: 0.6 }); }
    if (ev.toast) sc.hud?.toast(ev.toast, ev.color ?? '#ffb547');   // amber: heads-up
    if (ev.form) (Array.isArray(ev.form) ? ev.form : [ev.form]).forEach((spec, i) => wm.formations.launch(spec, true, i * (ev.gapMs ?? 1100)));
    if (ev.supply) { supply(wm, ev.supply); sc.audio?.play('wave-start', { vol: 0.5 }); }
    if (ev.calm) wm.calm = ev.calm;       // spawners hold for this long
    if (ev.surge) wm.surge = ev.surge;    // spawners run this much faster from now on
}
