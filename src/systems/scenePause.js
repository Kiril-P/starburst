// Freeze / thaw everything a scene has in flight (timers, tweens, sprite anims, particles, physics, sounds)
// so a pause overlay can be shown on top. Only things running at freeze time are paused, so the overlay's
// own tweens/timers created afterwards keep working, and thaw() only resumes what we paused.
export function freeze(scene) {
    const clock = scene.time;
    const events = [...clock._active, ...clock._pendingInsertion].filter((e) => !e.paused);
    for (const e of events) e.paused = true;
    const tweens = scene.tweens.getTweens().filter((t) => t.isPlaying());
    for (const t of tweens) t.pause();
    const objs = [];
    for (const o of scene.children.list) {
        if (o.anims && o.anims.isPlaying) { o.anims.pause(); objs.push(o); }
        else if (o.type === 'ParticleEmitter' && !o.paused) { o.pause(); objs.push(o); }
    }
    if (scene.physics && scene.physics.world) scene.physics.pause();
    scene.sound.pauseAll();
    return { events, tweens, objs };
}

export function thaw(scene, token) {
    if (!token) return;
    for (const e of token.events) e.paused = false;
    for (const t of token.tweens) if (t.isPaused()) t.resume();
    for (const o of token.objs) {
        if (!o.scene) continue;   // destroyed meanwhile
        if (o.type === 'ParticleEmitter') o.resume(); else o.anims.resume();
    }
    if (scene.physics && scene.physics.world) scene.physics.resume();
    scene.sound.resumeAll();
}
