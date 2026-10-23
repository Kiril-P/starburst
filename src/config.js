// Global constants. Native resolution is 640x360 (16:9); the canvas is scaled up with nearest-neighbour.
export const W = 640;
export const H = 360;

// Draw order. Use these instead of magic numbers.
export const DEPTH = {
    BG: 0,
    BG_FAR: 1,
    BG_NEAR: 2,
    PICKUP: 10,
    ENEMY: 20,
    ENEMY_BULLET: 25,
    PLAYER: 30,
    PLAYER_BULLET: 28,
    FX: 40,
    FX_TOP: 45,
    HUD: 100,
    OVERLAY: 200,
    MODAL: 300
};

export const FONT = {
    TITLE: '"Press Start 2P"',   // 8px grid: use sizes 8, 16, 24
    UI: '"Silkscreen"'           // small caps UI text: use sizes 8, 16
};

export const SHIPS = ['normal', 'speedy', 'tank'];
export const DIFFICULTIES = ['easy', 'normal', 'hard'];
