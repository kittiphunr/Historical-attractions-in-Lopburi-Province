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
- ภาพแผนที่ `assets/img/lopburi-map.jpg` เป็นภาพที่เจ้าของโปรเจกต์จัดเตรียมให้

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
