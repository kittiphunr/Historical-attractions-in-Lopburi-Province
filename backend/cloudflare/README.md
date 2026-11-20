# สมุดเยี่ยมที่แชร์ร่วมกัน (Cloudflare Workers + D1)

เว็บบน GitHub Pages ไม่มีเซิร์ฟเวอร์ สมุดเยี่ยมจึงเก็บในเบราว์เซอร์ของแต่ละคนเท่านั้น โฟลเดอร์นี้คือ API เล็ก ๆ ที่ทำให้ **ทุกคนเห็นข้อความร่วมกัน**
รันบน Cloudflare Workers + D1 (ฐานข้อมูล SQLite) ใช้แผนฟรีได้ ไม่ต้องใช้บัตรเครดิต และไม่ต้องดูแลเซิร์ฟเวอร์

| ไฟล์ | หน้าที่ |
|---|---|
| `worker.js` | API: `GET/POST /api/guestbook`, `DELETE /api/guestbook/:id` (เจ้าของเว็บ) |
| `schema.sql` | โครงสร้างตาราง |
| `wrangler.toml` | ตั้งค่า Worker/ฐานข้อมูล/โดเมนที่อนุญาต |
| `../../tools/guestbook-admin.mjs` | เครื่องมือดูรายการและลบข้อความไม่เหมาะสม |

## ติดตั้ง (ทำครั้งเดียว ประมาณ 10 นาที)

ต้องมีบัญชี Cloudflare (สมัครฟรีที่ dash.cloudflare.com) และ Node.js

```bash
cd backend/cloudflare
npx wrangler login                                  # เปิดเบราว์เซอร์ให้ล็อกอิน
npx wrangler d1 create lopburi-guestbook            # สร้างฐานข้อมูล แล้วคัดลอก database_id มาใส่ใน wrangler.toml
npx wrangler d1 execute lopburi-guestbook --remote --file=schema.sql   # สร้างตาราง
openssl rand -hex 24                                # สร้างรหัสผู้ดูแลแบบสุ่ม (เก็บไว้ ห้ามใส่ใน repo)
npx wrangler secret put ADMIN_TOKEN                 # วางรหัสนั้นเมื่อถูกถาม
npx wrangler deploy                                 # แสดง URL เช่น https://lopburi-guestbook.<ชื่อ>.workers.dev
```

หมายเหตุ: ถ้า `wrangler d1 create` ถามว่าจะเพิ่ม binding ใน `wrangler.toml` ให้หรือไม่ ตอบตกลงได้ แต่ให้ตรวจว่า `database_id` ถูกต้อง

จากนั้นเปิด `assets/js/config.js` ใส่ URL ของ Worker แล้ว commit/push (เว็บจะเผยแพร่ใหม่เอง)

```js
window.LOPBURI_CONFIG = { guestbookApi: 'https://lopburi-guestbook.<ชื่อ>.workers.dev/api/guestbook' };
```

ถ้าใช้โดเมนอื่นนอกจาก `https://kittiphunr.github.io` ให้เพิ่มโดเมนนั้นใน `ALLOWED_ORIGINS` ของ `wrangler.toml` แล้วรัน `npx wrangler deploy` อีกครั้ง (ไม่เช่นนั้นเบราว์เซอร์จะปฏิเสธ — CORS)

## ดูแลข้อความ

```bash
export GUESTBOOK_API=https://lopburi-guestbook.<ชื่อ>.workers.dev/api/guestbook
node tools/guestbook-admin.mjs list                          # ดูรายการล่าสุดพร้อม id
ADMIN_TOKEN=<รหัสผู้ดูแล> node tools/guestbook-admin.mjs delete <id>   # ลบข้อความ
```

## การป้องกันสแปมและข้อมูลส่วนบุคคล
- จำกัดความยาว (ชื่อ 40 / ข้อความ 500), ตัดอักขระควบคุม/ทิศทางข้อความ, **ห้ามมีลิงก์**, ตรวจชื่อสถานที่จากรายการที่กำหนด
- จำกัดความถี่ **3 ข้อความ / 10 นาที ต่อผู้ใช้** และ **120 ข้อความ / ชั่วโมง ต่อทั้งระบบ** (ปรับที่ `LIMITS` ใน `worker.js`)
- เก็บเฉพาะรายการล่าสุด 2,000 รายการ
- เก็บ **ชื่อ ข้อความ คะแนน สถานที่ เวลา** และ **ค่าแฮชของ IP** (SHA-256 ตัดสั้น ผสมรหัสลับ) เพื่อจำกัดความถี่เท่านั้น ไม่เก็บ IP จริง ย้อนกลับไม่ได้
- หน้าเว็บมีข้อความเตือนผู้เขียนใต้ฟอร์มว่าข้อความเป็นสาธารณะ ควรไม่ใส่ข้อมูลส่วนตัว (ถ้าเปิดใช้งานจริงในประเทศไทย ควรพิจารณาเรื่อง PDPA และนโยบายความเป็นส่วนตัวของเว็บ)

## โควตาแผนฟรี (โดยประมาณ)
Workers 100,000 คำขอ/วัน, D1 ราว 5 ล้านการอ่าน/วัน และ 100,000 การเขียน/วัน, พื้นที่ 5 GB — เกินพอสำหรับสมุดเยี่ยมของเว็บท่องเที่ยว (ตรวจตัวเลขล่าสุดที่เอกสาร Cloudflare)

## ทดสอบบนเครื่อง (ไม่ต้องล็อกอิน)
```bash
cd backend/cloudflare
npx wrangler d1 execute lopburi-guestbook --local --file=schema.sql
npx wrangler dev --local --port 8787 --var ADMIN_TOKEN:testtoken123
```
แล้วตั้ง `guestbookApi: 'http://localhost:8787/api/guestbook'` (โดเมน `http://localhost:4173` และ `:3000` อนุญาตไว้แล้ว)
