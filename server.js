/* เซิร์ฟเวอร์เล็ก ๆ ไม่พึ่งไลบรารี: เสิร์ฟไฟล์สถิต + API สมุดเยี่ยม (เก็บใน data/guestbook.json)
   ใช้งาน: npm run build && node server.js  (ตั้งพอร์ตด้วย PORT=8080) */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DB = path.join(ROOT, 'data', 'guestbook.json');
const PORT = process.env.PORT || 3000;
const PLACES = new Set(['', 'sam-yot', 'sala-phra-kan', 'narai-palace', 'wat-lai', 'mahathat', 'wichayen', 'khao-wong', 'prang-khaek', 'sao-thong-thong', 'nakhon-kosa']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const lastPost = new Map();

const readDb = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const writeDb = (v) => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB + '.tmp', JSON.stringify(v)); fs.renameSync(DB + '.tmp', DB); };
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/guestbook') {
    if (req.method === 'GET') return send(res, 200, readDb().slice(0, 200));
    if (req.method === 'POST') {
      const ip = req.socket.remoteAddress;
      if (Date.now() - (lastPost.get(ip) || 0) < 10000) return send(res, 429, { error: 'ส่งถี่เกินไป รอสักครู่' });
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 5000) req.destroy(); });
      req.on('end', () => {
        let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'ข้อมูลไม่ถูกต้อง' }); }
        const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: clean(b.name, 40), message: clean(b.message, 500), rating: Math.min(5, Math.max(0, parseInt(b.rating, 10) || 0)), place: PLACES.has(b.place) ? b.place : '', at: new Date().toISOString() };
        if (!e.name) return send(res, 400, { error: 'กรุณาใส่ชื่อ' });
        if (e.message.length < 3) return send(res, 400, { error: 'ข้อความสั้นเกินไป' });
        lastPost.set(ip, Date.now());
        const db = readDb(); db.unshift(e); writeDb(db.slice(0, 1000));
        send(res, 201, e);
      });
      return;
    }
    return send(res, 405, { error: 'method not allowed' });
  }
  // static
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  const allowed = ['index.html', 'assets'].some(a => file === path.join(ROOT, a) || file.startsWith(path.join(ROOT, a) + path.sep));
  if (!file.startsWith(ROOT + path.sep) || !allowed) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(file, (err, data) => err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream'));
}).listen(PORT, () => console.log(`เปิดที่ http://localhost:${PORT}`));
