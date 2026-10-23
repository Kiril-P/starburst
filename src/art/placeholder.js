// Draws a labelled placeholder for every contract key that has no real sprite yet.
import { CONTRACT } from './contract.js';

export function bakePlaceholders(scene) {
    const { textures } = scene;
    for (const [key, [w, h, n]] of Object.entries(CONTRACT)) {
        if (textures.exists(key)) continue;
        const tex = textures.createCanvas(key, w * n, h);
        const ctx = tex.context;
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = '#ff00ff55';
            ctx.fillRect(i * w, 0, w, h);
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(i * w + 0.5, 0.5, w - 1, h - 1);
            ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w + w, h); ctx.stroke();
        }
        tex.refresh();
        if (n > 1) for (let i = 0; i < n; i++) tex.add(i, 0, i * w, 0, w, h);
    }
}
