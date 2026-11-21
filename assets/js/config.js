/* ค่าตั้งค่าที่เจ้าของเว็บแก้ได้ (ไฟล์นี้ถูกเผยแพร่พร้อมเว็บ — ห้ามใส่ความลับ เช่น ADMIN_TOKEN หรือรหัสผ่านฐานข้อมูล) */
window.LOPBURI_CONFIG = {
  // URL ของ API สมุดเยี่ยมที่แชร์ร่วมกัน เช่น
  //   'api/guestbook.php'  (ติดตั้งแบบ PHP + MySQL บนโฮสต์: npm run package -- --php ตั้งค่านี้ให้เอง)
  //   'https://lopburi-guestbook.<ชื่อบัญชี>.workers.dev/api/guestbook'  (Cloudflare Worker ใน backend/cloudflare)
  // เว้นว่าง = ใช้ api/guestbook ของเว็บเอง (เมื่อรัน node server.js) ถ้าไม่มีจะเก็บในเบราว์เซอร์ของผู้ชมแต่ละคน
  guestbookApi: '',
  // URL ของ API รีวิวสถานที่ (ใช้กับ PHP + MySQL เท่านั้น) เช่น 'api/reviews.php'
  // เว้นว่าง = ซ่อนส่วน "รีวิวจากผู้เข้าชม" ในหน้าสถานที่
  reviewsApi: '',
  // URL ของ API ออกโจทย์ CAPTCHA กันสแปม (ใช้กับ PHP + MySQL) เช่น 'api/captcha.php' เว้นว่าง = ไม่ใช้ CAPTCHA
  captchaApi: ''
};
