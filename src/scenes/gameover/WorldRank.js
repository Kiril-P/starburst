// GameOver's world-board line: sends the finished run (systems/telemetry.js submitRun) and shows where it landed.
// First time a run could reach the boards the CALLSIGN picker opens (MenuCallsign); skipping it still sends the run, unnamed
// and unranked, because the server keeps every run for balance data. Does nothing when the build has no API or ONLINE is off.
import { DEPTH } from '../../config.js';
import { PALETTE } from '../../art/palette.js';
import { centerText, pxText } from '../../ui/text.js';
import { save } from '../../systems/Save.js';
import { online } from '../../systems/net.js';
import { submitRun } from '../../systems/telemetry.js';
import { uiDelay } from '../../ui/widgets.js';
import { openSubPanel } from '../menu/accessRows.js';

export default class WorldRank {
    /** (cx, y): centre of the line. tele = the run payload from Game (Game.gameOver); mode = 'normal' | 'daily' */
    constructor(scene, cx, y, tele, mode) {
        this.scene = scene;
        this.mode = mode;
        this.tele = tele;
        this.text = null;
        if (!tele || !online()) return;
        this.text = centerText(pxText(scene, 0, 0, '', { color: PALETTE[4], spacing: 1 }), cx, y).setDepth(DEPTH.OVERLAY).setAlpha(0);
        this.cx = cx;
        const eligible = !tele.assist && tele.score > 0;
        if (!eligible) { this.send('', tele.assist ? 'ASSIST RUN - NOT RANKED' : ''); return; }
        if (save.callsign) { this.send(save.callsign); return; }
        this.show('SET A CALLSIGN FOR THE WORLD BOARD');
        uiDelay(scene, 2000, () => this.askCallsign());   // after the score has counted up
    }

    askCallsign() {
        const sc = this.scene;
        if (!sc.scene.isActive() || sc.leaving) { this.send(''); return; }
        openSubPanel(sc, 'MenuCallsign');
        sc.scene.get('MenuCallsign').events.once('shutdown', () => this.send(save.callsign, save.callsign ? '' : 'NO CALLSIGN - NOT RANKED'));
    }

    show(msg, color = PALETTE[4]) {
        if (!this.text || !this.text.scene) return;
        this.text.setText(msg).setColor(color).setAlpha(1);
        this.text.x = Math.round(this.cx - this.text.width / 2);
    }

    async send(name, note = '') {
        if (note) this.show(note);
        else this.show('SENDING SCORE...');
        const res = await submitRun(this.tele, name);
        if (!this.text || !this.text.scene) return;   // the scene was left meanwhile (the run is sent regardless)
        const label = this.mode === 'daily' ? 'WORLD DAILY RANK' : 'WORLD RANK';
        if (note) return;
        if (!res) this.show('');
        else if (res.queued) this.show('OFFLINE - SCORE WILL BE SENT LATER');
        else if (res.rank > 0) this.show(`${label}  #${res.rank}`, res.rank <= 10 ? PALETTE.A : PALETTE.C);
        else this.show(name ? 'NOT RANKED' : '');
    }
}
