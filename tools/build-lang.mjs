/* สร้างไฟล์ภาษาสำหรับเว็บจากพจนานุกรม i18n/<code>.json (คีย์ = ข้อความไทยต้นฉบับ, ค่า = คำแปล)
   -> assets/js/lang/<code>.js (โหลดเฉพาะเมื่อผู้ใช้เลือกภาษานั้น) ใช้: node tools/build-lang.mjs (รันใน npm run build)
   เพิ่มภาษาใหม่: ใส่ i18n/<code>.json แล้วเพิ่มรายการใน LANGS ของ assets/js/i18n.js
   ข้อความที่มีตัวแปรใช้ {0} {1} เช่น "{0} ข้อความจากผู้มาเยือน" */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
mkdirSync('assets/js/lang', { recursive: true });
// คำแปลของหน้านโยบายความเป็นส่วนตัวอยู่ใน content/privacy.json (ทุกค่าที่เป็น { th, en, zh, ja }) รวมเข้าพจนานุกรมตอนสร้างไฟล์
const leaves = [];
(function walk(v) { if (v && typeof v === 'object') { if (typeof v.th === 'string') leaves.push(v); else Object.values(v).forEach(walk); } })(JSON.parse(readFileSync('content/privacy.json', 'utf8')));
for (const f of readdirSync('i18n').filter(n => n.endsWith('.json'))) {
  const code = f.replace('.json', ''), ui = JSON.parse(readFileSync('i18n/' + f, 'utf8'));
  for (const l of leaves) if (typeof l[code] === 'string') ui[l.th] = l[code];
  writeFileSync(`assets/js/lang/${code}.js`, `/* ไฟล์สร้างอัตโนมัติจาก i18n/${f} — อย่าแก้ตรงนี้ */\nI18N.register(${JSON.stringify(code)}, { ui: ${JSON.stringify(ui)} });\n`);
  console.log('lang pack:', code, Object.keys(ui).length, 'entries');
}
