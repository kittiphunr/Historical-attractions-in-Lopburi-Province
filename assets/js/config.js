/* ค่าตั้งค่าที่เจ้าของเว็บแก้ได้ (ไฟล์นี้ถูกเผยแพร่พร้อมเว็บ — ห้ามใส่ความลับ เช่น ADMIN_TOKEN) */
window.LOPBURI_CONFIG = {
  // URL ของ API สมุดเยี่ยมที่แชร์ร่วมกัน (Cloudflare Worker ใน backend/cloudflare) เช่น
  //   'https://lopburi-guestbook.<ชื่อบัญชี>.workers.dev/api/guestbook'
  // เว้นว่าง = ใช้ api/guestbook ของเว็บเอง (เมื่อรัน node server.js) ถ้าไม่มีจะเก็บในเบราว์เซอร์ของผู้ชมแต่ละคน
  guestbookApi: ''
};
