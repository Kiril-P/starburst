// "Rotate your device" overlay for phones held upright: the 16:9 game letterboxes to a strip a third of the screen tall
// in portrait. It's a DOM layer above the canvas (not a scene) so it works before the game boots and on every screen.
// A running round is paused while it shows. Tapping it dismisses it for the session (rotation lock, tablets on a stand).
// Pixel style: the icon is a text-map sprite rasterized with the game palette and scaled by an integer; text uses the
// game's pixel fonts in palette colours.
import { rasterize } from '../art/bake.js';
import { PALETTE } from '../art/palette.js';

const ICON = {
    key: 'rotate_hint',
    rows: [
        '.kkkkkkkk.........',
        '.k555555k..AAA....',
        '.k5nnnn5k....AA...',
        '.k5ncCn5k.....A...',
        '.k5nCcn5k.....A...',
        '.k5nnnn5k...AAAAA.',
        '.k5nnnn5k....AAA..',
        '.k5nnnn5k.....A...',
        '.k5nnnn5k.........',
        '.k5nnnn5k.........',
        '.k5nnnn5k.........',
        '.k555555k.........',
        '.k553355k.........',
        '.k555555k.........',
        '.kkkkkkkk.........',
        '..................'
    ]
};
const SCALE = 6;

function build() {
    const el = document.createElement('div');
    el.id = 'rotate-hint';
    Object.assign(el.style, {
        position: 'fixed', inset: '0', display: 'none', zIndex: '10', background: PALETTE.k,
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center'
    });
    const spr = rasterize(ICON)[0];
    const cv = document.createElement('canvas');
    cv.width = spr.w; cv.height = spr.h;
    cv.getContext('2d').putImageData(new ImageData(spr.frames[0], spr.w, spr.h), 0, 0);
    Object.assign(cv.style, { width: `${spr.w * SCALE}px`, height: `${spr.h * SCALE}px`, imageRendering: 'pixelated' });
    const line = (txt, font, px, color) => {
        const d = document.createElement('div');
        d.textContent = txt;
        Object.assign(d.style, { font: `${px}px ${font}`, color, lineHeight: `${px * 1.5}px`, textShadow: `${px / 8}px ${px / 8}px 0 ${PALETTE[1]}` });
        return d;
    };
    // amber = heads-up; dim steel for the secondary action
    el.append(cv, line('ROTATE YOUR DEVICE', '"Press Start 2P"', 16, PALETTE.A), line('TAP TO PLAY ANYWAY', '"Silkscreen"', 16, PALETTE[5]));
    document.body.appendChild(el);
    return el;
}

/** Call once with the Phaser game; returns update() to re-check after resizes. */
export function installRotateHint(game) {
    let el = null, dismissed = false, shown = false;
    const update = () => {
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const want = coarse && !dismissed && window.innerHeight > window.innerWidth * 1.1;
        if (want === shown) return;
        shown = want;
        if (want && !el) {
            el = build();
            el.addEventListener('pointerdown', () => { dismissed = true; update(); });
        }
        if (el) el.style.display = want ? 'flex' : 'none';
    };
    // checked every step (cheap) so a round that starts while the hint is up gets paused too
    const holdRun = () => {
        if (!shown) return;
        const g = game.scene && game.scene.getScene('Game');
        if (g && g.sys.isActive() && !g.paused && !g.dying && !g.upgradeScreen && g.setPaused) g.setPaused(true);
    };
    game.events.on('poststep', holdRun);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
    return update;
}
