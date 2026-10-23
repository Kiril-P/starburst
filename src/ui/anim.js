// Game-clock animation. Phaser tweens/timers belong to a scene and stop when gameplay pauses its clock, so UI that
// lives on a paused Game scene (upgrade picks, pause menu) animates from the game loop's 'step' event instead.

/** Calls fn(dtMs) every game step until the returned function is called or the scene shuts down. */
export function onUiStep(scene, fn) {
    const ev = scene.game.events;
    const h = (t, dt) => fn(Math.min(dt, 50));
    const off = () => {
        ev.off('step', h);
        scene.events.off('shutdown', off);
    };
    ev.on('step', h);
    scene.events.once('shutdown', off);
    return off;
}

const EASE = {
    linear: (k) => k,
    out: (k) => 1 - (1 - k) ** 3,
    in: (k) => k * k * k,
    back: (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2
};

/**
 * opts { ms, delay = 0, from = 0, to = 1, ease = 'out' | fn, steps (quantise progress into N stepped frames),
 *        onUpdate(value, k), onComplete() }. Returns { stop() }.
 */
export function uiTween(scene, o) {
    const ease = typeof o.ease === 'function' ? o.ease : EASE[o.ease ?? 'out'];
    const from = o.from ?? 0, to = o.to ?? 1, ms = Math.max(1, o.ms ?? 300);
    let t = -(o.delay ?? 0);
    let done = false;
    const off = onUiStep(scene, (dt) => {
        t += dt;
        if (t < 0) return;
        let k = Math.min(1, t / ms);
        if (o.steps) k = Math.min(1, Math.ceil(k * o.steps) / o.steps);
        o.onUpdate && o.onUpdate(from + (to - from) * ease(k), k);
        if (t >= ms) finish(true);
    });
    const finish = (complete) => {
        if (done) return;
        done = true;
        off();
        if (complete && o.onComplete) o.onComplete();
    };
    return { stop: () => finish(false) };
}

/** delayedCall on the game clock. Returns { stop() }. */
export function uiDelay(scene, ms, fn) {
    return uiTween(scene, { ms, onComplete: fn });
}
