# ลพบุรี · เมืองสามยุค

Landing page แนะนำ 10 แหล่งท่องเที่ยวประวัติศาสตร์จังหวัดลพบุรี สร้างด้วย **Tailwind CSS** เป็นแกนหลัก
UI แบบ bento โทนครีม–ส้มดินเผา (การ์ดตั๋ว, วิดเจ็ตสภาพอากาศสด, แผนที่แตะได้, เมนูซ้าย/ล่าง) พร้อมไดโอรามาและโมเดลอาคาร 3 มิติด้วย **Three.js** (ลากหมุนได้, มีแสงเงา) และตัวสำรอง CSS 3D เมื่อไม่มี WebGL, เส้นทางเดินเมืองเก่า, ลิงก์วิดีโอ YouTube, แหล่งอ้างอิง และสมุดเยี่ยม

## รันบนเครื่อง

```bash
npm install
npm run build      # Tailwind -> assets/tailwind.css และ bundle Three.js (src/three-scenes.js) -> assets/js/three-scenes.js
                   # ไฟล์ที่ build แล้วถูก commit ไว้ เปิดผ่าน server ได้เลย
npm start          # เสิร์ฟหน้าเว็บ + API สมุดเยี่ยม ที่ http://localhost:3000
```

## แผนที่ 3 มิติทั้งจังหวัด

ส่วน "แผนที่ 3 มิติทั้งจังหวัด" (`#map3d`) ใช้โมเดลที่เจ้าของโปรเจกต์ปั้น: ลากเพื่อหมุน/เอียง, Ctrl + ล้อเมาส์ หรือหนีบสองนิ้วเพื่อซูม, ปุ่ม +/−/รีเซ็ต, ปุ่มลูกศรบนคีย์บอร์ด (+/− ซูม, Esc รีเซ็ต) แตะหมุด แตะที่ตัวแผนที่ใกล้สถานที่ หรือเลือกจากแถบรายชื่อ กล้องจะบินเข้าไปและขึ้นการ์ดข้อมูลพร้อมลิงก์ไปอ่านรายละเอียดและดูโมเดลอาคารแบบ AR มีปุ่ม AR ของแผนที่ทั้งแผ่น (กว้าง ~50 ซม.)

- ไฟล์: `assets/model/lopburi-province.glb` (2.5 MB สำหรับเว็บ: ลดจาก 1.29M เหลือ ~155k สามเหลี่ยม + meshopt + WebP) และ `lopburi-province.ar.glb` (6.2 MB สำหรับ AR ไม่บีบอัด) ต้นฉบับ 48 MB อยู่ที่ `source-models/lopburi-province.original.glb`
  ```bash
  npx @gltf-transform/cli optimize source-models/lopburi-province.original.glb assets/model/lopburi-province.glb \
    --compress meshopt --simplify true --simplify-ratio 0.12 --simplify-error 0.0008 --texture-compress webp --texture-size 2048 --no-instance --no-palette
  # ไฟล์ AR: optimize แบบ --compress false --texture-compress false, resize 1024, แล้ว node tools/make-ar-glb.mjs in.glb out.glb 0.5
  ```
- ตำแหน่งหมุดเก็บที่ `PROVINCE_MODEL.hotspots` ใน `assets/js/data.js` (พิกัด x,z ในหน่วยของไฟล์ต้นฉบับ เหนืออยู่บนเมื่อมองจากด้านบน) ความสูงคำนวณจากผิวโมเดลเอง ถ้าเปลี่ยนโมเดลต้องวัดพิกัดใหม่ ปัจจุบันโมเดลมี 7 สถานที่ (ไม่มีปรางค์แขก วัดเสาธงทอง วัดนครโกษา)
- ตัวดู: `createMapViewer` ใน `src/three-scenes.js` ใช้ renderer ของตัวเอง โหลดโมเดลเมื่อเลื่อนใกล้ถึง ถ้าไม่มี WebGL จะแจ้งและให้ใช้แผนที่ภาพแทน

## AR (ดูโมเดลบนโต๊ะจริง)

