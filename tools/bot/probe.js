// In-page half of the balance bot (tools/bot.mjs), part 1: the fixed-step virtual clock and the run recorder.
// Injected as plain script text after the game boots (dev build only: needs window.__game / window.__dbg).
//
// Clock: the bot stops Phaser's requestAnimationFrame loop and steps the game itself with an exact 1/60 s delta,
// as fast as the CPU allows. performance.now() is replaced by the virtual time (tools/bot.mjs installs the hook
// before any game code runs) so hit-stop / slow-mo, which run on "real" time, last the same *simulated* time as
// in a real session. Only every `renderEvery`-th frame is rendered (render cost is measured on those).
//
// Recorder: wraps a few Game methods (never edits game code) to attribute every bullet to whoever fired it and
// every point of damage to a source, and keeps per-wave / per-boss / upgrade / pickup / perf stats.
(() => {
    const DT = 1000 / 60;
    const P = (window.__probe = {
        vt: 0, frame: 0, renderEvery: 30, src: 'none', atk: '',
        perf: { upd: [], rnd: [] }, waves: {}, bosses: [], hits: [], picks: [], pickups: {}, abil: { dash: 0, forcefield: 0, phase: 0 },
        flags: [], end: null, wired: null
    });
    const realNow = window.__realNow || performance.now.bind(performance);

    P.takeover = () => {
        const g = window.__game, loop = g.loop;
        loop.sleep();
        loop.smoothStep = false;
        P.vt = realNow();
        loop.lastTime = P.vt;
        window.__vclock = P;   // performance.now() now returns P.vt
        P.stepR = g.step.bind(g);
        P.stepH = g.headlessStep.bind(g);
        // Text / canvas textures upload to the GPU on every change (the HUD score changes nearly every frame). With
        // SwiftShader that is CPU work in the GPU process, and with many sims in parallel it dominated the run time.
        // Defer re-uploads of existing textures to the next rendered frame (latest canvas wins); new textures still
        // upload immediately. Nothing reads those textures between renders, so the simulation is unaffected.
        const r = g.renderer;
        if (r && r.canvasToTexture && !r.__deferred) {
            const up = r.canvasToTexture, pending = new Map();
            r.__deferred = true;
            r.canvasToTexture = function (canvas, dst, noRepeat, flipY) {
                if (!dst || P.rendering) return up.call(this, canvas, dst, noRepeat, flipY);
                pending.set(dst, [canvas, noRepeat, flipY]);
                return dst;
            };
            // a texture destroyed since (pooled float texts) has no gl any more: nothing to upload
            P.flushTextures = () => { for (const [dst, [c, nr, fy]] of pending) if (dst.gl && dst.webGLTexture) up.call(r, c, dst, nr, fy); pending.clear(); };
        }
    };

    /** advance up to `frames` fixed steps; tick(frame) runs before each step and may return true to stop */
    P.run = (frames, tick) => {
        const loop = window.__game.loop;
        for (let i = 0; i < frames; i++) {
            if (tick && tick()) return true;
            P.vt += DT;
            P.frame++;
            const render = P.frame % P.renderEvery === 0;
            loop.callback = render ? P.stepR : P.stepH;
            const t0 = realNow();
            if (render && P.flushTextures) P.flushTextures();
            P.rendering = render;
            loop.step(P.vt);
            P.rendering = false;
            const ms = realNow() - t0;
            (render ? P.perf.rnd : P.perf.upd).push(ms);
            if (P.end) return true;
        }
        return false;
    };

    const W = (obj, name, wrap) => { const f = obj[name]; obj[name] = wrap(f); };

    /** wire the recorder into a fresh Game scene */
    P.wire = (g) => {
        if (P.wired === g) return;
        P.wired = g;
        const live = () => g.waves.live.length;
        W(g.enemyBullets, 'spawn', (f) => function (x, y) {
            const b = f.apply(this, arguments);
            if (b) { b.src = P.src; b.sx = x; b.sy = y; }
            return b;
        });
        W(g.waves, 'spawn', (f) => function () {
            const e = f.apply(this, arguments);
            e.bornAt = P.vt;
            if (!e.__probe) {
                e.__probe = true;
                const u = e.update;
                e.update = function (dt, c) { const prev = P.src; P.src = this.typeName; const r = u.call(this, dt, c); P.src = prev; return r; };
            }
            return e;
        });
        W(g.seq, 'run', (f) => function (owner, every, times, step) {
            const src = P.src;
            return f.call(this, owner, every, times, function () { const prev = P.src; P.src = src; step.apply(this, arguments); P.src = prev; });
        });
        W(g.bosses, 'update', (f) => function (dt) {
            const b = this.boss, prev = P.src;
            if (b && b.alive) {
                if (!b.__probe) {
                    b.__probe = true;
                    const A = b.attacks;
                    b.attacks = function (p) { return A.call(this, p).map((fn) => function () { P.atk = fn.name.replace('bound ', ''); return fn.apply(this, arguments); }); };
                }
                P.src = `boss:${b.def.id}/p${b.phase + 1}/${P.atk}`;
            }
            f.call(this, dt);
            P.src = prev;
        });
        W(g.combat, 'killEnemy', (f) => function (e) { const prev = P.src; P.src = 'shards:' + e.typeName; f.apply(this, arguments); P.src = prev; });
        W(g.combat, 'bulletHit', (f) => function (b) { P.hit = { src: b.src || '?', age: b.age, sd: Math.hypot(b.sx - g.player.x, b.sy - g.player.y) }; f.call(this, b); });
        W(g.combat, 'ram', (f) => function (e) {
            P.hit = { src: 'ram:' + (e.typeName || (g.bosses.boss ? 'boss:' + g.bosses.boss.def.id : '?')), age: e.bornAt ? P.vt - e.bornAt : 9999, sd: 0 };
            f.call(this, e);
        });
        W(g.combat, 'hurt', (f) => function (amount) {
            const p = g.player, hp0 = p.hp;
            f.call(this, amount);
            const h = P.hit || { src: 'other', age: 9999, sd: 0 };
            P.hit = null;
            if (p.hp >= hp0) return;
            const rec = { t: Math.round(P.vt - P.t0), wave: g.waves.wave, src: h.src, dmg: hp0 - p.hp, hp: p.hp, age: Math.round(h.age), sd: Math.round(h.sd), bullets: g.enemyBullets.count };
            P.hits.push(rec);
            P.wave().dmg += rec.dmg; P.wave().hits++;
            if (P.boss) P.boss.dmg += rec.dmg;
            if (rec.age < 250 && rec.sd < 40) P.flags.push({ kind: 'point-blank', ...rec });
            if (!p.alive) P.death = rec;
        });
        W(g.loot, 'collect', (f) => function (p) { P.pickups[p.type] = (P.pickups[p.type] || 0) + 1; return f.call(this, p); });
        W(g.player, 'tryAbility', (f) => function (id) { const cd = this.cd[id]; f.call(this, id); if (this.cd[id] > cd) P.abil[id]++; });
        P.t0 = P.vt;
        P.lastState = null;
        P.live = live;
    };

    P.wave = (n = P.wired.waves.wave) => (P.waves[n] ??= { start: Math.round(P.vt - P.t0), ms: 0, dmg: 0, hits: 0, maxBullets: 0, sumBullets: 0, frames: 0, maxEnemies: 0, kills0: P.wired.combat.stats.kills });

    /** per-frame bookkeeping while a Game scene runs */
    P.observe = (g) => {
        const w = P.wave(), wm = g.waves;
        const n = g.enemyBullets.count;
        if (!g.paused && g.sys.isActive()) {
            w.frames++; w.sumBullets += n; w.maxBullets = Math.max(w.maxBullets, n);
            w.maxEnemies = Math.max(w.maxEnemies, wm.live.length);
            if (wm.state === 'active' || wm.state === 'boss') w.ms += DT;
        }
        w.kills = g.combat.stats.kills - w.kills0;
        w.state = wm.state;
        const b = g.bosses.boss;
        if (b && b.alive && (!P.boss || P.boss.obj !== b)) {
            P.boss = { obj: b, id: b.def.id, kind: b.def.kind, wave: wm.wave, hp: b.maxHp, dmg: 0, ms: 0, result: 'fighting', phase: 0 };
            P.bosses.push(P.boss);
        }
        if (P.boss) {
            const pb = P.boss;
            pb.ms = Math.round(g.bosses.fightMs || 0);
            pb.phase = Math.max(pb.phase, pb.obj.phase + 1);
            pb.hpLeft = Math.round(pb.obj.hp / pb.obj.maxHp * 100);
            if (!pb.obj.alive && pb.result === 'fighting') { pb.result = 'killed'; P.boss = null; }
            else if (!g.player.alive && pb.result === 'fighting') pb.result = 'died';
        }
        // soft-lock guards: a timed wave can't run much past its timer, a boss can't take forever
        if (wm.state === 'active' && w.ms > wm.cfg.duration + 5000) P.flag('timed wave overran its timer', g);
        if (wm.state === 'boss' && w.ms > 360000) P.flag('boss fight longer than 6 minutes', g);
        if (wm.state === 'boss' && b && b.alive && b.state === 'fight' && b.invulnerable) {
            P.invulnMs = (P.invulnMs || 0) + DT;
            if (P.invulnMs > 30000) P.flag('boss invulnerable for 30s straight', g);
        } else P.invulnMs = 0;
        if (P.prevState !== wm.state) { P.stateAt = P.vt; P.prevState = wm.state; }
        if (['cleared', 'upgrade', 'next', 'intro'].includes(wm.state) && P.vt - P.stateAt > 60000) P.flag(`stuck in wave state ${wm.state}`, g);
    };

    P.flag = (why, g) => {
        if (P.flags.some((f) => f.kind === why)) return;
        P.flags.push({ kind: why, wave: g.waves.wave, t: Math.round(P.vt - P.t0) });
        if (/stuck|longer|overran|invulnerable/.test(why)) P.end = { result: 'softlock', why, wave: g.waves.wave };
    };

    const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2); };
    P.summary = () => {
        const waves = {};
        for (const [k, w] of Object.entries(P.waves)) waves[k] = { start: w.start, ms: Math.round(w.ms), dmg: Math.round(w.dmg), hits: w.hits, kills: w.kills, maxBullets: w.maxBullets, avgBullets: Math.round(w.sumBullets / Math.max(1, w.frames)), maxEnemies: w.maxEnemies, state: w.state };
        const u = P.perf.upd, r = P.perf.rnd;
        return {
            waves, bosses: P.bosses.map(({ obj, ...b }) => b), hits: P.hits, death: P.death || null, picks: P.picks, pickups: P.pickups, abil: P.abil,
            flags: P.flags, simMs: Math.round(P.vt - P.t0),
            perf: { updP50: pct(u, 0.5), updP99: pct(u, 0.99), updMax: pct(u, 1), rndP50: pct(r, 0.5), rndP95: pct(r, 0.95) }
        };
    };
})();
