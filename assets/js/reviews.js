/* รีวิวสถานที่ในหน้าสถานที่ (places/<id>.html): แสดงคะแนนเฉลี่ย รายการรีวิวที่ผู้ดูแลอนุมัติแล้ว และฟอร์มเขียนรีวิว
   ใช้ API ที่ตั้งใน assets/js/config.js (reviewsApi, เช่น 'api/reviews.php' เมื่อติดตั้งแบบ PHP + MySQL) ถ้าไม่ได้ตั้งหรือเรียกไม่ได้ ส่วนนี้จะไม่แสดง
   ข้อความของผู้ใช้แสดงด้วย textContent เสมอ (ไม่แปลงเป็น HTML) */
(function () {
  const CFG = window.LOPBURI_CONFIG || {}, sec = document.getElementById('reviews');
  if (!sec || !CFG.reviewsApi) return;
  const place = document.body.dataset.place, T = window.T || ((s, ...v) => v.reduce((r, x, i) => r.replace('{' + i + '}', x), s));
  const $ = (id) => document.getElementById(id), PAGE = 10;
  let shown = 0, total = 0, busy = false;

  const stars = (n, cls = '') => { const s = document.createElement('span'); s.className = 'text-amber-500 ' + cls; s.setAttribute('role', 'img'); s.setAttribute('aria-label', T('{0} ดาว', n)); s.textContent = '★'.repeat(n) + '☆'.repeat(5 - n); return s; };
  const locale = () => (window.I18N && window.I18N.locale) || 'th-TH';
  async function api(query, init) {
    const r = await fetch(CFG.reviewsApi + query, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'บันทึกไม่สำเร็จ'), { status: r.status });
    return j;
  }

  function renderSummary(avg, count) {
    const box = $('rvSummary'); box.replaceChildren();
    if (!count) { const p = document.createElement('p'); p.className = 'text-ink-500'; p.textContent = T('ยังไม่มีรีวิว เป็นคนแรกที่เขียนรีวิวสถานที่นี้'); box.append(p); return; }
    const big = document.createElement('p'); big.className = 'text-5xl font-semibold text-ink-900'; big.textContent = Number(avg).toFixed(1);
    const right = document.createElement('div'); const st = stars(Math.round(avg), 'text-2xl'); st.setAttribute('aria-label', T('คะแนนเฉลี่ย {0} จาก 5', Number(avg).toFixed(1)));
    const c = document.createElement('p'); c.className = 'text-sm text-ink-500'; c.textContent = T('จาก {0} รีวิว', count);
    right.append(st, c); box.append(big, right);
  }
  function addItems(items) {
    const ul = $('rvList');
    items.forEach(it => {
      const li = document.createElement('li'); li.className = 'neu p-4';
      const head = document.createElement('div'); head.className = 'flex flex-wrap items-center justify-between gap-2';
      const n = document.createElement('p'); n.className = 'font-medium text-ink-900'; n.textContent = it.name;
      head.append(n, stars(it.rating));
      const d = document.createElement('p'); d.className = 'mt-0.5 text-xs text-ink-400'; d.textContent = new Date(it.at).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' });
      const m = document.createElement('p'); m.className = 'mt-2 whitespace-pre-wrap break-words text-ink-700'; m.textContent = it.message;
      li.append(head, d, m); ul.append(li);
    });
    shown += items.length; $('rvMore').classList.toggle('hidden', shown >= total);
  }
  async function load(first) {
    if (busy) return; busy = true;
    try {
      const j = await api(`?place=${encodeURIComponent(place)}&limit=${PAGE}&offset=${shown}`);
      total = j.count; if (first) { renderSummary(j.avg, j.count); sec.classList.remove('hidden'); }
      addItems(j.items);
    } catch (e) { console.warn('โหลดรีวิวไม่สำเร็จ', e); if (!first) setStatus(T('โหลดรีวิวไม่สำเร็จ ลองอีกครั้ง'), true); }
    busy = false;
  }

  /* ---- ฟอร์ม ---- */
  let rating = 0;
  const box = $('rvStars');
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.setAttribute('aria-label', T('ให้ {0} ดาว', i)); b.textContent = '★';
    b.className = 'text-ink-400/40 transition hover:scale-110'; b.addEventListener('click', () => { rating = i; paint(); }); box.append(b);
  }
  const paint = () => [...box.children].forEach((b, i) => { b.classList.toggle('text-amber-500', i < rating); b.classList.toggle('text-ink-400/40', i >= rating); b.setAttribute('aria-checked', i + 1 === rating); });
  const setStatus = (t, bad) => { const s = $('rvStatus'); s.textContent = t; s.className = 'text-sm ' + (bad ? 'text-red-700' : 'text-emerald-700'); };

  $('rvForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget, btn = f.querySelector('button[type=submit]');
    if (f.website.value) return;
    const name = f.name.value.trim(), message = f.message.value.trim();
    if (!name) { setStatus(T('กรุณาใส่ชื่อ'), true); f.name.focus(); return; }
    if (!rating) { setStatus(T('กรุณาให้คะแนนดาว'), true); box.firstElementChild.focus(); return; }
    if (message.length < 5) { setStatus(T('ข้อความสั้นเกินไป'), true); f.message.focus(); return; }
    btn.disabled = true; setStatus(T('กำลังส่ง…'), false);
    try {
      await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ place, name, rating, message, lang: document.documentElement.lang }) });
      f.reset(); rating = 0; paint(); setStatus(T('ขอบคุณสำหรับรีวิว! รีวิวจะแสดงหลังผู้ดูแลตรวจสอบ'), false);
    } catch (e) { setStatus(e.status ? T(e.message) : T('บันทึกไม่สำเร็จ'), true); }
    btn.disabled = false;
  });
  $('rvMore').addEventListener('click', () => load(false));
  load(true);
})();
