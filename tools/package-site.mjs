/* สร้างชุดไฟล์พร้อมติดตั้งลงโฮสต์จริง: dist/site (เนื้อหาเว็บ) + .htaccess + nginx.conf.example + INSTALL.th.md และไฟล์ zip
   ใช้:  npm run build && node tools/package-site.mjs --site https://ชื่อโดเมน/ [--out dist] [--guestbook-api https://…/api/guestbook]
   - ใส่ที่อยู่จริงแทน GitHub Pages ทุกที่ (canonical, hreflang, og:url/og:image, JSON-LD, sitemap, robots) รองรับโฟลเดอร์ย่อย เช่น https://example.com/lopburi/
   - ตัดไฟล์สำรองสำหรับเปิดแบบ file:// (assets/model/offline ~44 MB) ออก เพราะใช้เฉพาะตอนดับเบิลคลิกเปิดบนเครื่อง
   - ปรับข้อความในนโยบายความเป็นส่วนตัวที่ระบุ "GitHub Pages" เป็นผู้ให้บริการโฮสติ้งทั่วไป (4 ภาษา)
   - หน้า 404 กำหนด <base> ตามที่อยู่เว็บ */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
let site = flag('site');
if (!site) { console.error('ต้องระบุที่อยู่เว็บ เช่น  node tools/package-site.mjs --site https://www.example.com/'); process.exit(1); }
if (!/^https?:\/\//.test(site)) site = 'https://' + site;
if (!site.endsWith('/')) site += '/';
const url = new URL(site), HOST = url.host, PATH = url.pathname, ORIGIN = url.origin;
const OLD = 'https://kittiphunr.github.io/Historical-attractions-in-Lopburi-Province/';
const out = resolve(root, flag('out', 'dist')), dir = join(out, 'site');
const slug = HOST.replace(/[^a-z0-9.-]/gi, '-');

for (const f of ['index.html', 'en/index.html', 'places/sam-yot.html', 'sitemap.xml']) if (!existsSync(join(root, f))) { console.error(`ยังไม่ได้ build (ไม่พบ ${f}) — รัน npm run build ก่อน`); process.exit(1); }

rmSync(out, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
for (const f of ['index.html', 'privacy.html', '404.html', 'sitemap.xml', 'robots.txt']) cpSync(join(root, f), join(dir, f));
for (const d of ['places', 'en', 'zh', 'ja']) cpSync(join(root, d), join(dir, d), { recursive: true });
cpSync(join(root, 'assets'), join(dir, 'assets'), { recursive: true, filter: (src) => !/[\\/]assets[\\/]model[\\/]offline$/.test(src) && !src.endsWith('.gitkeep') });

const walk = (d) => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dir);
const textFiles = files.filter(f => ['.html', '.xml', '.txt'].includes(extname(f)));

/* ผู้ให้บริการโฮสติ้ง: ข้อความเดิมระบุ GitHub Pages ตัวอย่างในนโยบายความเป็นส่วนตัว ให้เปลี่ยนเป็นข้อความทั่วไป */
const privacy = JSON.parse(readFileSync(join(root, 'content/privacy.json'), 'utf8'));
const ghLeaf = privacy.sections.flatMap(s => s.ul || []).find(l => l.th.startsWith('GitHub Pages'));
const generic = {
  th: 'ผู้ให้บริการโฮสติ้งของเว็บไซต์นี้ — จัดเก็บและส่งไฟล์เว็บ และอาจบันทึกข้อมูลการเข้าถึงเซิร์ฟเวอร์ (เช่น ที่อยู่ IP) ตามนโยบายของผู้ให้บริการ',
  en: "This website's hosting provider — stores and serves the site files and may keep server access logs (such as IP addresses) under its own policy",
  zh: '本网站的托管服务商——存储并提供网站文件，并可能按其自身政策记录服务器访问日志（如 IP 地址）',
  ja: 'このサイトのホスティング事業者 — サイトのファイルを保管・配信し、各社の方針に従ってサーバーのアクセスログ（IPアドレスなど）を保持する場合があります'
};
let hostingReplaced = 0;

for (const f of textFiles) {
  let t = readFileSync(f, 'utf8'), o = t;
  t = t.split(OLD).join(site);
  if (ghLeaf) for (const c of ['th', 'en', 'zh', 'ja']) if (ghLeaf[c] && t.includes(ghLeaf[c])) { t = t.split(ghLeaf[c]).join(generic[c]); hostingReplaced++; }
  if (f.endsWith('404.html')) t = t.replace(/\(function \(\) \{ var p = location\.pathname[\s\S]*?document\.write\('<base href="' \+ base \+ '">'\); \}\)\(\);/, `document.write('<base href="${PATH}">');`);
  if (t !== o) writeFileSync(f, t);
}

const guestbook = flag('guestbook-api');
if (guestbook) {
  const cfg = join(dir, 'assets/js/config.js');
  writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/guestbookApi:\s*'[^']*'/, `guestbookApi: '${guestbook}'`));
}

