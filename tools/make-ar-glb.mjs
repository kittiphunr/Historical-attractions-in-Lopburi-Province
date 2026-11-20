/* ปรับ .glb ให้พร้อมใช้ใน AR: จัดกึ่งกลาง x,z วางก้นโมเดลบนพื้น y=0 และย่อ/ขยายให้กว้างตามที่กำหนด (หน่วยเมตร)
   ใช้: node tools/make-ar-glb.mjs in.glb out.glb 0.4
   ต้องมี @gltf-transform/core และ @gltf-transform/functions (npm i --no-save ...)
   ทำหลัง optimize แบบไม่บีบอัด (Scene Viewer/Quick Look ไม่รองรับ meshopt/WebP):
   npx @gltf-transform/cli optimize in.glb tmp.glb --compress false --simplify true --simplify-ratio 0.03 \
     --simplify-error 0.002 --texture-compress false --no-instance --no-palette
   แล้วย่อ texture: npx @gltf-transform/cli resize tmp.glb tmp2.glb --width 1024 --height 1024 */
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const [src, out, meters = '0.4'] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(src);
const scene = doc.getRoot().listScenes()[0];
const b = getBounds(scene), w = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
const k = parseFloat(meters) / w;
const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
const root = doc.createNode('ar-root').setScale([k, k, k]).setTranslation([-cx * k, -b.min[1] * k, -cz * k]);
for (const child of scene.listChildren()) { scene.removeChild(child); root.addChild(child); }
scene.addChild(root);
await io.write(out, doc);
const nb = getBounds(scene);
console.log('size (m):', nb.max.map((v, i) => (v - nb.min[i]).toFixed(3)).join(' x '), '| min y:', nb.min[1].toFixed(4));
