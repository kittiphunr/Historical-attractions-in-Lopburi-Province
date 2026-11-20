/* ย่อไฟล์โมเดล .glb ขนาดใหญ่ให้เหมาะกับเว็บ (ทำบนเครื่องก่อนนำขึ้น git)
   ใช้:
     npm run shrink -- ต้นฉบับ.glb                      -> ต้นฉบับ.web.glb (ไฟล์สำหรับเว็บ)
     npm run shrink -- ต้นฉบับ.glb --out assets/model/prang-sam-yot.glb
     npm run shrink -- ต้นฉบับ.glb --ar 0.4             -> เพิ่ม .ar.glb สำหรับ AR (กว้าง 0.4 ม.)
   ตัวเลือก: --ar-png (texture AR เป็น PNG แทน JPEG เมื่อมีความโปร่งใส)  --ratio 0.1 (สัดส่วนจุดยอดที่เก็บ 0–1)  --texture 2048 (ขนาด texture สูงสุด px)  --error 0.001  --target 8 (MB เป้าหมาย)
   ถ้าไฟล์ผลลัพธ์ยังใหญ่กว่า --target สคริปต์จะลดค่า ratio/texture ลงเองทีละขั้น (สูงสุด 4 รอบ) และแจ้งผล */
import { spawnSync } from 'node:child_process';
import { statSync, existsSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(root, 'node_modules/.bin/gltf-transform');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const src = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const MB = (f) => (statSync(f).size / 1048576).toFixed(1) + ' MB';

if (!src || !existsSync(src)) { console.error('ใช้: npm run shrink -- ไฟล์.glb [--out path] [--ar 0.4] [--ratio 0.1] [--texture 2048] [--target 8]'); process.exit(1); }
if (!existsSync(CLI)) { console.error('ยังไม่ได้ติดตั้งเครื่องมือ: รัน npm install ก่อน'); process.exit(1); }

const base = join(dirname(src), basename(src, extname(src)).replace(/\.original$/, ''));
const out = flag('out', base + '.web.glb');
let ratio = parseFloat(flag('ratio', '0.1')), tex = parseInt(flag('texture', '2048'), 10);
const error = flag('error', '0.001'), target = parseFloat(flag('target', '8')), arWidth = flag('ar', null);
mkdirSync(dirname(resolve(out)), { recursive: true });

const run = (list) => { const r = spawnSync(CLI, list, { stdio: ['ignore', 'ignore', 'inherit'] }); if (r.status) { console.error('คำสั่งล้มเหลว:', list.slice(0, 3).join(' ')); process.exit(r.status); } };
console.log(`ต้นฉบับ: ${src} (${MB(src)})`);

// 1) ไฟล์สำหรับเว็บ: meshopt + WebP, ลองลดคุณภาพทีละขั้นถ้ายังใหญ่เกินเป้า
for (let i = 0; i < 4; i++) {
  run(['optimize', src, out, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(tex),
    '--simplify', 'true', '--simplify-ratio', String(ratio), '--simplify-error', error, '--no-instance', '--no-palette']);
  const mb = statSync(out).size / 1048576;
  console.log(`  รอบ ${i + 1}: ratio ${ratio}, texture ${tex}px -> ${MB(out)}`);
  if (mb <= target) break;
  ratio = Math.max(0.02, +(ratio / 2).toFixed(3)); tex = Math.max(512, tex / 2);
}
const webMB = statSync(out).size / 1048576;
console.log(`เว็บ: ${out} (${MB(out)})` + (webMB > target ? `  ⚠ ยังเกิน ${target} MB — ลอง --ratio ที่ต่ำลงหรือ --texture 1024` : ''));
if (webMB > 95) console.log('⚠ ใหญ่เกิน 95 MB: GitHub ไม่รับไฟล์เกิน 100 MB');

// 2) ไฟล์ AR (ไม่บีบอัด เพราะ Scene Viewer/Quick Look ไม่รองรับ meshopt/WebP) + จัดกึ่งกลาง วางบนพื้น ปรับขนาดจริง
if (arWidth) {
  const tmp = mkdtempSync(join(tmpdir(), 'shrink-')), a = join(tmp, 'a.glb'), b = join(tmp, 'b.glb');
  const arOut = out.replace(/(\.web)?\.glb$/, '') + '.ar.glb';
  run(['optimize', src, a, '--compress', 'false', '--texture-compress', 'false', '--simplify', 'true',
    '--simplify-ratio', String(Math.min(ratio, 0.05)), '--simplify-error', '0.002', '--no-instance', '--no-palette']);
  // texture ต้นฉบับอาจเป็น WebP (AR ไม่รองรับ) จึงแปลงเป็น JPEG คุณภาพ 85 ก่อน (ไฟล์เล็ก; ถ้าโมเดลมี texture โปร่งใส ให้ใช้ --ar-png) แล้วค่อยย่อให้ไม่เกิน 1024 px
  const c = join(tmp, 'c.glb');
  run(args.includes('--ar-png') ? ['png', a, c, '--formats', 'webp'] : ['jpeg', a, c, '--formats', 'webp', '--quality', '85']);
  run(['resize', c, b, '--width', '1024', '--height', '1024']);
  const r = spawnSync(process.execPath, [join(root, 'tools/make-ar-glb.mjs'), b, arOut, arWidth], { stdio: 'inherit', cwd: root });
  rmSync(tmp, { recursive: true, force: true }); if (r.status) process.exit(r.status);
  console.log(`AR: ${arOut} (${MB(arOut)}, กว้าง ${arWidth} ม.)`);
}
