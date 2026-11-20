/* สร้างไฟล์สำรองสำหรับเปิดเว็บแบบ file:// (ดับเบิลคลิก index.html)
   เบราว์เซอร์ไม่อนุญาตให้ fetch ไฟล์ .glb จาก file:// แต่โหลด <script> ได้ จึงห่อ .glb เป็น base64 ในไฟล์ .js
   เว็บที่เผยแพร่จริง (http/https) ไม่โหลดไฟล์เหล่านี้ — ใช้เฉพาะเมื่อ location.protocol === 'file:'
   ใช้: node tools/make-offline-glb.mjs  (รันอัตโนมัติใน npm run build) */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

// ทุกไฟล์โมเดลสำหรับเว็บ (ไม่รวม .ar.glb ที่ใช้เฉพาะตอนเปิด AR)
const FILES = readdirSync('assets/model').filter(f => f.endsWith('.glb') && !f.endsWith('.ar.glb')).sort().map(f => 'assets/model/' + f);
mkdirSync('assets/model/offline', { recursive: true });
for (const f of FILES) {
  const b64 = readFileSync(f).toString('base64');
  const name = f.split('/').pop();
  writeFileSync(`assets/model/offline/${name}.js`, `(window.__GLB=window.__GLB||{})[${JSON.stringify(f)}]="${b64}";\n`);
  console.log('offline fallback:', name, (b64.length / 1048576).toFixed(1) + ' MB (base64)');
}
