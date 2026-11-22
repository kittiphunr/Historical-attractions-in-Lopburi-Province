// สร้างไฟล์สถานที่ใหม่จากแม่แบบ: npm run new-place -- <id> --name "ชื่อไทย" --en "English name" [--era khmer] [--no 14]
// จากนั้นเปิด content/places/<id>.json กรอกเนื้อหา แล้วรัน npm run check และ npm run build
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const id = argv[0] && !argv[0].startsWith('--') ? argv[0] : '';
const opt = (k, d = '') => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ERAS = { dvaravati: 'ทวารวดี', khmer: 'ขอม', ayutthaya: 'อยุธยา', faith: 'ศรัทธา', nature: 'ธรรมชาติ' };

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('ใช้: npm run new-place -- <id> --name "ชื่อไทย" --en "English name" [--era dvaravati|khmer|ayutthaya|faith|nature] [--no 14]\n<id> ใช้ a-z 0-9 และ - เท่านั้น เช่น wat-example');
  process.exit(1);
}
const dir = join(root, 'content/places');
const file = join(dir, id + '.json');
if (existsSync(file)) { console.error(`มีไฟล์ ${id}.json อยู่แล้ว`); process.exit(1); }
const era = opt('era', 'ayutthaya');
if (!ERAS[era]) { console.error('--era ต้องเป็น ' + Object.keys(ERAS).join(' | ')); process.exit(1); }

const used = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')).place.no);
const next = String(Math.max(0, ...used.map(Number)) + 1).padStart(2, '0');
const no = opt('no', next);
if (used.includes(no)) { console.error(`หมายเลข ${no} ถูกใช้แล้ว`); process.exit(1); }
const name = opt('name', 'ชื่อสถานที่ (ไทย)');

const doc = {
  _help: 'ข้อมูลทั้งหมดของสถานที่นี้อยู่ในไฟล์เดียว: place = เนื้อหาไทย (ต้นฉบับ), translations = คำแปล en/zh/ja ของข้อความไทยแต่ละข้อความใน place (คีย์ = ข้อความไทยตรงตัว), gallery/sections/facts = รูปและหัวข้อเพิ่มเติม ดู content/places/README.md · ตรวจความครบถ้วนด้วย npm run check',
  place: {
    id, no, name, en: opt('en', 'English name'), era, eraLabel: ERAS[era], model: 'ruins', map: null,
    tagline: 'ประโยคสั้นหนึ่งบรรทัดแนะนำสถานที่',
    summary: 'สรุปสถานที่ 2–3 ประโยค',
    facts: [['ที่ตั้ง', 'ตำบล อำเภอ จังหวัด']],
    history: ['ย่อหน้าประวัติ (ระบุแหล่งอ้างอิงใน sources)'],
    architecture: ['ย่อหน้าสถาปัตยกรรม'],
    highlights: ['จุดเด่นที่ควรดู'],
    visit: ['คำแนะนำเตรียมตัวไป'],
    video: { query: name + ' ลพบุรี' },
    sources: [],
    photo: ''
  },
  translations: { en: {}, zh: {}, ja: {} },
  gallery: [], sections: [], facts: []
};
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log(`สร้าง content/places/${id}.json (หมายเลข ${no}) แล้ว
ขั้นต่อไป: 1) กรอก place และ translations 2) npm run check 3) npm run build
เพิ่มโมเดล: npm run shrink -- source-models/<ไฟล์>.glb --out assets/model/${id}.glb --ar 0.4 แล้วใส่ glb ใน place (ดู README)
หมายเหตุ: ค่าตั้งต้น map = null (ไม่มีหมุด) — ตั้งพิกัดหมุดและเลขในแผนที่ภายหลังเมื่อวางตำแหน่งแล้ว`);
