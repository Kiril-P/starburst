// Display data for the menu. Stats/modifiers are the v1 values (shown to the player; gameplay owns the real tuning).
import { COLORS, PALETTE } from '../../art/palette.js';

// Ship classes, in showcase order (matches SHIPS in config.js). Stats are 0..1 relative to the best ship.
export const SHIP_INFO = {
    normal: {
        name: 'PULSAR', cls: 'NORMAL', desc: 'BALANCED PERFORMANCE FOR ALL PILOTS',
        stats: { hp: 0.6, damage: 0.6, speed: 0.6, fireRate: 0.6 },
        accent: COLORS.C, accentDark: COLORS.c, accentCss: PALETTE.C
    },
    speedy: {
        name: 'NOVA DART', cls: 'SPEEDY', desc: 'LIGHTNING FAST, REDUCED DEFENCES',
        stats: { hp: 0.3, damage: 0.5, speed: 1.0, fireRate: 1.0 },
        accent: COLORS.L, accentDark: COLORS.l, accentCss: PALETTE.L
    },
    tank: {
        name: 'TITAN', cls: 'TANK', desc: 'HEAVY ARMOUR, SLOWER MOVEMENT',
        stats: { hp: 1.0, damage: 0.8, speed: 0.3, fireRate: 0.2 },
        accent: COLORS.A, accentDark: COLORS.a, accentCss: PALETTE.A
    }
};

export const STAT_LABELS = [['hp', 'HULL'], ['damage', 'DAMAGE'], ['speed', 'SPEED'], ['fireRate', 'FIRE RATE']];

// Difficulty presets (v1 descriptions and modifiers). spawn > 1 means slower spawns.
export const DIFFICULTY_INFO = {
    easy: {
        name: 'EASY', desc: 'FEWER ENEMIES, LOWER HEALTH, LESS DAMAGE',
        mods: { health: 0.7, damage: 0.7, spawn: 1.3, max: 0.7 }, color: COLORS.L, css: PALETTE.L
    },
    normal: {
        name: 'NORMAL', desc: 'STANDARD CHALLENGE FOR MOST PILOTS',
        mods: { health: 1.0, damage: 1.0, spawn: 1.0, max: 1.0 }, color: COLORS.C, css: PALETTE.C
    },
    hard: {
        name: 'HARD', desc: 'MORE ENEMIES, HIGHER HEALTH, MORE DAMAGE',
        mods: { health: 1.3, damage: 1.3, spawn: 0.8, max: 1.3 }, color: COLORS.R, css: PALETTE.R
    }
};

// rows shown in the difficulty panel: [label, value(mods)]. Every row reads "higher = harder" (spawn is a delay, so invert).
export const MOD_LABELS = [
    ['ENEMY HEALTH', (m) => m.health],
    ['ENEMY DAMAGE', (m) => m.damage],
    ['SPAWN RATE', (m) => 1 / m.spawn],
    ['MAX ENEMIES', (m) => m.max]
];
