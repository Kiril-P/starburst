// Regenerate the itch assets: node tools/make-itch-assets.mjs
// Captures the live game's nebula, then composites its exact rasterized sprites in a pixel-sharp canvas.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import { createServer } from 'vite';
import { findChrome, chromeArgs } from '../../tools/lib/browser.mjs';
import { ALL_SPRITES } from '../../src/art/index.js';
import { rasterize } from '../../src/art/bake.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'docs/media');
const selected = new Map();
for (const def of ALL_SPRITES) {
  if (['ui_logo','ship_normal_big','flame_normal','boss_warden','boss_prism','enemy_basic','enemy_spread','bullet_ring','bullet_orb_m','pshot_basic'].includes(def.key)) {
    const spr = rasterize(def)[0];
    const p = new PNG({ width: spr.w, height: spr.h });
    p.data = Buffer.from(spr.frames[0]);
    selected.set(def.key, `data:image/png;base64,${PNG.sync.write(p).toString('base64')}`);
  }
}
const server = await createServer({ logLevel: 'error', server: { port: 0 } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: 'new', args: chromeArgs(1600, 800) });
try {
  const game = await browser.newPage();
  await game.setViewport({ width: 1280, height: 720 });
  await game.goto(server.resolvedUrls.local[0] + '?scene=Game', { waitUntil: 'load' });
  await game.waitForFunction(() => window.__dbg?.scene?.bg, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1600));
  await game.evaluate(() => {
    const scene = __dbg.scene;
    scene.god = true;
    scene.player.flame.setVisible(false);
    scene.player.flame.setVisible = () => scene.player.flame;
    for (const o of scene.children.list) if (o.depth >= 10) o.setVisible(false);
  });
  await new Promise(r => setTimeout(r, 80));
  const background = `data:image/png;base64,${Buffer.from(await game.screenshot()).toString('base64')}`;
  await game.close();

  const art = await browser.newPage();
  await art.setContent('<html><body style="margin:0;background:#070b1a"><canvas id="art"></canvas></body></html>');
  await art.evaluate(async ({ sprites, background }) => {
    const images = {};
    await Promise.all(Object.entries({ ...sprites, background }).map(async ([k, url]) => {
      const im = new Image(); im.src = url; await im.decode(); images[k] = im;
    }));
    window.renderAsset = (name, w, h) => {
      const canvas = document.querySelector('canvas'); canvas.width = w; canvas.height = h;
      const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
      c.fillStyle = '#070b1a'; c.fillRect(0, 0, w, h);
      // Game capture remains nearest-neighbour; a crop changes emphasis for each aspect ratio.
      if (name === 'cover') c.drawImage(images.background, 205, 0, 870, 690, 0, 0, w, h);
      if (name === 'banner') {
        c.drawImage(images.background, 0, 0, 1280, 720, 0, 0, 800, 400);
        c.save(); c.translate(1600, 0); c.scale(-1, 1);
        c.drawImage(images.background, 0, 0, 1280, 720, 0, 0, 800, 400); c.restore();
      }
      if (name === 'og') c.drawImage(images.background, 0, 10, 1280, 672, 0, 0, w, h);
      c.fillStyle = name === 'banner' ? 'rgba(7,11,26,.44)' : 'rgba(7,11,26,.30)';
      c.fillRect(0, 0, w, h);
      const spr = (key, cx, cy, scale, alpha = 1) => {
        const im = images[key]; c.globalAlpha = alpha;
        c.drawImage(im, Math.round(cx-im.width*scale/2), Math.round(cy-im.height*scale/2), im.width*scale, im.height*scale);
        c.globalAlpha = 1;
      };
      const glow = (cx, cy, rx, ry, color) => {
        const g = c.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
        g.addColorStop(0,color); g.addColorStop(1,'rgba(7,11,26,0)');
        c.fillStyle=g; c.fillRect(cx-rx,cy-ry,rx*2,ry*2);
      };
      const pattern = (cx, cy, radius, count, scale, start = 0, span = Math.PI*1.45) => {
        for (let i=0;i<count;i++) {
          const a=start+i/(count-1)*span;
          spr(i%4===0?'bullet_ring':'bullet_orb_m',cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,scale,i%4===0?1:.9);
        }
      };
      const shots = (x, y0, y1, scale) => {
        for (let y=y0;y>y1;y-=21*scale) {
          spr('pshot_basic',x-11*scale,y,scale);
          spr('pshot_basic',x+11*scale,y-10*scale,scale);
        }
      };
      // Actual boss and bullet sprite motifs from the game's art atlas.
      if (name === 'cover') {
        glow(315,247,255,220,'rgba(95,35,177,.4)');
        pattern(315,226,170,25,2,Math.PI*.03,Math.PI*.94);
        pattern(315,226,225,23,1,Math.PI*.06,Math.PI*.88);
        spr('boss_warden',315,235,2);
        shots(315,345,270,2);
        glow(315,390,180,130,'rgba(30,204,248,.22)');
        spr('flame_normal',315,449,4);
        spr('ship_normal_big',315,382,3);
        c.fillStyle='rgba(7,11,26,.78)'; c.fillRect(0,0,630,117);
        spr('ui_logo',315,59,2);
        c.fillStyle='#39e7ff'; c.fillRect(54,470,522,2);
      } else if (name === 'banner') {
        glow(800,225,500,220,'rgba(93,31,164,.28)');
        pattern(800,120,375,36,2,Math.PI*.11,Math.PI*.8);
        spr('boss_warden',315,217,2);
        spr('enemy_spread',1265,206,4);
        spr('enemy_basic',1438,287,3);
        shots(800,300,180,2);
        spr('flame_normal',800,370,3);
        spr('ship_normal_big',800,307,2);
        c.fillStyle='rgba(7,11,26,.83)'; c.fillRect(395,0,810,156);
        spr('ui_logo',800,80,3);
        c.fillStyle='#39e7ff'; c.fillRect(395,159,810,3);
      } else {
        glow(600,345,520,300,'rgba(88,28,160,.27)');
        pattern(450,285,270,31,2,Math.PI*.12,Math.PI*.95);
        pattern(450,285,345,26,1,Math.PI*.09,Math.PI*.93);
        spr('boss_warden',394,326,2);
        spr('enemy_spread',916,265,3);
        shots(784,450,346,2);
        spr('flame_normal',784,566,4);
        spr('ship_normal_big',784,476,3);
        c.fillStyle='rgba(7,11,26,.82)'; c.fillRect(0,0,1200,170);
        spr('ui_logo',600,87,3);
        c.fillStyle='#39e7ff'; c.fillRect(160,589,880,3);
      }
      return canvas.toDataURL('image/png');
    };
  }, { sprites: Object.fromEntries(selected), background });
  for (const [name,w,h,file] of [['cover',630,500,'itch-cover.png'],['banner',1600,400,'itch-banner.png'],['og',1200,630,'og-image.png']]) {
    const data = await art.evaluate(([n,w,h]) => window.renderAsset(n,w,h), [name,w,h]);
    const raw = path.join(root,'tmp',`itch-${name}-raw.png`);
    fs.mkdirSync(path.dirname(raw), { recursive: true });
    fs.writeFileSync(raw,Buffer.from(data.split(',')[1],'base64'));
    // RGB PNG compression removes canvas alpha and stays below itch asset limits without palette dithering.
    const result = spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',raw,'-pix_fmt','rgb24','-compression_level','9',path.join(out,file)]);
    if (result.status !== 0) throw new Error(result.stderr.toString());
    console.log(file, w, h);
  }
  // Four real scene captures, taken while each sector title is on screen.
  const sectors = [];
  for (let n=1;n<=4;n++) {
    const page = await browser.newPage();
    await page.setViewport({ width:1280, height:720 });
    await page.goto(server.resolvedUrls.local[0] + '?scene=Game', { waitUntil:'load' });
    await page.waitForFunction(() => window.__dbg?.scene?.run, { timeout:20000 });
    await page.evaluate(n => { __dbg.godMode(true); __dbg.scene.run.toast.show=()=>{}; __dbg.sector(n); }, n);
    await new Promise(r => setTimeout(r,2600));
    sectors.push(`data:image/png;base64,${Buffer.from(await page.screenshot()).toString('base64')}`);
    await page.close();
  }
  const collage = await art.evaluate(async urls => {
    const canvas=document.querySelector('canvas'); canvas.width=1280; canvas.height=720;
    const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;
    for (let i=0;i<4;i++) {
      const im=new Image(); im.src=urls[i]; await im.decode();
      c.drawImage(im,(i%2)*640,Math.floor(i/2)*360,640,360);
    }
    c.fillStyle='#39e7ff'; c.fillRect(638,0,4,720); c.fillRect(0,358,1280,4);
    return canvas.toDataURL('image/png');
  }, sectors);
  const collageRaw=path.join(root,'tmp','itch-sector-collage-raw.png');
  fs.writeFileSync(collageRaw,Buffer.from(collage.split(',')[1],'base64'));
  const collageResult=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',collageRaw,'-pix_fmt','rgb24','-compression_level','9',path.join(out,'sector-collage.png')]);
  if (collageResult.status !== 0) throw new Error(collageResult.stderr.toString());
  console.log('sector-collage.png',1280,720);
  await art.close();
} finally {
  await browser.close();
  await server.close();
}
