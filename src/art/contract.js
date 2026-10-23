// The TEXTURE CONTRACT: every key the code may reference, with target size [w, h, frames].
// Art authors: your sprites must use exactly these keys and ~these sizes (you may deviate by a few pixels; update this file to match what you drew).
// Code authors: only use keys listed here. Anything not yet drawn is auto-replaced by a labelled placeholder (see placeholder.js), so you can build against it right now.
// Keys ending in a variant (`_amber`) are produced by the `variants` option in bake.js.
export const CONTRACT = {
    // --- ships.js (owner: art-ships) -------------------------------------------------------------
    // frame 0 = straight, 1 = banking left, 2 = banking right. Nose points UP. Origin centre.
    ship_normal: [25, 28, 3],     // odd widths: centre column = nose / hitbox centre
    ship_speedy: [21, 28, 3],
    ship_tank: [31, 30, 3],
    // large menu showcase versions (single frame, more detail)
    ship_normal_big: [64, 64, 1],
    ship_speedy_big: [64, 64, 1],
    ship_tank_big: [64, 64, 1],
    // engine flames, point DOWN, animated loop (fps 14). Place with origin (0.5, 0) just under the ship's tail.
    flame_normal: [13, 14, 4],    // odd widths so the jets line up with the nozzles
    flame_speedy: [11, 16, 4],
    flame_tank: [17, 14, 4],
    shield_ring: [44, 44, 4],       // forcefield bubble, animated loop
    pshot_basic: [3, 9, 1],         // player bullet, points up
    pshot_muzzle: [9, 9, 3],        // muzzle flash, plays once
    pshot_hit: [11, 11, 4],         // player bullet impact spark, plays once

    // --- enemies.js (owner: art-enemies) ---------------------------------------------------------
    // 2 idle frames (animated, fps 6). Face DOWN (they fly toward the player at the bottom).
    enemy_basic: [22, 22, 2],
    enemy_circular: [24, 24, 2],
    enemy_spread: [28, 24, 2],
    meteor_s_0: [14, 14, 1], meteor_s_1: [14, 14, 1],
    meteor_m_0: [22, 22, 1], meteor_m_1: [22, 22, 1],
    meteor_l_0: [32, 32, 1], meteor_l_1: [32, 32, 1],

    // --- enemies2.js (owner: enemies/biomes) -----------------------------------------------------
    // Face DOWN. Frames with no fps are chosen by code (see comments in enemies2.js).
    enemy_sniper: [15, 22, 2],      // 0 idle, 1 charging
    enemy_kamikaze: [13, 13, 2],
    enemy_shield: [31, 20, 2],      // 0 idle, 1 shield flash (blocked shot)
    enemy_turret: [25, 25, 4],      // barrel rotation steps of 22.5deg (4-way symmetric)
    enemy_minelayer: [29, 15, 2],
    enemy_mine: [9, 9, 3],          // 0 unarmed, 1 armed, 2 hot
    enemy_splitter: [21, 21, 2],
    enemy_splitter_s: [11, 11, 2],

    // --- bosses.js (owner: bosses) ----------------------------------------------------------------
    // Face DOWN, origin centre. Idle frames animate (fps in bosses.js) except boss_prism (frames set by code).
    boss_warden: [128, 70, 2],
    boss_hive: [120, 64, 2],
    boss_drone: [18, 16, 2],
    boss_prism: [72, 72, 4],        // 0 open, 1 pulse, 2 charging (white-hot), 3 shut (armoured, invulnerable)
    boss_prism_shard: [14, 24, 2],  // orbits the Prism (not rotated)

    // --- projectiles.js (owner: art-enemies) -----------------------------------------------------
    // default colour = magenta for orbs/rings, amber for needles, lime for shards. Variants listed.
    bullet_orb_s: [5, 5, 1],        // + _amber _lime _cyan
    bullet_orb_m: [7, 7, 1],        // + _amber _lime _cyan
    bullet_orb_l: [11, 11, 1],      // + _amber _lime _cyan
    bullet_needle: [3, 11, 1],      // points UP; + _magenta _lime
    bullet_ring: [9, 9, 1],         // + _amber _lime
    bullet_shard: [5, 9, 1],        // points UP; + _magenta _amber
    hitbox_dot: [5, 5, 2],          // player's true hitbox marker (2-frame blink)

    // --- fx.js (owner: fx-bg) --------------------------------------------------------------------
    px1: [1, 1, 1], px2: [2, 2, 1], px3: [3, 3, 1],   // white squares, use setTint for colour
    glow_s: [16, 16, 1], glow_m: [32, 32, 1], glow_l: [64, 64, 1], // dithered white halos for ADD blending, setTint for colour
    shockwave: [96, 96, 12],        // expanding 1px ring, white, plays once (fps 24)
    // explosions play once (fps 16): flash -> fireball -> violet smoke. Default = fire; + _cyan _magenta _lime
    explosion_s: [24, 24, 6],
    explosion_m: [40, 40, 7],
    explosion_l: [64, 64, 8],
    debris_0: [3, 3, 1], debris_1: [4, 4, 1], debris_2: [5, 4, 1], debris_3: [4, 5, 1],   // white/steel, tint per material
    smoke: [8, 8, 4],               // violet puff, plays once
    spark: [5, 5, 3],               // white impact star, tint at runtime, plays once
    // Background.js generates its own cached textures at runtime (bg_grad_*, bg_neb_*, bg_stars_*, bg_planet_*,
    // bg_rock_*, bg_streak_*, bg_twinkle); they are internal to the backdrop and not for use elsewhere.

    // --- icons.js (owner: art-ui) ----------------------------------------------------------------
    icon_dash: [16, 16, 1], icon_forcefield: [16, 16, 1], icon_phase: [16, 16, 1],
    icon_speed: [16, 16, 1], icon_heal: [16, 16, 1], icon_lock: [16, 16, 1],
    icon_quest: [16, 16, 1], icon_quest_done: [16, 16, 1], icon_gear: [16, 16, 1],
    icon_skull: [16, 16, 1], icon_star: [16, 16, 1], icon_heart: [16, 16, 1], icon_ship: [16, 16, 1],
    card_dash: [32, 32, 1], card_forcefield: [32, 32, 1], card_phase: [32, 32, 1],
    card_speed: [32, 32, 1], card_heal: [32, 32, 1],

    // --- pickups.js (owner: pickups/weapons) -----------------------------------------------------
    // 2 frames (frame 1 = glint), animated. Lime capsules with a glyph = timed power-ups / repair.
    gem_s: [7, 9, 2], gem_m: [9, 11, 2], gem_l: [11, 15, 2],
    pickup_repair: [13, 13, 2], pickup_magnet: [13, 13, 2], pickup_bomb: [13, 13, 2],
    pickup_shield: [13, 13, 2], pickup_rapid: [13, 13, 2], pickup_x2: [13, 13, 2],

    // --- weapons.js (owner: pickups/weapons) -----------------------------------------------------
    // player shots point UP (pool rotates them); cyan = friendly
    wshot_pellet: [3, 5, 1], wshot_heavy: [5, 11, 1], wshot_lance: [3, 17, 1], wshot_missile: [5, 11, 1],
    wshot_charge_s: [7, 7, 1], wshot_charge_m: [11, 11, 1], wshot_charge_l: [15, 15, 1],
    drone: [11, 11, 2],             // orbiting gun drone, animated
    card_blaster: [32, 32, 1], card_spread: [32, 32, 1], card_lance: [32, 32, 1], card_charge: [32, 32, 1],
    card_missiles: [32, 32, 1], card_drones: [32, 32, 1],
    card_splinter: [32, 32, 1], card_swarm: [32, 32, 1], card_overload: [32, 32, 1], card_hunter: [32, 32, 1],

    // --- ui.js (owner: art-ui) -------------------------------------------------------------------
    // nine-slice sources: corners are 8px, centre stretches
    ui_panel: [24, 24, 1], ui_panel_active: [24, 24, 1],
    ui_button: [24, 24, 1], ui_button_hover: [24, 24, 1], ui_button_press: [24, 24, 1], ui_button_disabled: [24, 24, 1],
    ui_card: [24, 24, 1], ui_card_hover: [24, 24, 1],   // + _magenta _lime _amber (cyan is the base)
    ui_bar_frame: [24, 8, 1],       // horizontal nine-slice (8px end caps)
    ui_bar_fill: [2, 6, 1],         // tile / stretch horizontally; greyscale (tintable) + _cyan _lime _amber _magenta _red
    ui_cursor: [12, 12, 1],         // mouse pointer, hotspot top-left (0,0)
    ui_logo: [224, 40, 1],          // STARBURST wordmark
    ui_logo_flare: [24, 24, 4],     // little lens-flare twinkle, animated (fps 8), centre it on LOGO_FLARE (export of sprites/ui.js, logo-local px)
    ui_arrow_l: [8, 8, 1], ui_arrow_r: [8, 8, 1],
    ui_check_off: [10, 10, 1], ui_check_on: [10, 10, 1],
    ui_knob: [8, 12, 1]
};