/* ไฟล์ตั้งค่าเซิร์ฟเวอร์และคู่มือ */
const mb = files.reduce((s, f) => s + statSync(f).size, 0) / 1048576;
const fill = (s) => s.replaceAll('{{SITE_ORIGIN}}', ORIGIN).replaceAll('{{SITE}}', site).replaceAll('{{HOST}}', HOST).replaceAll('{{PATH}}', PATH).replaceAll('{{SIZE}}', `${Math.round(mb)} MB`);
writeFileSync(join(dir, '.htaccess'), fill(readFileSync(join(root, 'deploy/htaccess.template'), 'utf8')));
writeFileSync(join(out, 'nginx.conf.example'), fill(readFileSync(join(root, 'deploy/nginx.conf.template'), 'utf8')));
writeFileSync(join(out, 'INSTALL.th.md'), fill(readFileSync(join(root, 'deploy/INSTALL.th.template.md'), 'utf8')));

/* ตรวจความสมบูรณ์ */
const left = textFiles.filter(f => readFileSync(f, 'utf8').includes('kittiphunr.github.io'));
const gh = textFiles.filter(f => /github\.com|GitHub Pages/i.test(readFileSync(f, 'utf8')));
console.log(`ที่อยู่เว็บ: ${site}  (host ${HOST}, path ${PATH})`);
console.log(`ไฟล์ในเว็บ: ${files.length + 1} ไฟล์ ${mb.toFixed(1)} MB ; แก้ที่อยู่ในไฟล์ข้อความ ${textFiles.length} ไฟล์ ; ข้อความผู้ให้บริการโฮสติ้งที่ปรับ ${hostingReplaced} จุด`);
if (left.length) console.warn('⚠ ยังเหลือที่อยู่ GitHub Pages ใน:', left.map(f => f.replace(dir, '')).slice(0, 5));
console.log(`ลิงก์ GitHub (Issues ในนโยบายความเป็นส่วนตัว) ใน ${gh.length} ไฟล์ — ตรวจแล้วควรเป็นช่องทางติดต่อเท่านั้น`);

/* zip */
const zipName = `${slug}-site.zip`, zipPath = join(out, zipName);
const z = spawnSync('zip', ['-r', '-q', '-X', zipName, 'site', 'nginx.conf.example', 'INSTALL.th.md'], { cwd: out });
if (z.status === 0) console.log(`สร้างแล้ว: ${zipPath}  (${(statSync(zipPath).size / 1048576).toFixed(1)} MB)`);
else console.warn('สร้าง zip อัตโนมัติไม่ได้ (ไม่พบคำสั่ง zip) — บีบอัดโฟลเดอร์ site + ไฟล์ทั้งสองในโฟลเดอร์', out, 'เอง');
