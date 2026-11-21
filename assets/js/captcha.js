/* CAPTCHA กันสแปมของสมุดเยี่ยมและรีวิว (ใช้ร่วมกันทั้ง app.js และ reviews.js)
   ตั้ง captchaApi ใน assets/js/config.js (เช่น 'api/captcha.php' เมื่อติดตั้งแบบ PHP + MySQL) เว้นว่าง = ไม่ใช้
   โหมดตามที่เซิร์ฟเวอร์กำหนด: 'pow' = เบราว์เซอร์คำนวณ proof-of-work เงียบ ๆ (~1 วินาที) · 'turnstile' = Cloudflare Turnstile · 'off'
   ใช้งาน: LopburiCaptcha.prepare(form) เมื่อผู้ใช้เริ่มกรอกฟอร์ม (เริ่มคำนวณล่วงหน้า) แล้ว await LopburiCaptcha.get(form) ตอนส่ง
   ได้ค่าที่ต้องแนบไปกับ JSON ในชื่อ captcha (หรือ null เมื่อปิด) โจทย์ใช้ได้ครั้งเดียว */
(function () {
  const CFG = window.LOPBURI_CONFIG || {};
  if (!CFG.captchaApi) { window.LopburiCaptcha = { enabled: false, prepare() {}, get: async () => null }; return; }

  const enc = new TextEncoder();
  let cached = null, cachedAt = 0, tsScript = null;

  function zeroBits(bytes, need) {
    let n = 0;
    for (const b of bytes) { if (b === 0) { n += 8; } else { n += Math.clz32(b) - 24; break; } if (n >= need) break; }
    return n >= need;
  }

  async function solvePow(ch) {
    if (!(window.crypto && crypto.subtle)) throw new Error('no-subtle');
    const BATCH = 512;
    for (let n = Math.floor(Math.random() * 1e6); ; n += BATCH) {
      const hs = await Promise.all(Array.from({ length: BATCH }, (_, i) => crypto.subtle.digest('SHA-256', enc.encode(ch.salt + (n + i)))));
      for (let i = 0; i < BATCH; i++) if (zeroBits(new Uint8Array(hs[i]), ch.bits)) return { salt: ch.salt, exp: ch.exp, sig: ch.sig, n: String(n + i) };
    }
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return tsScript || (tsScript = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = ok; s.onerror = () => { tsScript = null; no(new Error('ts-load')); };
      document.head.append(s);
    }));
  }

  async function turnstile(sitekey, form) {
    await loadTurnstile();
    const box = document.createElement('div'); box.className = 'my-2';
    const btn = form && form.querySelector('button[type=submit]');
    if (btn) btn.before(box); else document.body.append(box);
    return new Promise((ok, no) => {
      const done = (fn, v) => { try { window.turnstile.remove(id); } catch (e) { /* ignore */ } box.remove(); fn(v); };
      const id = window.turnstile.render(box, {
        sitekey, appearance: 'interaction-only',
        callback: (token) => done(ok, { token }),
        'error-callback': () => done(no, new Error('ts-error')),
        'timeout-callback': () => done(no, new Error('ts-timeout')),
      });
    });
  }

  async function build(form) {
    const r = await fetch(CFG.captchaApi, { cache: 'no-store' });
    if (!r.ok) throw new Error('challenge');
    const ch = await r.json();
    if (ch.mode === 'off') return null;
    if (ch.mode === 'turnstile') return turnstile(ch.sitekey, form);
    return solvePow(ch);
  }

  function prepare(form) {
    if (cached && Date.now() - cachedAt < 240000) return cached;
    cachedAt = Date.now();
    const p = cached = build(form);
    p.catch(() => { if (cached === p) cached = null; });
    return p;
  }

  window.LopburiCaptcha = {
    enabled: true, prepare,
    async get(form) { const p = prepare(form); cached = null; return p; },
  };
})();