ทุกการแสดงผล 3 มิติมีปุ่ม **ดูแบบ AR** (ไดโอรามาหน้าแรก + 10 สถานที่) เปิดหน้าต่างดู 3 มิติเต็มจอด้วย [`<model-viewer>`](https://modelviewer.dev/) ของ Google ถ้าอุปกรณ์รองรับจะมีปุ่ม "ดูใน AR" (WebXR บน Android Chrome, Scene Viewer บน Android, Quick Look บน iPhone/iPad)

- `src/ar.js` → `assets/js/ar.js` (~1 MB) โหลดเฉพาะตอนกดปุ่ม ใช้ three 0.183 (`three-mv`) แยกจากตัวเรนเดอร์หลัก (three 0.187) เพราะ model-viewer 4.4 ผูกกับ 0.183 (alias ตอน build)
- โมเดลที่สร้างด้วยโค้ด: `LopburiGL.exportGLB(type)` ส่งออก .glb ตอนกด (กว้างราว 40 ซม. พร้อมฐานดินเผา ก้นแตะพื้น) ไม่ต้องมีไฟล์สำรอง ผ่านตัวตรวจ Khronos glTF Validator ครบ 10 แบบ
- โมเดลที่ปั้นเอง: ใช้ไฟล์ AR แยก `assets/model/prang-sam-yot.ar.glb` (2.5 MB, ไม่บีบอัดแบบ meshopt/WebP เพราะ Scene Viewer/Quick Look ไม่รองรับ) สร้างด้วย `tools/make-ar-glb.mjs` (ขั้นตอนอยู่ในคอมเมนต์ต้นไฟล์) กำหนดที่ฟิลด์ `glb.ar` ใน `assets/js/data.js`
- ข้อกำหนด: ต้องเปิดผ่าน **HTTPS** (หรือ localhost) และอุปกรณ์ที่รองรับ AR ถ้าไม่รองรับจะยังดู 3 มิติได้ พร้อมข้อความอธิบาย
- ยังไม่ได้ทดสอบ AR บนอุปกรณ์จริง (ทดสอบได้เฉพาะการแสดงผล 3 มิติ การส่งออก และการจัดการกรณีไม่รองรับ)

## โมเดล 3 มิติของเจ้าของโปรเจกต์ (.glb)

- `assets/model/prang-sam-yot.glb` (2.7 MB) คือโมเดลพระปรางค์สามยอดที่ปั้นเอง ใช้ในไดโอรามาหน้าแรกและหน้ารายละเอียด โหลดแบบ progressive: แสดงโมเดลจำลองก่อน แล้วสลับเป็นไฟล์จริงเมื่อโหลดเสร็จ ถ้าโหลดไม่ได้จะใช้โมเดลจำลองต่อ
- ไฟล์ต้นฉบับ 71 MB (2.1 ล้านสามเหลี่ยม) เก็บไว้ที่ `source-models/prang-sam-yot.original.glb` (อยู่นอกโฟลเดอร์ที่เว็บเสิร์ฟ)
- ทำความสะอาดโมเดล: `tools/clean-sam-yot-glb.mjs` ลบเศษที่ลอย/ขาดวิ่นออกจากไฟล์สแกน (รั้วแผ่นบาง จุดเล็กหน้าขวา และแถบพื้นที่ยื่นไปด้านหน้า รวมราว 11k จาก 2.1M สามเหลี่ยม) ไฟล์ต้นฉบับไม่ถูกแก้ ทำก่อนขั้น optimize
- สร้างไฟล์เว็บด้วย gltf-transform: weld + simplify (ราว 147k สามเหลี่ยม) + บีบอัด geometry ด้วย meshopt + texture เป็น WebP ขนาด 2048
  ```bash
  npx @gltf-transform/cli optimize source-models/prang-sam-yot.original.glb assets/model/prang-sam-yot.glb \
    --compress meshopt --simplify true --simplify-ratio 0.07 --simplify-error 0.002 --texture-compress webp --texture-size 2048 --no-instance --no-palette
  ```
- ใส่ .glb ให้สถานที่อื่น: เพิ่มฟิลด์ `glb: { url, credit }` ใน `assets/js/data.js`

## ตราประจำจังหวัด

ต้นฉบับ `source-models/logolopburi.original.png` (1.6 MB) ย่อเป็น `assets/img/seal-192.png`, `seal-384.png`, `favicon-64.png`, `apple-touch-icon.png` ใช้ที่เมนูซ้าย หัวหน้าเว็บบนมือถือ ตั๋ว Heritage Pass ท้ายเว็บ และ favicon เว็บมีข้อความระบุว่าไม่ใช่เว็บไซต์ทางการของจังหวัด

## แบนเนอร์หน้าปก

ภาพพาโนรามาที่เจ้าของโปรเจกต์จัดเตรียมให้ (ต้นฉบับ `source-models/banner-lopburi.original.jpg`) ย่อเป็น WebP 800/1600 พิกเซล (`assets/img/banner-lopburi-*.webp`, 34/111 KB) ใช้เป็นพื้นหลังด้านหลังตราประจำจังหวัดที่ด้านบนสุดของหน้าแรก ภาพนี้ประกอบจากภาพถ่ายหลายภาพ ยังไม่ทราบผู้ถ่ายและสัญญาอนุญาต หน้าเว็บจึงระบุว่า "จัดเตรียมโดยเจ้าของโปรเจกต์" ถ้าทราบที่มา ให้เพิ่มเครดิตในหน้า "เครดิต" (`index.html`)

## บาร์โค้ดบนตั๋ว

ตั๋ว Heritage Pass มีบาร์โค้ด **Code 128** จริงที่เข้ารหัส `TH-16` (รหัสจังหวัดลพบุรีตาม ISO 3166-2:TH) สร้างด้วย [JsBarcode](https://github.com/lindell/JsBarcode) (MIT) เป็น SVG (`src/barcode.js` → `assets/js/barcode.js`) ตรวจด้วย ZXing ถอดรหัสได้ทั้งหน้าจอ 1×/2×/3× เปลี่ยนค่าได้ที่ `renderBarcode($('#ticketBarcode'), 'TH-16')` ใน `assets/js/app.js` และแก้ข้อความใต้แถบใน `index.html`

## สภาพอากาศ

วิดเจ็ตดึงข้อมูลสดจาก [Open-Meteo](https://open-meteo.com/) (CC BY 4.0, ไม่ต้องใช้ API key) ในเบราว์เซอร์ของผู้ชม ส่งเฉพาะพิกัดตัวเมืองลพบุรี (14.7995, 100.6534) รีเฟรชทุก 15 นาที ถ้าเชื่อมต่อไม่ได้จะแจ้งสถานะพร้อมปุ่มลองใหม่ ไม่แสดงตัวเลขสมมติ

## สมุดเยี่ยม

- รัน `npm start` → บันทึกลง `data/guestbook.json` **ร่วมกันทุกคน** (ตรวจความยาว/ชื่อสถานที่, จำกัดความถี่ 1 ครั้ง/10 วินาที, แสดงผลด้วย `textContent` กัน XSS)
- เปิด `index.html` ตรง ๆ หรือโฮสต์แบบ static → ทำงานในโหมดออฟไลน์ เก็บใน `localStorage` ของเบราว์เซอร์นั้นเท่านั้น
  (หากต้องการแชร์บนโฮสต์ static ให้ชี้ `API` ใน `assets/js/app.js` ไปยัง backend ของคุณที่ตอบ `GET/POST` รูปแบบเดียวกับ `server.js`)

## ภาพถ่ายและวิดีโอ — เครดิต (สำคัญ)

เซสชันที่สร้างงานนี้ออกอินเทอร์เน็ตไปยัง Wikipedia / Wikimedia Commons / YouTube ไม่ได้ จึง **ไม่ได้ฝังภาพถ่ายจริงหรือวิดีโอของใคร** และไม่ได้แต่ง ID วิดีโอขึ้นมาเอง

- ภาพถ่ายจริง: ใส่ใน `assets/js/data.js` ที่ฟิลด์ `photo` ของแต่ละสถานที่ — เว็บจะแสดงผู้ถ่าย สัญญาอนุญาต และลิงก์ต้นฉบับใต้ภาพให้อัตโนมัติ
  ```js
  photo: { src: 'assets/img/sam-yot.jpg', alt: '...', author: 'ชื่อผู้ถ่าย', license: 'CC BY-SA 4.0',
           licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:...' }
  ```
- วิดีโอ: ตอนนี้เป็นปุ่มค้นหา YouTube (ลิงก์ใช้ได้จริงเสมอ) ถ้าเลือกคลิปแล้วให้ใส่ `video: { id, title, channel, url }` เว็บจะฝังคลิป (youtube-nocookie) พร้อมชื่อช่องและลิงก์ต้นทาง
- ภาพแผนที่ไอโซเมตริก (ต้นฉบับ `source-models/map-isometric.original.webp`) ย่อเป็น `assets/img/lopburi-map-768.webp` / `lopburi-map-1536.webp` เป็นภาพที่เจ้าของโปรเจกต์จัดเตรียมให้ พิกัดหมายเลขที่กดได้เก็บเป็นเปอร์เซ็นต์ของภาพที่ฟิลด์ `map` ใน `assets/js/data.js` (ถ้าเปลี่ยนภาพแผนที่ต้องปรับค่านี้ด้วย)

## ความถูกต้องของข้อมูล

ข้อมูลรวบรวมจากผลค้นหาเว็บ (33 แหล่งที่ระบุในหน้า "เครดิต") เนื้อหาใดที่ค้นไม่พบจะเขียนบอกตรง ๆ ว่าไม่พบ (เช่น ปีสร้างวัดพระศรีรัตนมหาธาตุ, ประวัติศาลพระกาฬ) ไม่เติมตัวเลขเอง
เวลาเปิด/ค่าเข้าชมไม่ได้ยืนยัน (ยกเว้นบ้านวิชาเยนทร์ซึ่งมีแหล่งระบุและติดดอกจันไว้) ควรตรวจกับกรมศิลปากรก่อนเผยแพร่

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้า (Tailwind utility classes) |
| `src/input.css`, `tailwind.config.js` | ธีมครีม/ส้มดินเผา + คอมโพเนนต์การ์ดนูน + CSS 3D สำรอง |
| `assets/js/data.js` | ข้อมูลสถานที่, แหล่งอ้างอิง, timeline, เส้นทาง |
| `assets/js/models.js` | นิยามอาคาร 10 แบบ (ไม่ผูกตัวเรนเดอร์) + ตัวเรนเดอร์สำรอง CSS 3D |
| `src/three-scenes.js` → `assets/js/three-scenes.js` | ตัวเรนเดอร์ Three.js: renderer เดียว/canvas เดียว วาดหลาย viewport |
| `assets/js/app.js` | เรนเดอร์, ตัวกรอง, แท็บ, แผนที่, สมุดเยี่ยม |
| `server.js` | static server + API สมุดเยี่ยม (ไม่มี dependency) |
