(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = window.ATTRACTIONS, S = window.SOURCES, SRC = Object.fromEntries(S.map(s => [s.id, s]));
  const ERA = { all: 'ทั้งหมด', dvaravati: 'ทวารวดี', khmer: 'ขอม', ayutthaya: 'อยุธยา–พระนารายณ์', faith: 'ภูเขา–ศรัทธา' };
  const ERA_COLOR = { dvaravati: 'bg-river-500/20 text-river-400', khmer: 'bg-laterite-500/25 text-laterite-300', ayutthaya: 'bg-gold-500/20 text-gold-300', faith: 'bg-emerald-600/20 text-emerald-300' };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- nav ---------- */
  const nav = $('#nav'), bar = $('#progress');
  const onScroll = () => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('bg-ink-950/85', y > 30); nav.classList.toggle('backdrop-blur-md', y > 30);
    bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('#menuBtn').addEventListener('click', (e) => {
    const m = $('#mobileMenu'); const open = m.classList.toggle('hidden') === false;
    e.currentTarget.setAttribute('aria-expanded', open);
  });
  $$('#mobileMenu a').forEach(a => a.addEventListener('click', () => $('#mobileMenu').classList.add('hidden')));

  /* ---------- hero model + dust ---------- */
  const hero = window.Lopburi3D.createModel('triprang', 520);
  $('#heroModel').appendChild(hero.root);
  window.Lopburi3D.interactive($('#heroModel'), hero.stage, { speed: 0.15 });
  $('#srcCount').textContent = S.length + '+';

  (function dust() {
    const c = $('#dust'), x = c.getContext('2d'); let w, h, ps = [];
    const size = () => { w = c.width = c.offsetWidth; h = c.height = c.offsetHeight; ps = Array.from({ length: Math.min(70, w / 20) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + .4, v: Math.random() * .25 + .05, a: Math.random() * .6 + .2 })); };
    size(); addEventListener('resize', size);
    if (reduce) return;
    (function loop() {
      x.clearRect(0, 0, w, h);
      ps.forEach(p => { p.y -= p.v; p.x += Math.sin(p.y / 60) * .2; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; } x.fillStyle = `rgba(230,196,115,${p.a})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.3); x.fill(); });
      requestAnimationFrame(loop);
    })();
  })();

  /* ---------- timeline ---------- */
  $('#timeline').innerHTML = window.TIMELINE.map((t, i) => `
    <li class="reveal glass rounded-2xl p-6" style="transition-delay:${i * 80}ms">
      <p class="font-display text-4xl text-gold-500/50">${String(i + 1).padStart(2, '0')}</p>
      <h3 class="mt-2 font-display text-xl text-sand-50">${esc(t.era)}</h3>
      <p class="mt-1 text-xs tracking-wide text-gold-400">${esc(t.when)}</p>
      <p class="mt-3 text-sm leading-relaxed text-sand-200/85">${esc(t.text)}</p>
      <a class="mt-4 inline-block text-xs text-gold-300/80 underline-offset-4 hover:underline" href="${esc(SRC[t.src].url)}" target="_blank" rel="noopener noreferrer">ที่มา: ${esc(SRC[t.src].name.split(' — ')[0])} ↗</a>
    </li>`).join('');

  /* ---------- map hotspots ---------- */
  const mapWrap = $('#mapWrap');
  A.filter(a => a.map).forEach(a => {
    const b = document.createElement('a');
    b.href = '#' + a.id;
    b.className = 'group absolute -translate-x-1/2 -translate-y-1/2';
    b.style.left = a.map[0] + '%'; b.style.top = a.map[1] + '%';
    b.setAttribute('aria-label', `${a.name} — ดูรายละเอียด`);
    b.innerHTML = `<span class="absolute inset-0 -m-3 animate-ping rounded-full bg-gold-300/40"></span>
      <span class="relative grid h-9 w-9 place-items-center rounded-full border-2 border-gold-200 bg-ink-950/80 font-display text-sm text-gold-200 shadow-glow transition group-hover:scale-125 group-hover:bg-gold-400 group-hover:text-ink-950">${a.no}</span>
      <span class="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-950/95 px-3 py-1.5 text-xs text-sand-50 opacity-0 shadow-deep transition group-hover:opacity-100 group-focus-visible:opacity-100">${esc(a.name)}</span>`;
    mapWrap.appendChild(b);
  });
  // tilt แผนที่เบา ๆ ตามเมาส์
  (function tilt(el) {
    if (reduce || matchMedia('(hover: none)').matches) return;
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(1200px) rotateY(${px * 5}deg) rotateX(${-py * 4}deg)`; });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  })($('#mapTilt'));

  /* ---------- places ---------- */
  const list = $('#placeList');
  function photoBlock(a) {
    if (a.photo) {
      const p = a.photo;
      return `<figure class="overflow-hidden rounded-2xl border border-gold-500/20">
        <img src="${esc(p.src)}" alt="${esc(p.alt || a.name)}" loading="lazy" class="w-full object-cover">
        <figcaption class="bg-ink-900/90 px-4 py-2 text-xs text-sand-200/80">ภาพ: ${esc(p.author)} · ${p.licenseUrl ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(p.licenseUrl)}">${esc(p.license)}</a>` : esc(p.license)} · <a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(p.sourceUrl)}">ต้นฉบับ ↗</a></figcaption></figure>`;
    }
    return `<div class="grid place-items-center rounded-2xl border border-dashed border-gold-500/30 bg-ink-900/40 px-4 py-6 text-center text-xs text-sand-200/60">
      <p>ช่องภาพถ่ายจริง · ยังไม่ได้ใส่ภาพ</p>
      <p class="mt-1 text-sand-200/40">ภาพที่ใส่ต้องมีผู้ถ่าย สัญญาอนุญาต และลิงก์ต้นทางแสดงใต้ภาพ</p></div>`;
  }
  function videoBlock(a) {
    const v = a.video;
    if (v.id) {
      return `<div class="overflow-hidden rounded-2xl border border-gold-500/20">
        <div class="aspect-video"><iframe class="h-full w-full" loading="lazy" src="https://www.youtube-nocookie.com/embed/${esc(v.id)}" title="${esc(v.title || a.name)}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <p class="bg-ink-900/90 px-4 py-2 text-xs text-sand-200/80">วิดีโอ: ${esc(v.title || '')} · ช่อง ${esc(v.channel || '')} · <a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(v.url)}">ดูบน YouTube ↗</a></p></div>`;
    }
    return `<a class="btn-ghost w-full justify-center text-sm" target="_blank" rel="noopener noreferrer" href="${esc(v.search)}">
      <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
      ค้นวิดีโอแนะนำบน YouTube</a>
      <p class="mt-2 text-center text-[11px] text-sand-200/50">เปิดผลค้นหา “${esc(v.query)}” — วิดีโอทุกคลิปเป็นสิทธิ์ของเจ้าของช่อง ดูชื่อช่องในหน้าวิดีโอ</p>`;
  }
  const bullets = (arr, dot = 'bg-gold-400') => `<ul class="space-y-3">${arr.map(t => `<li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}"></span><span>${esc(t)}</span></li>`).join('')}</ul>`;
  const paras = (arr) => arr.map(t => `<p>${esc(t)}</p>`).join('');

  function render(filter = 'all') {
    list.innerHTML = '';
    const items = A.filter(a => filter === 'all' || a.era === filter);
    $('#emptyMsg').classList.toggle('hidden', items.length > 0);
    items.forEach((a, idx) => {
      const flip = idx % 2 === 1;
      const el = document.createElement('article');
      el.id = a.id; el.className = 'reveal scroll-mt-28';
      el.innerHTML = `
        <div class="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
          <div class="${flip ? 'lg:order-2' : ''} lg:col-span-5 lg:sticky lg:top-28">
            <div class="glass relative overflow-hidden rounded-3xl shadow-deep">
              <span class="absolute left-5 top-3 z-10 font-display text-7xl font-bold text-gold-500/20">${a.no}</span>
              <div class="model h-[340px] sm:h-[400px]" data-model="${a.model}" role="img" aria-label="โมเดล 3 มิติจำลอง ${esc(a.name)} ลากเพื่อหมุน"></div>
              <p class="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-sand-200/60">↻ ลากเพื่อหมุน · รูปทรงจำลองอย่างง่าย</p>
            </div>
            <div class="mt-5 space-y-4">${photoBlock(a)}${videoBlock(a)}</div>
          </div>
          <div class="${flip ? 'lg:order-1' : ''} lg:col-span-7">
            <span class="inline-block rounded-full px-3 py-1 text-xs ${ERA_COLOR[a.era]}">${esc(a.eraLabel)}</span>
            <h3 class="mt-4 font-display text-4xl font-bold text-sand-50 sm:text-5xl">${esc(a.name)}</h3>
            <p class="mt-1 text-sm tracking-widest text-gold-400">${esc(a.en)}</p>
            <p class="mt-5 font-display text-xl leading-snug text-gold-200">${esc(a.tagline)}</p>
            <p class="mt-4 leading-relaxed text-sand-200/90">${esc(a.summary)}</p>
            <dl class="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              ${a.facts.map(([k, v]) => `<div class="rounded-xl border border-gold-500/15 bg-ink-800/50 p-3"><dt class="text-[11px] uppercase tracking-wider text-gold-400/80">${esc(k)}</dt><dd class="mt-1 text-sm text-sand-50">${esc(v)}</dd></div>`).join('')}
            </dl>
            <div class="mt-8" data-tabs>
              <div role="tablist" class="flex flex-wrap gap-2 border-b border-gold-500/20 pb-3">
                ${[['history', 'ประวัติศาสตร์'], ['arch', 'สถาปัตยกรรม'], ['hi', 'ไฮไลต์'], ['visit', 'เตรียมตัวไป']].map(([k, l], i) =>
                  `<button role="tab" id="${a.id}-t-${k}" aria-controls="${a.id}-p-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tab="${k}" class="rounded-full px-4 py-2 text-sm transition aria-selected:bg-gold-400 aria-selected:text-ink-950 text-sand-200 hover:text-gold-200">${l}</button>`).join('')}
              </div>
              <div class="mt-5 min-h-[160px] space-y-4 leading-relaxed text-sand-200/90">
                <div role="tabpanel" id="${a.id}-p-history" aria-labelledby="${a.id}-t-history" class="space-y-4">${paras(a.history)}</div>
                <div role="tabpanel" id="${a.id}-p-arch" aria-labelledby="${a.id}-t-arch" class="hidden space-y-4">${paras(a.architecture)}</div>
                <div role="tabpanel" id="${a.id}-p-hi" aria-labelledby="${a.id}-t-hi" class="hidden">${bullets(a.highlights)}</div>
                <div role="tabpanel" id="${a.id}-p-visit" aria-labelledby="${a.id}-t-visit" class="hidden">${bullets(a.visit, 'bg-laterite-300')}</div>
              </div>
            </div>
            <div class="mt-8 border-t border-gold-500/15 pt-5">
              <p class="mb-2 text-xs uppercase tracking-wider text-gold-400/80">แหล่งอ้างอิง</p>
              <div class="flex flex-wrap gap-2">${a.sources.map(id => `<a class="rounded-full border border-gold-500/25 px-3 py-1 text-xs text-sand-200 hover:border-gold-300 hover:text-gold-200" target="_blank" rel="noopener noreferrer" href="${esc(SRC[id].url)}" title="${esc(SRC[id].name)}">${esc(SRC[id].name.split(' — ')[0])} ↗</a>`).join('')}</div>
            </div>
          </div>
        </div>`;
      list.appendChild(el);
      const host = $('.model', el); const m = window.Lopburi3D.createModel(a.model, 360);
      host.appendChild(m.root); window.Lopburi3D.interactive(host, m.stage, { speed: 0.1, ry: -28 + idx * 20 });
    });
    observeReveal();
  }
  list.addEventListener('click', (e) => {
    const t = e.target.closest('[role=tab]'); if (!t) return;
    const root = t.closest('[data-tabs]');
    $$('[role=tab]', root).forEach(b => { const on = b === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).classList.toggle('hidden', !on); });
  });
  list.addEventListener('keydown', (e) => {
    const t = e.target.closest('[role=tab]'); if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('[role=tab]', t.closest('[data-tabs]')); const i = tabs.indexOf(t);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
  });

  const filters = $('#filters');
  Object.entries(ERA).forEach(([k, l]) => {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = l; b.setAttribute('aria-pressed', k === 'all'); b.dataset.k = k;
    b.addEventListener('click', () => { $$('button', filters).forEach(x => x.setAttribute('aria-pressed', x === b)); render(k); });
    filters.appendChild(b);
  });

  /* ---------- route ---------- */
  $('#routeList').innerHTML = window.ROUTE.map(([n, id, note], i) => `
    <li class="reveal relative pb-8" style="transition-delay:${i * 60}ms">
      <span class="absolute -left-[3.05rem] top-0 grid h-9 w-9 place-items-center rounded-full border border-gold-400 bg-ink-950 font-display text-gold-300">${i + 1}</span>
      <a href="#${id}" class="group block rounded-2xl border border-transparent p-4 transition hover:border-gold-500/30 hover:bg-ink-800/50">
        <h3 class="font-display text-xl text-sand-50 group-hover:text-gold-200">${esc(n)}</h3>
        <p class="mt-1 text-sm text-sand-200/70">${esc(note)}</p>
      </a>
    </li>`).join('');

  /* ---------- credits ---------- */
  $('#mediaTable').innerHTML = A.map(a => `<tr><td class="px-4 py-3 text-sand-50">${esc(a.name)}</td>
    <td class="px-4 py-3">${a.photo ? `<span class="text-emerald-300">มี · ${esc(a.photo.author)}</span>` : '<span class="text-sand-200/50">ยังไม่ได้ใส่</span>'}</td>
    <td class="px-4 py-3">${a.video.id ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(a.video.url)}">${esc(a.video.channel)}</a>` : `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(a.video.search)}">ลิงก์ค้นหา</a>`}</td></tr>`).join('');
  $('#srcTotal').textContent = S.length;
  $('#srcList').innerHTML = S.map(s => `<li><a class="block rounded-lg border border-gold-500/10 px-3 py-2 text-sand-200 hover:border-gold-400/50 hover:text-gold-200" target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.name)} <span class="text-gold-400/60">↗</span></a></li>`).join('');

  /* ---------- reveal ---------- */
  let io;
  function observeReveal() {
    io = io || new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08, rootMargin: '0px 0px -40px' });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }
  render(); observeReveal();
  // กรณีลิงก์ hash ไปยังสถานที่ที่เพิ่งเรนเดอร์
  if (location.hash && $(location.hash)) setTimeout(() => $(location.hash).scrollIntoView(), 50);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', () => { const t = $(a.getAttribute('href')); if (t) t.classList.add('in'); }));

  /* ---------- guestbook ---------- */
  const API = 'api/guestbook', LS = 'lopburi.guestbook.v1';
  let mode = 'local', entries = [], rating = 0;
  const gbList = $('#gbList');
  $('#gbPlace').innerHTML = '<option value="">— ภาพรวมทั้งจังหวัด —</option>' + A.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const stars = $('#stars');
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.setAttribute('aria-label', i + ' ดาว'); b.textContent = '★'; b.className = 'text-sand-200/30 transition hover:scale-110';
    b.addEventListener('click', () => { rating = i; paint(); });
    stars.appendChild(b);
  }
  const paint = () => $$('button', stars).forEach((b, i) => { b.classList.toggle('text-gold-300', i < rating); b.classList.toggle('text-sand-200/30', i >= rating); b.setAttribute('aria-checked', i + 1 === rating); });
  const msg = $('#gbMsg'); msg.addEventListener('input', () => ($('#gbCount').textContent = msg.value.length + '/500'));

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } };
  const writeLocal = (v) => { try { localStorage.setItem(LS, JSON.stringify(v.slice(0, 200))); } catch { /* private mode */ } };
  const seed = [{ id: 'seed1', name: 'ทีมงานเว็บไซต์', rating: 5, place: 'sam-yot', message: 'ยินดีต้อนรับสู่สมุดเยี่ยม เขียนเล่าประสบการณ์ของคุณได้เลย เคล็ดลับเรื่องลิงและเวลาที่เหมาะกับการถ่ายภาพก็ช่วยผู้มาหลังได้มาก', at: '2026-11-20T00:00:00.000Z', seed: true }];

  async function load() {
    try {
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw 0;
      entries = await r.json(); mode = 'server';
    } catch { entries = readLocal(); mode = 'local'; }
    $('#gbMode').textContent = mode === 'server' ? '● บันทึกร่วมกันทุกคน (เซิร์ฟเวอร์)' : '● โหมดออฟไลน์: บันทึกเฉพาะในเบราว์เซอร์นี้ (รัน node server.js เพื่อแชร์ร่วมกัน)';
    draw();
  }
  function draw() {
    const all = [...entries, ...seed];
    gbList.innerHTML = '';
    all.forEach(e => {
      const li = document.createElement('li'); li.className = 'rounded-2xl border border-gold-500/15 bg-ink-800/50 p-5';
      const head = document.createElement('div'); head.className = 'flex flex-wrap items-center justify-between gap-2';
      const n = document.createElement('p'); n.className = 'font-display text-lg text-sand-50'; n.textContent = e.name;
      const st = document.createElement('p'); st.className = 'text-gold-300'; st.setAttribute('aria-label', e.rating + ' ดาว'); st.textContent = e.rating ? '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating) : '';
      head.append(n, st);
      const meta = document.createElement('p'); meta.className = 'mt-1 text-xs text-sand-200/50';
      const pl = A.find(a => a.id === e.place);
      meta.textContent = [pl ? 'ประทับใจ: ' + pl.name : null, new Date(e.at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })].filter(Boolean).join(' · ');
      const p = document.createElement('p'); p.className = 'mt-3 whitespace-pre-wrap break-words text-sand-200/90'; p.textContent = e.message;
      li.append(head, meta, p); gbList.appendChild(li);
    });
    const real = entries.filter(e => e.rating);
    $('#gbTotal').textContent = `${entries.length} ข้อความจากผู้มาเยือน`;
    $('#gbAvg').textContent = real.length ? `คะแนนเฉลี่ย ${(real.reduce((s, e) => s + e.rating, 0) / real.length).toFixed(1)} / 5` : '';
  }
  $('#gbForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget, err = $('#gbErr'); err.textContent = '';
    if (f.website.value) return; // honeypot
    const name = f.name.value.trim(), message = f.message.value.trim();
    if (!name) { err.textContent = 'กรุณาใส่ชื่อ'; f.name.focus(); return; }
    if (message.length < 3) { err.textContent = 'ข้อความสั้นเกินไป'; msg.focus(); return; }
    const entry = { name, message, rating, place: f.place.value };
    const btn = $('button[type=submit]', f); btn.disabled = true;
    try {
      if (mode === 'server') {
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'บันทึกไม่สำเร็จ');
        entries.unshift(j);
      } else {
        entries.unshift({ ...entry, id: 'l' + Date.now(), at: new Date().toISOString() }); writeLocal(entries);
      }
      f.reset(); rating = 0; paint(); $('#gbCount').textContent = '0/500'; draw();
    } catch (e) { err.textContent = e.message || 'เกิดข้อผิดพลาด'; }
    btn.disabled = false;
  });
  load();
})();
