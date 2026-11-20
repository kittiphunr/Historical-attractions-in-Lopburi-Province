/* ลบเศษที่ลอย/ขาดวิ่นออกจากโมเดลสแกนพระปรางค์สามยอด (ไฟล์ต้นฉบับไม่ถูกแก้)
   ใช้: node tools/clean-sam-yot-glb.mjs source-models/prang-sam-yot.original.glb /tmp/clean.glb
   ต้องมี @gltf-transform/core และ @gltf-transform/functions (npm i --no-save ...)
   จากนั้น optimize ตามคำสั่งใน README แล้วคัดลอกไป assets/model/prang-sam-yot.glb
   พิกัดเป็นหน่วยของโมเดลต้นฉบับ (กว้าง x ≈ 1.9, สูง y ≈ 1.06, ด้านหน้าอยู่ฝั่ง z บวก) */
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

const [src, out] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(src);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray();
const nV = pos.length / 3, nT = idx.length / 3;

// 1) ก้อนที่ไม่เชื่อมกับตัวปราสาท (รั้วแผ่นบาง ~2.8k สามเหลี่ยม) — รวมจุดตามพิกัดก่อนหา connected components
const par = new Int32Array(nV).map((_, i) => i);
const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
const seen = new Map(), rep = new Int32Array(nV);
for (let i = 0; i < nV; i++) {
  const k = `${Math.round(pos[3*i]*1e5)},${Math.round(pos[3*i+1]*1e5)},${Math.round(pos[3*i+2]*1e5)}`;
  if (seen.has(k)) rep[i] = seen.get(k); else { seen.set(k, i); rep[i] = i; }
}
for (let t = 0; t < nT; t++) { const a = find(rep[idx[3*t]]), b = find(rep[idx[3*t+1]]), c = find(rep[idx[3*t+2]]); par[b] = a; par[find(c)] = find(a); }
const size = new Map(); for (let t = 0; t < nT; t++) { const r = find(rep[idx[3*t]]); size.set(r, (size.get(r) || 0) + 1); }
const main = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0];

let ymin = Infinity; for (let i = 1; i < pos.length; i += 3) ymin = Math.min(ymin, pos[i]);
const keep = []; const dropped = { island: 0, speck: 0, sliver: 0 };
for (let t = 0; t < nT; t++) {
  let cx = 0, cy = 0, cz = 0;
  for (let k = 0; k < 3; k++) { const v = idx[3*t+k]; cx += pos[3*v]/3; cy += pos[3*v+1]/3; cz += pos[3*v+2]/3; }
  if (find(rep[idx[3*t]]) !== main) { dropped.island++; continue; }
  // 2) จุดเล็กจิ๋วด้านขวาหน้า
  if (cx > 0.45 && cx < 0.60 && cy > -0.55 && cy < -0.48 && cz > 0.15 && cz < 0.26) { dropped.speck++; continue; }
  // 3) แถบพื้นขาดวิ่นยื่นไปด้านหน้า (เลยแนวบันไดของตัวปราสาท z ≈ 0.3)
  if (cz > 0.33 && cy < ymin + 0.12) { dropped.sliver++; continue; }
  keep.push(idx[3*t], idx[3*t+1], idx[3*t+2]);
}
console.log('dropped triangles:', dropped, '| kept:', keep.length / 3);
prim.getIndices().setArray(new Uint32Array(keep));
await doc.transform(prune());
await io.write(out, doc);
