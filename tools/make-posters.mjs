/* สร้างภาพปก (poster) ของโมเดล 3 มิติทุกจุด ทั้งโหมดกลางวันและกลางคืน -> assets/poster/<id>-day|night.webp
   เว็บแสดงภาพปกก่อน แล้วค่อยโหลด 3 มิติเมื่อผู้ใช้กด (หน้าแรกจึงเบา) รันใหม่ทุกครั้งที่เปลี่ยนโมเดล .glb
   ใช้:  npm run posters            (ต้องมี Chromium: npm i -D playwright && npx playwright install chromium)
         npm run posters -- --software   (ถ้าเครื่องไม่มี GPU/เปิด WebGL ไม่ได้ ใช้ตัวเรนเดอร์ซอฟต์แวร์ ช้าลงเล็กน้อย)
         npm run posters -- sam-yot map  (เฉพาะบางภาพ: hero, map หรือ id ของสถานที่) */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), software = args.includes('--software');
const only = args.filter(a => !a.startsWith('--'));
let chromium;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.error('ยังไม่ได้ติดตั้ง Playwright: รัน  npm i -D playwright && npx playwright install chromium'); process.exit(1); } }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(root, p === '/' ? 'index.html' : p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }).end(await readFile(f));
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const launchArgs = ['--ignore-gpu-blocklist', ...(software ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])];
const browser = await chromium.launch({ args: launchArgs });
await mkdir(join(root, 'assets/poster'), { recursive: true });
const HIDE = `*{background:none!important;box-shadow:none!important;border-color:transparent!important;text-shadow:none!important}
html,body{background:transparent!important} body *:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}`;

let failed = 0;
for (const mode of ['day', 'night']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5, reducedMotion: 'reduce' });
  await ctx.addInitScript((m) => { try { localStorage.setItem('lopburi.theme', m); localStorage.setItem('lopburi.lang', 'th'); } catch {} }, mode);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('  page error:', e.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const ids = await page.evaluate(() => window.ATTRACTIONS.filter(a => a.glb).map(a => a.id));
  // หน้าแรก: ไดโอรามา (hero) และแผนที่จังหวัด ; แต่ละสถานที่: จากหน้า places/<id>.html (ช่อง #placeModel)
  const targets = [{ key: 'hero', url: '', sel: '#heroModel' }, { key: 'map', url: '', sel: '#mapViewer' }, ...ids.map(id => ({ key: id, url: `places/${id}.html`, sel: '#placeModel' }))];
  for (const t of targets) {
    if (only.length && !only.includes(t.key)) continue;
    try {
      if (t.url) { await page.goto(base + t.url, { waitUntil: 'load' }); await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' }); }
      else if (!page.url().replace(base, '').startsWith('index') && page.url() !== base) { await page.goto(base, { waitUntil: 'load' }); await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' }); }
      const host = page.locator(t.sel).first();
      await host.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900); // รอแอนิเมชัน reveal ให้เสร็จก่อนวัดตำแหน่ง
      await page.locator(`${t.sel} .poster, #mvPoster`).first().click({ timeout: 5000 });
      await page.waitForFunction((s) => { const h = document.querySelector(s); return h && !h.querySelector('.poster, #mvPoster') && h.dataset.glb !== 'loading' && (h.id !== 'mapViewer' || h.dataset.ready === '1'); }, t.sel, { timeout: 90000 });
      await page.waitForTimeout(1500);
      const box = await host.boundingBox();
      const style = await page.addStyleTag({ content: HIDE });
      const png = await page.screenshot({ clip: box, omitBackground: true });
      await style.evaluate((n) => n.remove());
      const out = join(root, 'assets/poster', `${t.key}-${mode}.webp`);
      const info = await sharp(png).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(out);
      console.log(`${mode.padEnd(5)} ${t.key.padEnd(16)} ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
    } catch (e) { failed++; console.warn(`${mode} ${t.key}: ล้มเหลว —`, e.message.split('\n')[0]); }
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? `เสร็จ แต่ล้มเหลว ${failed} ภาพ` : 'เสร็จ: assets/poster/*.webp');
process.exit(failed ? 1 : 0);
