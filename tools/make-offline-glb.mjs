/* สร้างไฟล์สำรองสำหรับเปิดเว็บแบบ file:// (ดับเบิลคลิก index.html)
   เบราว์เซอร์ไม่อนุญาตให้ fetch ไฟล์ .glb จาก file:// แต่โหลด <script> ได้ จึงห่อ .glb เป็น base64 ในไฟล์ .js
   เว็บที่เผยแพร่จริง (http/https) ไม่โหลดไฟล์เหล่านี้ — ใช้เฉพาะเมื่อ location.protocol === 'file:'
   ใช้: node tools/make-offline-glb.mjs  (รันอัตโนมัติใน npm run build) */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const FILES = ['assets/model/prang-sam-yot.glb', 'assets/model/lopburi-province.glb'];
mkdirSync('assets/model/offline', { recursive: true });
for (const f of FILES) {
  const b64 = readFileSync(f).toString('base64');
  const name = f.split('/').pop();
  writeFileSync(`assets/model/offline/${name}.js`, `(window.__GLB=window.__GLB||{})[${JSON.stringify(f)}]="${b64}";\n`);
  console.log('offline fallback:', name, (b64.length / 1048576).toFixed(1) + ' MB (base64)');
}
