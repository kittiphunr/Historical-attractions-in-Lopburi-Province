/* สร้างภาพตัวอย่างตอนแชร์ลิงก์ (Open Graph 1200x630) ของแต่ละสถานที่ -> assets/og/<id>.jpg
   แต่ละภาพมี: ชื่อสถานที่ ชื่ออังกฤษ ยุค คำโปรย และภาพปกโมเดล 3 มิติ (assets/poster/<id>-day.webp) บนพื้นสีครีม พร้อมตราจังหวัด
   หน้าสถานที่ (places/<id>.html) จะใช้ภาพนี้เป็น og:image อัตโนมัติเมื่อมีไฟล์ (รัน npm run build:places อีกครั้ง)
   ใช้:  npm run og            (ต้องมี Playwright + Chromium และต่ออินเทอร์เน็ตเพื่อโหลดฟอนต์ Prompt จาก Google Fonts)
         npm run og -- sam-yot wat-lai   (เฉพาะบางสถานที่)
   รันใหม่ทุกครั้งที่เปลี่ยนข้อความชื่อ/คำโปรย หรือสร้างภาพปก (npm run posters) ใหม่ */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
let chromium;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.error('ยังไม่ได้ติดตั้ง Playwright: รัน  npm i -D playwright && npx playwright install chromium'); process.exit(1); } }

const ctx = { window: {} };
runInNewContext(readFileSync(join(root, 'assets/js/data.js'), 'utf8'), ctx);
const A = ctx.window.ATTRACTIONS;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataUri = (f, type) => `data:${type};base64,${readFileSync(join(root, f)).toString('base64')}`;
const seal = dataUri('assets/img/seal-192.png', 'image/png');
const ERA = { dvaravati: ['#dff0f7', '#1e6f93'], khmer: ['#f6dfd5', '#a8431f'], ayutthaya: ['#f9e8c8', '#97611b'], faith: ['#d9efe3', '#1f7a52'], nature: ['#d6edef', '#1b6f7a'] };

const html = (a) => {
  const [chipBg, chipFg] = ERA[a.era] || ERA.khmer;
  const pf = `assets/poster/${a.id}-day.webp`;
  const poster = existsSync(join(root, pf)) ? `<img class="poster" src="${dataUri(pf, 'image/webp')}">` : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden;font-family:'Prompt',sans-serif;color:#2b2623;background:linear-gradient(135deg,#f8f1e8,#ecdcc8)}
body{position:relative}
.glow{position:absolute;right:-120px;top:-160px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(255,255,255,0) 62%)}
.stage{position:absolute;right:56px;top:56px;width:516px;height:518px;border-radius:44px;background:radial-gradient(ellipse at 50% 30%,#fffaf2,transparent 62%),linear-gradient(180deg,#f7ecde,#ead6bd);box-shadow:0 30px 60px -20px rgba(120,70,30,.35),inset 0 0 0 1px rgba(255,255,255,.7);overflow:hidden}
.stage .poster{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain}
.num{position:absolute;left:22px;top:6px;font-size:96px;font-weight:600;color:rgba(196,85,47,.18);line-height:1.2}
.left{position:absolute;left:64px;top:56px;width:520px;height:518px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-size:24px;font-weight:500;color:#5a4a40}
.brand img{height:54px;width:auto}
.left>*{flex-shrink:0}
.chip{align-self:flex-start;margin-top:36px;padding:7px 20px;border-radius:999px;font-size:22px;font-weight:500;background:${chipBg};color:${chipFg}}
h1{margin-top:18px;font-weight:600;line-height:1.16;letter-spacing:-.01em;font-size:80px;color:#201c19;text-wrap:balance}
.en{margin-top:8px;font-size:24px;letter-spacing:.14em;color:#c4552f;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tag{margin-top:18px;font-size:25px;line-height:1.5;color:#6d5d52;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.url{margin-top:auto;font-size:16px;color:#9a8878;white-space:nowrap}
</style></head><body>
<div class="glow"></div>
<div class="stage"><span class="num">${esc(a.no)}</span>${poster}</div>
<div class="left">
  <div class="brand"><img src="${seal}" alt="">ลพบุรี · เมืองสามยุค</div>
  <div class="chip">${esc(a.eraLabel)}</div>
  <h1 id="name">${esc(a.name)}</h1>
  <div class="en">${esc(a.en)}</div>
  <p class="tag">${esc(a.tagline)}</p>
  <div class="url">kittiphunr.github.io/Historical-attractions-in-Lopburi-Province</div>
</div>
<script>
  // ลดขนาดชื่อให้อยู่ใน 2 บรรทัด
  const h = document.getElementById('name'); let s = 80;
  const lines = () => Math.round(h.getBoundingClientRect().height / (s * 1.16));
  while ((lines() > 2 || h.scrollWidth > h.clientWidth + 1) && s > 44) { s -= 2; h.style.fontSize = s + 'px'; }
</script></body></html>`;
};

mkdirSync(join(root, 'assets/og'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
let n = 0;
for (const a of A) {
  if (only.length && !only.includes(a.id)) continue;
  await page.setContent(html(a), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  const out = join(root, 'assets/og', a.id + '.jpg');
  const info = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
  console.log(`${a.id.padEnd(16)} ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
  n++;
}
await browser.close();
console.log(`เสร็จ ${n} ภาพ -> assets/og/*.jpg  (แล้วรัน npm run build:places เพื่อให้หน้าสถานที่ใช้ภาพเหล่านี้)`);
