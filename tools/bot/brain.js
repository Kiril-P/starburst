// In-page half of the balance bot (tools/bot.mjs), part 2: the pilot. Reads the live Game scene (player, enemy
// bullets, enemies, boss hit circles, boss telegraphs, sniper lasers, pickups) and steers by injecting held keys
// (synthetic KeyboardEvents with the default bindings, exactly what a keyboard player sends).
//
// Each decision tries 25 short plans (9 directions held, held then released, or tapped to turn the ship) over a lookahead horizon,
// predicting bullets with their real kinematics (skilled) or straight lines (casual), and scores them:
//   danger (distance to every predicted bullet / body, hits dominate) + edge/corner penalty + preferred height +
//   lining up under a target + facing it (the ship fires where it last moved) + pickups.
// Human-ish limits per profile: the decision runs every `think` ms and is applied `lag` ms later (reaction time),
// perception noise, only the `attention` nearest bullets are seen, telegraph reading, and occasional lapses.
(() => {
    const PROFILES = {
        // lag = visual reaction + motor time; casual ~ an average adult, skilled ~ a practised shmup player
        casual: { lag: 280, think: 100, noise: 4, attention: 18, horizon: 480, kinematic: false, telegraphs: 0.4, lapse: 0.05, lapseMs: 450, abilityUse: 0.4, greedy: 0.6, policy: 'casual' },
        skilled: { lag: 170, think: 50, noise: 1.5, attention: 60, horizon: 750, kinematic: true, telegraphs: 1, lapse: 0, lapseMs: 0, abilityUse: 1, greedy: 1.8, policy: 'skilled' },
        // no reaction delay, sees everything: what it still can't dodge is a fairness suspect, not a skill issue
        // never moves (still fires and picks cards like `skilled`): the "I didn't even move" check, a wave a statue survives is a wave that asks nothing
        statue: { lag: 0, think: 100, noise: 0, attention: 0, horizon: 100, kinematic: false, telegraphs: 0, lapse: 0, lapseMs: 0, abilityUse: 0, greedy: 0, policy: 'skilled', idle: true },
        oracle: { lag: 0, think: 33, noise: 0, attention: 250, horizon: 900, kinematic: true, telegraphs: 1, lapse: 0, lapseMs: 0, abilityUse: 1, greedy: 1, policy: 'skilled' }
    };
    const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', fire: 'Space', dash: 'ShiftLeft', forcefield: 'KeyZ', phase: 'KeyX' };
    const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const SUB = 50;   // ms per prediction sub-step
    const SHOT_SPEED = 420;   // px/s, the blaster (tuning PLAYER.shotSpeed); close enough for leading other weapons
    const Wd = 640, Hd = 360;

    const B = (window.__brain = { held: new Set(), queue: [], stats: { decisions: 0, lapses: 0 } });

    B.init = (name, seed) => {
        B.prof = PROFILES[name];
        let s = seed >>> 0 || 1;
        B.rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        B.gauss = () => Math.sqrt(-2 * Math.log(1 - B.rnd())) * Math.cos(6.2832 * B.rnd());
        B.nextThink = 0; B.lapseUntil = 0; B.chargeT = 0;
    };

    const key = (code, down) => {
        if (down === B.held.has(code)) return;
        if (down) B.held.add(code); else B.held.delete(code);
        window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
    };
    const tap = (code) => { key(code, false); key(code, true); key(code, false); };
    B.releaseAll = () => { for (const c of [...B.held]) key(c, false); B.queue.length = 0; };

    /** called every frame by tools/bot.mjs while the Game scene runs; now = virtual ms */
    B.tick = (g, now) => {
        const p = g.player, P = B.prof;
        // apply decisions whose reaction delay has elapsed
        while (B.queue.length && B.queue[0].at <= now) apply(g, B.queue.shift());
        fire(g, p);
        if (!p.alive || !p.controllable || g.dying) return;
        if (now < B.nextThink) return;
        B.nextThink = now + P.think;
        if (now < B.lapseUntil) return;
        if (P.lapse && B.rnd() < P.lapse * (P.think / 1000)) { B.lapseUntil = now + P.lapseMs; B.stats.lapses++; return; }
        B.stats.decisions++;
        B.queue.push({ at: now + P.lag, ...decide(g, p) });
    };

    function apply(g, d) {
        const [dx, dy] = d.dir;
        key(KEYS.left, dx < 0); key(KEYS.right, dx > 0); key(KEYS.up, dy < 0); key(KEYS.down, dy > 0);
        if (d.ability) tap(KEYS[d.ability]);
    }

    // hold fire; the CHARGE primary needs release cycles to shoot
    function fire(g, p) {
        if (g.arsenal.primary !== 'charge') { key(KEYS.fire, true); return; }
        const ms = g.arsenal.stats('charge').chargeMs + 40;
        B.chargeT += 1000 / 60;
        key(KEYS.fire, B.chargeT < ms);
        if (B.chargeT >= ms + 34) B.chargeT = 0;
    }

    function threats(g, p) {
        const P = B.prof, list = [];
        for (const b of g.enemyBullets.live) {
            if (!b.alive) continue;
            const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
            if (d2 > 220 * 220) continue;
            list.push({ d2, b });
        }
        list.sort((a, c) => a.d2 - c.d2);
        const out = [];
        for (let i = 0; i < Math.min(P.attention, list.length); i++) {
            const b = list[i].b, nx = P.noise ? B.gauss() * P.noise : 0, ny = P.noise ? B.gauss() * P.noise : 0;
            out.push({ x: b.x + nx, y: b.y + ny, a: b.angle0, sp: b.speed, acc: b.accel, turn: b.turn, max: b.maxSpeed, min: b.minSpeed, vx: b.vx, vy: b.vy, r: b.r + 3 });
        }
        const bodies = [];
        for (const e of g.waves.live) if (e.alive) bodies.push(body(e, e.r + 5));
        for (const t of g.bosses.targets) bodies.push(body(t, t.r + 5));
        return { bullets: out, bodies };
    }
    function body(e, r) {
        const m = (B.mem ??= new WeakMap()), o = m.get(e), now = window.__probe.vt;
        let vx = 0, vy = 0;
        if (o && now - o.t > 0 && now - o.t < 400) { vx = (e.x - o.x) / ((now - o.t) / 1000); vy = (e.y - o.y) / ((now - o.t) / 1000); }
        if (!o || now - o.t > 120) m.set(e, { x: e.x, y: e.y, t: now });
        return { x: e.x, y: e.y, vx, vy, r };
    }

    /** predicted bullet positions per sub-step: pos[k] = [x0,y0,x1,y1,...] */
    function predict(th, steps) {
        const P = B.prof, pos = [];
        const cur = th.bullets.map((b) => ({ ...b }));
        const row0 = new Float32Array(cur.length * 2);
        cur.forEach((b, i) => { row0[i * 2] = b.x; row0[i * 2 + 1] = b.y; });
        pos.push(row0);   // pos[k] = positions after k sub-steps (pos[0] = now)
        for (let k = 1; k <= steps; k++) {
            const s = SUB / 1000, row = new Float32Array(cur.length * 2);
            cur.forEach((b, i) => {
                if (P.kinematic && (b.acc || b.turn)) {
                    b.sp = Math.min(b.max, Math.max(b.min, b.sp + b.acc * s)); b.a += b.turn * s;
                    b.vx = Math.cos(b.a) * b.sp; b.vy = Math.sin(b.a) * b.sp;
                }
                b.x += b.vx * s; b.y += b.vy * s;
                row[i * 2] = b.x; row[i * 2 + 1] = b.y;
            });
            pos.push(row);
        }
        return pos;
    }

    function decide(g, p) {
        if (B.prof.idle) return { dir: [0, 0], ability: null, cost: 0, firstHit: 0 };
        const P = B.prof, steps = Math.round(P.horizon / SUB), pre = Math.ceil(P.lag / SUB);
        const th = threats(g, p), pos = predict(th, pre + steps);
        const tgt = target(g, p), tele = telegraphs(g, p);
        const sp = p.speed, st = p.stats, rateA = -Math.log(1 - Math.min(st.accel, 99) / 100) * 60, rateD = -Math.log(1 - Math.min(st.decel, 99) / 100) * 60;
        const hw = p.ship.width / 2, hh = p.ship.height / 2;
        const minX = hw + 8, maxX = Wd - hw - 8, minY = hh + 12, maxY = Hd - hh - 40;
        const m = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, aim: p.aim };
        const move = (m, d) => {
            const s = SUB / 1000, diag = d[0] && d[1] ? 0.8 * Math.SQRT1_2 : 1, tx = d[0] * sp * diag, ty = d[1] * sp * diag;
            m.vx = tx + (m.vx - tx) * Math.exp(-(tx ? rateA : rateD) * s); m.vy = ty + (m.vy - ty) * Math.exp(-(ty ? rateA : rateD) * s);
            m.x = Math.min(maxX, Math.max(minX, m.x + m.vx * s)); m.y = Math.min(maxY, Math.max(minY, m.y + m.vy * s));
            if (d[0] || d[1]) m.aim = Math.atan2(d[1], d[0]);
        };
        // forward model: our hands only respond `lag` ms from now, so first play out what is already queued
        const now = window.__probe.vt;
        let cur = heldDir();
        for (let k = 0; k < pre; k++) {
            for (const q of B.queue) if (q.at <= now + k * SUB) cur = q.dir;
            move(m, cur);
        }
        let best = null;
        for (let c = 0; c < 25; c++) {
            // 0-8 hold a direction, 9-16 hold it for half the horizon then let go, 17-24 tap it (turns the ship)
            const d1 = DIRS[c < 9 ? c : c < 17 ? c - 8 : c - 16], d2 = c < 9 ? d1 : DIRS[0], until = c < 9 ? steps : c < 17 ? steps / 2 : 1;
            const q = { ...m };
            let cost = 0, firstHit = 99;
            for (let k = 0; k < steps; k++) {
                const x0 = q.x, y0 = q.y;
                move(q, k < until ? d1 : d2);
                const x = q.x, y = q.y, w = Math.pow(0.88, k), t = (pre + k + 1) * SUB / 1000, row = pos[pre + k + 1], prev = pos[pre + k];
                for (let i = 0; i < th.bullets.length; i++) {
                    // swept test: closest approach of the bullet to the ship during this sub-step (relative motion is
                    // linear within it). Point samples miss fast needles, which move ~20 px per 50 ms sub-step.
                    const ax = prev[i * 2] - x0, ay = prev[i * 2 + 1] - y0, bx = row[i * 2] - x, by = row[i * 2 + 1] - y;
                    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
                    const u = l2 > 0 ? Math.max(0, Math.min(1, -(ax * ex + ay * ey) / l2)) : 0;
                    const dx = ax + ex * u, dy = ay + ey * u, dd = Math.sqrt(dx * dx + dy * dy) - th.bullets[i].r;
                    if (dd < 1) { cost += 400 * w; if (firstHit > k) firstHit = k; } else if (dd < 14) cost += w * 6 / dd;
                }
                for (const o of th.bodies) {
                    const dx = o.x + o.vx * t - x, dy = o.y + o.vy * t - y, dd = Math.sqrt(dx * dx + dy * dy) - o.r;
                    if (dd < 1) { cost += 300 * w; if (firstHit > k) firstHit = k; } else if (dd < 40) cost += w * (8 / Math.max(1, dd) + (40 - dd) / 40);
                }
                cost += tele(x, y, t) * w;
            }
            const x = q.x, y = q.y;
            // positioning: low-ish on screen, away from walls/corners, at a stand-off from the target and facing it
            const edge = (v, lo, hi, mg) => (v - lo < mg ? (mg - (v - lo)) / mg : 0) + (hi - v < mg ? (mg - (hi - v)) / mg : 0);
            cost += 3 * edge(x, minX, maxX, 50) + 2 * edge(y, minY, maxY, 30);
            cost += 0.0003 * (y - Hd * 0.74) ** 2;
            if (tgt) {
                // does the firing ray (8-way, along the last pressed direction) pass the target? Skilled pilots lead a
                // moving target by its velocity x shot flight time; casual ones aim where it is.
                const lead = P.policy === 'skilled' ? Math.hypot(tgt.x - x, tgt.y - y) / SHOT_SPEED : 0;
                const rx = tgt.x + (tgt.vx || 0) * lead - x, ry = tgt.y + (tgt.vy || 0) * lead - y, ca = Math.cos(q.aim), sa = Math.sin(q.aim);
                const ahead = rx * ca + ry * sa, perp = Math.abs(-rx * sa + ry * ca);
                cost += 1.6 * P.greedy * (ahead > 0 ? Math.min(1, Math.max(0, perp - tgt.r) / 40) : 1);
                cost += 0.25 * P.greedy * Math.min(1, Math.abs(rx) / 160);
                const dist = Math.hypot(rx, ry);
                if (dist < 90) cost += 2 * (90 - dist) / 90;
            }
            for (const pk of pickups(g, p)) cost -= pk.w * Math.max(0, 1 - Math.hypot(pk.x - x, pk.y - y) / 120);
            if (!best || cost < best.cost) best = { cost, dir: d1, firstHit };
        }
        B.last = best;
        let ability = null;
        if (best.firstHit <= 4 && B.rnd() < P.abilityUse) ability = pickAbility(p, best.firstHit);
        else if (P.policy === 'skilled' && th.bullets.filter((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 50 * 50).length > 22 && p.levels.forcefield && p.cd.forcefield <= 0) ability = 'forcefield';
        return { dir: best.dir, ability };
    }

    function heldDir() {
        const h = B.held;
        return [h.has(KEYS.left) ? -1 : h.has(KEYS.right) ? 1 : 0, h.has(KEYS.up) ? -1 : h.has(KEYS.down) ? 1 : 0];
    }

    function pickAbility(p, k) {
        const ready = (id) => p.levels[id] && p.cd[id] <= 0;
        if (ready('dash') && k >= 1) return 'dash';
        if (ready('forcefield')) return 'forcefield';
        if (ready('phase')) return 'phase';
        return null;
    }

    /** what to shoot at: boss weak spot, else the enemy closest in x above us (a casual player picks the nearest) */
    function target(g, p) {
        const t = pickTarget(g, p);
        if (!t) return null;
        const v = body(t, 0);   // velocity estimate from the body tracker
        return { x: t.x, y: t.y, r: t.r, vx: v.vx, vy: v.vy };
    }
    function pickTarget(g, p) {
        const ts = g.bosses.targets, boss = g.bosses.boss;
        if (ts.length) {
            // armour first (Colossus: the core deflects until every plate is gone), else the best weak spot
            const plates = ts.filter((t) => t.alive && t.plate);
            if (plates.length && boss.phase === 0) return plates.reduce((a, t) => (Math.abs(t.x - p.x) < Math.abs(a.x - p.x) ? t : a), plates[0]);
            const live = ts.filter((t) => t.alive);
            if (live.length) return live.reduce((a, t) => ((t.mult || 1) > (a.mult || 1) ? t : a), live[0]);
        }
        let best = null, bd = 1e9;
        for (const e of g.waves.live) {
            if (!e.alive || e.y < 0 || e.x < 0 || e.x > Wd || e.type.minor) continue;
            const d = B.prof.policy === 'casual' ? Math.hypot(e.x - p.x, e.y - p.y) : Math.abs(e.x - p.x) + Math.max(0, e.y - p.y) * 2;
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    /** telegraph reading: amber walls / lanes / rings that are about to turn into bullets, sniper lock lines */
    function telegraphs(g, p) {
        const k = B.prof.telegraphs, items = [];
        const warn = g.bosses.boss?.warn;
        if (k && warn) for (const it of warn.items) items.push(it);
        const lasers = [];
        for (const e of g.waves.live) if (e.alive && e.typeName === 'sniper' && e.charge > 0) lasers.push({ x: e.x, y: e.y + 11, a: e.aimA, ms: e.charge });
        // laser beams (objects/beams.js): a band is live from chargeMs to chargeMs + fireMs of its own clock
        const beams = (g.beams?.items || []).map((b) => ({ x: b.x, y: b.y, a: b.a0 ?? b.a, sweep: b.sweep || 0, half: b.w / 2 + 9, t: b.t, c: b.chargeMs, f: b.fireMs }));
        return (x, y, t) => {
            let c = 0;
            for (const b of beams) {
                const ca = Math.cos(b.a), sa = Math.sin(b.a), rx = x - b.x, ry = y - b.y;
                if (rx * ca + ry * sa < 0) continue;
                if (b.sweep) {   // a sweeping band covers the whole sector between its two telegraphed edges
                    const dist = Math.hypot(rx, ry) || 1;
                    if (Math.abs(Math.atan2(ry, rx) - b.a) > b.sweep + b.half / dist) continue;
                } else if (Math.abs(-rx * sa + ry * ca) > b.half) continue;
                const at = b.t + t * 1000;
                if (at >= b.c - 120 && at <= b.c + b.f) c += 720 * k; else if (at < b.c) c += 0.8 * k;   // a band does 1.8x a bullet's damage, so it costs 1.8x a bullet hit
            }
            for (const it of items) {
                if (it.ms > 1400) continue;
                const ca = Math.cos(it.a), sa = Math.sin(it.a), rx = x - it.x, ry = y - it.y;
                const along = rx * ca + ry * sa, off = Math.abs(-rx * sa + ry * ca);
                if (it.kind === 'wall') c += along > it.g0 && along < it.g1 ? -0.6 * k : 1.2 * k;   // the wall sweeps: only the gap is safe
                else if (it.kind === 'lane') { if (Math.abs(x - it.x) < it.w / 2 + 6) c += 2 * k; }
                else if (it.kind === 'ring') { if (Math.hypot(rx, ry) < (it.r || 20) + 10) c += 1.5 * k; }
                else if (it.kind === 'line' && along > 0 && off < 10) c += 1.5 * k;
            }
            for (const l of lasers) {
                const rx = x - l.x, ry = y - l.y, off = Math.abs(-rx * Math.sin(l.a) + ry * Math.cos(l.a));
                if (l.ms < 900 && off < 12) c += 3 * k;
            }
            return c;
        };
    }

    function pickups(g, p) {
        const out = [], low = p.hp / p.maxHp;
        for (const pk of g.loot.pickups.live) {
            if (!pk.alive) continue;
            const kind = pk.def.kind;
            const w = kind === 'repair' ? (low < 0.7 ? 2.5 : 0.2) : kind === 'gem' ? 0.15 : 1.2;
            out.push({ x: pk.px, y: pk.py, w: w * Math.min(1, B.prof.greedy) });
        }
        return out;
    }

    // ---- upgrade picks ------------------------------------------------------------------------------------------
    /** returns the index of the card to take */
    B.pickUpgrade = (g, options) => {
        const p = g.player, hp = p.hp / p.maxHp, a = g.arsenal;
        const score = (o) => {
            const id = o.id;
            if (B.prof.policy === 'casual') return (id === 'heal' ? (hp < 0.45 ? 5 : 0.5) : o.tag === 'NEW' || o.tag === 'WEAPON' ? 1.5 : 1) + B.rnd() * 1.5;
            if (id === 'heal') return hp < 0.5 ? 10 : hp < 0.75 ? 3 : 0.2;
            if (id === 'hull') return 3 + (1 - hp) * 3;
            if (id.startsWith('syn:')) return 7;
            if (id === 'forcefield' || id === 'dash') return p.levels[id] ? 3.5 : 6;
            if (id === 'phase') return p.levels.phase ? 2 : 3;
            if (id === 'thrusters') return 2;
            const k = id.slice(2);
            if (k === a.primary) return 5;
            if (k === 'missiles' || k === 'drones') return 4.5;
            if (k === 'spread' && a.primary === 'blaster' && a.lv.blaster < 2) return 4;
            return 1;   // swapping primaries mid-run: rarely worth it
        };
        let bi = 0, bs = -1;
        options.forEach((o, i) => { const s = score(o); if (s > bs) { bs = s; bi = i; } });
        return bi;
    };

    B.PROFILES = PROFILES;
})();
