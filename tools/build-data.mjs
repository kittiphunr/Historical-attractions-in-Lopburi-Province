// สร้าง assets/js/data.js จาก content/data.template.js + content/places/*.json
// - content/places/<id>.json = ข้อมูลทั้งหมดของสถานที่เดียว (ดู content/places/README.md)
// place        เนื้อหาไทยที่เว็บใช้ (ชื่อ ยุค ประวัติ สถาปัตยกรรม ไฮไลต์ เตรียมตัวไป แหล่งอ้างอิง โมเดล หมุดแผนที่ ฯลฯ)
// translations คำแปล en/zh/ja ของข้อความไทยใน place (คีย์ = ข้อความไทยตรงตัว) — build-lang/build-places รวมเข้าพจนานุกรมให้เอง
// sourceDefs   (ไม่บังคับ) แหล่งอ้างอิงที่ใช้เฉพาะสถานที่นี้ { id, name, url } — ต่อท้าย window.SOURCES
// - content/data.template.js = ส่วนที่ไม่ใช่สถานที่ (SOURCES กลาง TIMELINE ROUTE PROVINCE_MODEL) มีเครื่องหมาย /*@ATTRACTIONS@*/ ตรงที่จะใส่รายการสถานที่
// ใช้:  node tools/build-data.mjs   (npm run build / build:places เรียกให้อัตโนมัติ)  แก้สถานที่ที่ไฟล์ place แล้วรันใหม่ อย่าแก้ assets/js/data.js ตรง ๆ
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(join(root, 'content/places')).filter(f => f.endsWith('.json')).sort();
const docs = files.map(f => {
  try { return { f, d: JSON.parse(readFileSync(join(root, 'content/places', f), 'utf8')) }; }
  catch (e) { throw new Error(`content/places/${f} อ่านไม่ได้: ${e.message}`); }
});
for (const { f, d } of docs) {
  if (!d.place || !d.place.id) throw new Error(`content/places/${f}: ไม่มี place.id (ไฟล์ต้องมีส่วน "place")`);
  if (f !== d.place.id + '.json') throw new Error(`content/places/${f}: ชื่อไฟล์ต้องตรงกับ place.id ("${d.place.id}.json")`);
}
docs.sort((a, b) => String(a.d.place.no).localeCompare(String(b.d.place.no), 'en', { numeric: true }));
const nos = docs.map(x => String(x.d.place.no));
if (new Set(nos).size !== nos.length) throw new Error('หมายเลข (no) ของสถานที่ซ้ำกัน: ' + nos.join(', '));

const YT = '__YT__:';
const places = docs.map(({ d }) => {
  const p = JSON.parse(JSON.stringify(d.place));
  if (p.video && Object.keys(p.video).length === 1 && typeof p.video.query === 'string') p.video = YT + p.video.query;
  return p;
});
const lit = JSON.stringify(places, null, 2).replace(/"__YT__:((?:[^"\\]|\\.)*)"/g, (m, q) => `yt("${q}")`);
const defs = docs.flatMap(({ d }) => d.sourceDefs || []);
const defsCode = defs.length ? `\nwindow.SOURCES.push(\n${defs.map(s => '  ' + JSON.stringify(s)).join(',\n')}\n);\n` : '';

const tpl = readFileSync(join(root, 'content/data.template.js'), 'utf8');
if (!tpl.includes('/*@ATTRACTIONS@*/')) throw new Error('content/data.template.js ไม่มีเครื่องหมาย /*@ATTRACTIONS@*/');
const body = tpl.replace('/*@ATTRACTIONS@*/', `window.ATTRACTIONS = ${lit};\n${defsCode}`);
writeFileSync(join(root, 'assets/js/data.js'),
  '/* ไฟล์สร้างอัตโนมัติจาก content/data.template.js + content/places/*.json ด้วย npm run build:data — อย่าแก้ตรงนี้ ให้แก้ที่ไฟล์ต้นทางแล้วรันใหม่ */\n' + body);
console.log(`data.js: ${places.length} สถานที่ (${nos.join(' ')}) + แหล่งอ้างอิงเฉพาะสถานที่ ${defs.length} รายการ`);
