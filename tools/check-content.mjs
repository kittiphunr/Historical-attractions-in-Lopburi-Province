// ตรวจเนื้อหาสถานที่: npm run check  (ออกด้วยรหัส 1 ถ้ามีข้อผิดพลาด คำเตือนไม่ทำให้ล้ม)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'content/places');
const ERAS = ['dvaravati', 'khmer', 'ayutthaya', 'faith', 'nature'];
const LANGS = ['en', 'zh', 'ja'];
const hasThai = s => /[฀-๿]/.test(s);
const errs = [], warns = [];
const E = (id, m) => errs.push(`✗ ${id}: ${m}`), W = (id, m) => warns.push(`! ${id}: ${m}`);

const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
const nos = new Map(), ids = new Set();
for (const f of files) {
  let d; const id = f.replace(/\.json$/, '');
  try { d = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch (e) { E(id, 'JSON อ่านไม่ได้: ' + e.message); continue; }
  const p = d.place;
  if (!p) { E(id, 'ไม่มีส่วน "place"'); continue; }
  if (p.id !== id) E(id, `place.id ("${p.id}") ไม่ตรงชื่อไฟล์`);
  ids.add(p.id);
  for (const k of ['no', 'name', 'en', 'era', 'eraLabel', 'tagline', 'summary']) if (!p[k] || typeof p[k] !== 'string') E(id, `ขาดฟิลด์ place.${k}`);
  if (p.era && !ERAS.includes(p.era)) E(id, `era "${p.era}" ไม่อยู่ในรายการ (${ERAS.join(', ')})`);
  if (nos.has(p.no)) E(id, `หมายเลข ${p.no} ซ้ำกับ ${nos.get(p.no)}`); else nos.set(p.no, id);
  for (const k of ['history', 'architecture', 'highlights', 'visit']) if (!Array.isArray(p[k]) || !p[k].length) E(id, `place.${k} ต้องเป็นรายการอย่างน้อย 1 ข้อ`);
  if (!Array.isArray(p.facts) || !p.facts.length || p.facts.some(x => !Array.isArray(x) || x.length !== 2)) E(id, 'place.facts ต้องเป็นคู่ [หัวข้อ, ค่า]');
  if (p.map != null && !(Array.isArray(p.map) && p.map.length === 2 && p.map.every(n => typeof n === 'number' && n >= 0 && n <= 100))) E(id, 'place.map ต้องเป็น null หรือ [x%, y%] ช่วง 0–100');
  if (!p.map) W(id, 'ยังไม่มีหมุดบนแผนที่ 2 มิติ (map = null)');
  if (!p.sources || !p.sources.length) W(id, 'ยังไม่ระบุแหล่งอ้างอิง (sources)');

  // ข้อความไทยที่ต้องมีคำแปล
  const strs = [p.name, p.eraLabel, p.tagline, p.summary, p.archTitle, ...(p.facts || []).flat(), ...(p.history || []), ...(p.architecture || []), ...(p.highlights || []), ...(p.visit || [])]
    .filter(x => typeof x === 'string' && hasThai(x));
  const uniq = [...new Set(strs)];
  const globalDict = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(join(root, 'i18n', l + '.json'), 'utf8'))]));
  for (const l of LANGS) {
    const tr = (d.translations || {})[l] || {};
    const miss = uniq.filter(s => !(s in tr) && !(s in globalDict[l]));
    if (miss.length) W(id, `ขาดคำแปล ${l} ${miss.length} ข้อความ เช่น "${miss[0].slice(0, 40)}${miss[0].length > 40 ? '…' : ''}"`);
    const stale = Object.keys(tr).filter(k => hasThai(k) && !uniq.includes(k) && k !== p.en);
    if (stale.length) W(id, `คำแปล ${l} ${stale.length} รายการไม่ตรงข้อความไทยใน place แล้ว เช่น "${stale[0].slice(0, 40)}…" (แก้ข้อความไทยแล้วลืมแก้คีย์?)`);
    for (const [k, v] of Object.entries(tr)) if (typeof v !== 'string' || !v.trim()) E(id, `คำแปล ${l} ว่างเปล่า: "${k.slice(0, 30)}"`);
  }

  // ไฟล์ที่อ้างถึงต้องมีจริง
  const need = (rel, what) => { if (rel && !/^https?:/.test(rel) && !existsSync(join(root, rel))) E(id, `${what} ไม่พบไฟล์ ${rel}`); };
  if (p.glb) { need(p.glb.url, 'glb.url'); need(p.glb.ar, 'glb.ar'); if (!p.glb.credit) W(id, 'โมเดลไม่ระบุเครดิต (glb.credit)'); }
  else W(id, 'ยังไม่มีโมเดล 3 มิติ (หน้าสถานที่จะแสดงว่ากำลังจัดทำ)');
  if (p.glb) for (const t of ['day', 'night']) need(`assets/poster/${id}-${t}.webp`, `โปสเตอร์ ${t} (npm run posters -- --software ${id})`);
  need(`assets/og/${id}.jpg`, 'ภาพแชร์ลิงก์ (npm run og)');
  for (const g of d.gallery || []) {
    need(/^https?:/.test(g.src || '') ? '' : `assets/places/${id}/${g.src}`, 'รูปในแกลเลอรี');
    if (!g.alt) W(id, `รูป ${g.src} ไม่มีคำอธิบาย alt`);
    if (!g.author || !g.license) E(id, `รูป ${g.src} ต้องระบุผู้ถ่าย (author) และสัญญาอนุญาต (license)`);
  }
}

// แหล่งอ้างอิงที่อ้างถึงต้องมีในรายการ
try {
  const ctx = { window: {} }; new Function('window', readFileSync(join(root, 'assets/js/data.js'), 'utf8'))(ctx.window);
  const known = new Set((ctx.window.SOURCES || []).map(s => s.id));
  for (const f of files) { const d = JSON.parse(readFileSync(join(dir, f), 'utf8')); for (const s of (d.place?.sources || [])) if (!known.has(s)) E(d.place.id, `sources อ้าง "${s}" ที่ไม่มีใน window.SOURCES`); }
} catch (e) { W('data.js', 'ตรวจแหล่งอ้างอิงไม่ได้ (ยังไม่ได้ npm run build:data?): ' + e.message); }

console.log(`ตรวจ ${files.length} สถานที่`);
for (const m of warns) console.log(m);
for (const m of errs) console.log(m);
console.log(`\nข้อผิดพลาด ${errs.length} · คำเตือน ${warns.length}`);
process.exit(errs.length ? 1 : 0);
