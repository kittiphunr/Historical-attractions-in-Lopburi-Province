/* API สมุดเยี่ยมที่แชร์ร่วมกัน — Cloudflare Workers + D1 (SQLite)
   สัญญา (contract) เดียวกับ server.js: GET /api/guestbook -> [{id,name,message,rating,place,at}] (ใหม่สุดก่อน)
                                         POST /api/guestbook {name,message,rating,place} -> 201 {…รายการที่บันทึก}
   เพิ่มเติม: DELETE /api/guestbook/:id (เจ้าของเว็บ ใช้ Bearer ADMIN_TOKEN) สำหรับลบข้อความไม่เหมาะสม
   ป้องกันสแปม: จำกัดความยาว, ห้ามลิงก์, จำกัดความถี่ต่อผู้ใช้ (เก็บเฉพาะค่าแฮชของ IP) และต่อทั้งระบบ, CORS เฉพาะโดเมนที่อนุญาต */

const PLACES = new Set(['', 'sam-yot', 'sala-phra-kan', 'narai-palace', 'wat-lai', 'mahathat', 'wichayen', 'khao-wong', 'prang-khaek', 'sao-thong-thong', 'nakhon-kosa']);
const LIMITS = { name: 40, message: 500, bodyBytes: 4000, perIpWindowMs: 10 * 60 * 1000, perIpMax: 3, globalWindowMs: 60 * 60 * 1000, globalMax: 120, keep: 2000, list: 200 };
// ข้อความผิดพลาดเป็นภาษาไทย เพราะหน้าเว็บแปลตามพจนานุกรม i18n ให้เอง
const MSG = { name: 'กรุณาใส่ชื่อ', short: 'ข้อความสั้นเกินไป', bad: 'ข้อมูลไม่ถูกต้อง', links: 'ห้ามใส่ลิงก์ในข้อความ', rate: 'ส่งถี่เกินไป รอสักครู่', busy: 'ระบบรับข้อความหนาแน่น ลองใหม่ภายหลัง' };

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, max);
const hasLink = (s) => /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|info|xyz|top|ru|cn|co|io|me|biz|click|link)\b)/i.test(s);

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin'); if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes('*') || list.includes(origin) ? origin : null;
}
function cors(request, env, extra = {}) {
  const o = allowedOrigin(request, env);
  return { ...(o ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : { Vary: 'Origin' }), ...extra };
}
const json = (request, env, body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: cors(request, env, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extra }) });

async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const data = new TextEncoder().encode(ip + '|' + (env.ADMIN_TOKEN || 'lopburi-salt'));
  const h = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(h)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url); const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') {
      if (!allowedOrigin(request, env)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(request, env, { 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' }) });
    }
    if (path === '/') return json(request, env, { ok: true, service: 'lopburi-guestbook' });

    // GET /api/guestbook
    if (path === '/api/guestbook' && request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, name, message, rating, place, at FROM entries ORDER BY at DESC LIMIT ?').bind(LIMITS.list).all();
      return json(request, env, results, 200, { 'Cache-Control': 'public, max-age=15' });
    }

    // POST /api/guestbook
    if (path === '/api/guestbook' && request.method === 'POST') {
      const o = request.headers.get('Origin'); if (o && !allowedOrigin(request, env)) return json(request, env, { error: MSG.bad }, 403);
      const raw = await request.text(); if (raw.length > LIMITS.bodyBytes) return json(request, env, { error: MSG.bad }, 413);
      let b; try { b = JSON.parse(raw); } catch { return json(request, env, { error: MSG.bad }, 400); }
      if (!b || typeof b !== 'object') return json(request, env, { error: MSG.bad }, 400);
      const name = clean(b.name, LIMITS.name), message = clean(b.message, LIMITS.message);
      const rating = Math.min(5, Math.max(0, parseInt(b.rating, 10) || 0)), place = PLACES.has(b.place) ? b.place : '';
      if (!name) return json(request, env, { error: MSG.name }, 400);
      if (message.length < 3) return json(request, env, { error: MSG.short }, 400);
      if (hasLink(name) || hasLink(message)) return json(request, env, { error: MSG.links }, 400);

      const now = Date.now(), at = new Date(now).toISOString(), ip = await ipHash(request, env);
      const mine = await env.DB.prepare('SELECT COUNT(*) AS c FROM entries WHERE ip_hash = ? AND at > ?').bind(ip, new Date(now - LIMITS.perIpWindowMs).toISOString()).first();
      if (mine && mine.c >= LIMITS.perIpMax) return json(request, env, { error: MSG.rate }, 429, { 'Retry-After': '600' });
      const all = await env.DB.prepare('SELECT COUNT(*) AS c FROM entries WHERE at > ?').bind(new Date(now - LIMITS.globalWindowMs).toISOString()).first();
      if (all && all.c >= LIMITS.globalMax) return json(request, env, { error: MSG.busy }, 429, { 'Retry-After': '900' });

      const id = crypto.randomUUID().slice(0, 12);
      await env.DB.prepare('INSERT INTO entries (id, name, message, rating, place, at, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, name, message, rating, place, at, ip).run();
      // เก็บเฉพาะรายการล่าสุด ไม่ให้ฐานข้อมูลโตไม่จำกัด
      await env.DB.prepare('DELETE FROM entries WHERE id IN (SELECT id FROM entries ORDER BY at DESC LIMIT -1 OFFSET ?)').bind(LIMITS.keep).run();
      return json(request, env, { id, name, message, rating, place, at }, 201);
    }

    // DELETE /api/guestbook/:id  (เจ้าของเว็บเท่านั้น)
    const m = path.match(/^\/api\/guestbook\/([A-Za-z0-9-]{4,40})$/);
    if (m && request.method === 'DELETE') {
      if (!env.ADMIN_TOKEN) return json(request, env, { error: 'admin disabled' }, 503);
      const auth = request.headers.get('Authorization') || '';
      if (!safeEqual(auth, 'Bearer ' + env.ADMIN_TOKEN)) return json(request, env, { error: 'unauthorized' }, 401);
      const r = await env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(m[1]).run();
      return json(request, env, { deleted: r.meta && r.meta.changes ? r.meta.changes : 0 });
    }
    return json(request, env, { error: 'not found' }, 404);
  }
};
