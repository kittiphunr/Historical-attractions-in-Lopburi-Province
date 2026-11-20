(function () {
  const T = window.T || ((s, ...v) => v.reduce((r, x, i) => r.replace('{' + i + '}', x), s));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = window.ATTRACTIONS, S = window.SOURCES, SRC = Object.fromEntries(S.map(s => [s.id, s]));
  const ERA = { all: 'ทั้งหมด', dvaravati: 'ทวารวดี', khmer: 'ขอม', ayutthaya: 'อยุธยา–พระนารายณ์', faith: 'ภูเขา–ศรัทธา' };
  const ERA_COLOR = { dvaravati: 'bg-sky-500/15 text-sky-700', khmer: 'bg-terra-500/10 text-terra-600', ayutthaya: 'bg-amber-500/15 text-amber-700', faith: 'bg-emerald-600/15 text-emerald-700' };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- ไอคอน (inline SVG เส้น) ---------- */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    landmark: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 000-6H9a3 3 0 010-6h7"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M9 7h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    cube: '<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9zM12 12l8-4.500M12 12v9M12 12L4 7.500"/>',
    prang: '<path d="M16 3l3 8h-6zM11 12h10l2 6H9zM8 19h16l2 8H6z" fill="currentColor" stroke="none" transform="scale(.75)"/>'
  };
  const svg = (name, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  $$('i[data-i]').forEach(i => { i.outerHTML = svg(i.dataset.i, i.className); });

  /* ---------- บาร์โค้ดบนตั๋ว: รหัสจังหวัดลพบุรี (ISO 3166-2:TH-16) ---------- */
  if (window.renderBarcode && $('#ticketBarcode')) { window.renderBarcode($('#ticketBarcode'), 'TH-16'); if (window.Motion) window.Motion.barcode($('#ticketBarcode')); }


  /* ---------- โหมดกลางวัน / กลางคืน ---------- */
  const THEME_KEY = 'lopburi.theme';
  const isDark = () => document.documentElement.classList.contains('dark');
  function paintThemeLabel(mode) { const btn = $('#themeBtn'); if (!btn) return; btn.setAttribute('aria-pressed', mode === 'dark'); btn.setAttribute('aria-label', T(mode === 'dark' ? 'สลับเป็นโหมดกลางวัน' : 'สลับเป็นโหมดกลางคืน')); }
  function applyTheme(mode, persist) {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = mode === 'dark' ? '#1e1814' : '#f4ece2';
    paintThemeLabel(mode);
    if (window.LopburiGL && window.LopburiGL.setNight) window.LopburiGL.setNight(mode === 'dark');
    const mv = document.querySelector('#arStage model-viewer'); if (mv) mv.setAttribute('exposure', mode === 'dark' ? '0.75' : '1');
    if (persist) { try { localStorage.setItem(THEME_KEY, mode); } catch (e) { /* โหมดส่วนตัว */ } }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode } }));
  }
  $('#themeBtn').addEventListener('click', () => { const toDark = !isDark(); applyTheme(toDark ? 'dark' : 'light', true); if (window.Motion) window.Motion.themeBurst($('#themeBtn'), toDark); });
  // ตามการตั้งค่าระบบ ถ้าผู้ใช้ยังไม่เคยเลือกเอง
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { let saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (err) { /* ไม่มี storage */ } if (!saved) applyTheme(e.matches ? 'dark' : 'light', false); });

  /* ---------- ทักทายตามเวลา ---------- */
  (function () { const h = new Date().getHours(); $('#hello').textContent = h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'; })();

  /* ---------- สภาพอากาศ (Open-Meteo, ดึงสดในเบราว์เซอร์) ---------- */
  const WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=14.7995&longitude=100.6534'
    + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day'
    + '&hourly=temperature_2m,weather_code,precipitation_probability&timezone=Asia%2FBangkok&forecast_days=2&wind_speed_unit=kmh';
  const WX_TXT = (c) => c === 0 ? 'ท้องฟ้าแจ่มใส' : c === 1 ? 'แจ่มใสเป็นส่วนใหญ่' : c === 2 ? 'มีเมฆบางส่วน' : c === 3 ? 'เมฆมาก' : c <= 48 ? 'มีหมอก' : c <= 57 ? 'ฝนละออง' : c <= 67 ? 'ฝนตก' : c <= 77 ? 'หิมะ/น้ำแข็ง' : c <= 82 ? 'ฝนตกเป็นช่วง' : c <= 86 ? 'ฝนหิมะ' : 'พายุฝนฟ้าคะนอง';
  const SUN = '<circle cx="32" cy="32" r="11" fill="currentColor" stroke="none"/><g stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.600 13.600l5.700 5.700M44.700 44.700l5.700 5.700M13.600 50.400l5.700-5.700M44.700 19.300l5.700-5.700"/></g>';
  const MOON = '<path d="M44 40A18 18 0 0124 14a18 18 0 1020 26z" fill="currentColor" stroke="none"/>';
  const CLOUD = '<path d="M18 46a10 10 0 01-1-20 14 14 0 0127 3 8.500 8.500 0 01-1 17z" fill="#e8e1d9" stroke="none"/>';
  const wxSvg = (code, day = true, cls = '') => {
    let inner;
    if (code === 0 || code === 1) inner = day ? SUN : MOON;
    else if (code === 2) inner = (day ? '<g transform="translate(-6 -8) scale(.75)" style="color:#fcd34d">' + SUN + '</g>' : '<g transform="translate(-4 -6) scale(.8)" style="color:#fcd34d">' + MOON + '</g>') + '<g transform="translate(4 4) scale(.9)">' + CLOUD + '</g>';
    else if (code === 3) inner = CLOUD;
    else if (code <= 48) inner = CLOUD + '<g stroke="#e8e1d9" stroke-width="3" stroke-linecap="round"><path d="M14 52h36M20 58h28"/></g>';
    else if (code <= 82) inner = CLOUD + '<g stroke="#7dc4ec" stroke-width="3.500" stroke-linecap="round"><path d="M22 52l-3 7M33 52l-3 7M44 52l-3 7"/></g>';
    else inner = CLOUD + '<path d="M34 46l-6 9h6l-3 8 10-12h-6l3-5z" fill="#fcd34d" stroke="none"/>';
    return `<svg viewBox="0 0 64 64" class="${cls}" fill="none" aria-hidden="true">${inner}</svg>`;
  };
  async function loadWeather() {
    const err = $('#wxErr'); err.classList.add('hidden');
    try {
      const r = await fetch(WX_URL, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
      const d = await r.json(), c = d.current, h = d.hourly;
      $('#wxTemp').textContent = Math.round(c.temperature_2m);
      $('#wxDesc').textContent = WX_TXT(c.weather_code);
      $('#wxIcon').innerHTML = wxSvg(c.weather_code, !!c.is_day, 'h-full w-full');
      if (window.Motion && c.weather_code <= 1 && c.is_day) window.Motion.spin($('#wxIcon svg g'), 24000);
      $('#wxHum').textContent = Math.round(c.relative_humidity_2m) + '%';
      $('#wxWind').textContent = Math.round(c.wind_speed_10m) + ' กม./ชม.';
      // หาชั่วโมงปัจจุบันในอาร์เรย์ hourly (เวลาเป็น Asia/Bangkok ตรงกับ c.time)
      const hourKey = c.time.slice(0, 13); let i0 = h.time.findIndex(t => t.slice(0, 13) === hourKey); if (i0 < 0) i0 = 0;
      $('#wxRain').textContent = (h.precipitation_probability[i0] ?? '--') + '%';
      $('#wxUpdated').textContent = 'อัปเดต ' + c.time.slice(11, 16) + ' น.';
      $('#wxHours').innerHTML = [0, 3, 6, 9, 12].map((o, k) => {
        const i = Math.min(i0 + o, h.time.length - 1), hh = +h.time[i].slice(11, 13), day = hh >= 6 && hh < 18;
        return `<li class="grid justify-items-center gap-1"><span>${k === 0 ? 'ตอนนี้' : String(hh).padStart(2, '0') + ':00'}</span>${wxSvg(h.weather_code[i], day, 'h-8 w-8 ' + (day ? 'text-amber-300' : 'text-amber-200'))}<b class="font-medium text-white">${Math.round(h.temperature_2m[i])}°</b></li>`;
      }).join('');
    } catch (e) {
      $('#wxDesc').textContent = 'โหลดสภาพอากาศไม่ได้';
      err.innerHTML = 'ไม่สามารถเชื่อมต่อ Open-Meteo ได้ในขณะนี้ <button type="button" class="underline" id="wxRetry">ลองอีกครั้ง</button>'; err.classList.remove('hidden');
      $('#wxRetry').addEventListener('click', loadWeather);
    }
  }
  loadWeather(); setInterval(loadWeather, 15 * 60 * 1000);

  /* ---------- เมนู: ไฮไลต์ตามส่วนที่กำลังดู ---------- */
  const secMap = { top: 'top', story: 'top', map: 'map', map3d: 'map', places: 'places', route: 'route', guestbook: 'guestbook', credits: 'credits' };
  const setActive = (id) => $$('[data-sec]').forEach(a => { const on = a.dataset.sec === (secMap[id] || id); on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); if (a.closest('nav[aria-label*=มือถือ]')) a.classList.toggle('text-terra-600', on); });
  const spy = new IntersectionObserver((es) => es.forEach(e => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-35% 0px -55% 0px' });
  $$('main > section[id]').forEach(s => spy.observe(s)); setActive('top');

  /* ---------- โมเดล 3 มิติ: Three.js เป็นหลัก / CSS 3D เป็นตัวสำรอง ---------- */
  // สร้างตัวเรนเดอร์ WebGL ตอนผู้ใช้กดเปิดโมเดลครั้งแรกเท่านั้น (หน้าแรกจึงเบา: โหลดแค่ภาพปก)
  let GL = null, glTried = false;
  function ensureGL() {
    if (!glTried) {
      glTried = true;
      GL = window.LopburiGL && window.LopburiGL.init() ? window.LopburiGL : null;
      if (GL) { GL.setNight(isDark()); GL.onFail(() => location.reload()); }
    }
    return GL;
  }
  /* ภาพปก (poster) ก่อน แล้วกดเพื่อโหลด 3 มิติ — ภาพสร้างด้วย npm run posters (assets/poster/<id>-day|night.webp) */
  const ACTIVE3D = new Set();
  function mountLazy(host, key, label, type, size, opts = {}) {
    const go = () => {
      ACTIVE3D.add(key); ensureGL();
      mountModel(host, type, size, opts);
      host.dataset.active = '1';
      if (host.hasAttribute('aria-label')) host.setAttribute('role', 'img');
      const hint = host.parentElement && host.parentElement.querySelector('[data-hint]'); if (hint) hint.classList.remove('hidden');
      const p = host.querySelector('.poster'); if (!p) return;
      const done = () => { p.classList.add('opacity-0'); setTimeout(() => p.remove(), 450); };
      if (host.dataset.glb === 'loading') {
        p.disabled = true; p.dataset.busy = '1'; p.querySelector('[data-pl]').textContent = T('กำลังโหลดโมเดล…');
        const mo = new MutationObserver(() => { if (host.dataset.glb !== 'loading') { mo.disconnect(); done(); } }); mo.observe(host, { attributes: true, attributeFilter: ['data-glb'] });
      } else done();
    };
    if (ACTIVE3D.has(key)) { go(); return; }
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'poster group absolute inset-0 z-10 block h-full w-full overflow-hidden transition-opacity duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-terra-500';
    b.setAttribute('aria-label', 'เปิดโมเดล 3 มิติ: ' + label);
    const img = (m) => `<img src="assets/poster/${key}-${m}.webp" alt="" loading="lazy" decoding="async" draggable="false" class="poster-img poster-${m} absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]" onerror="this.remove()">`;
    b.innerHTML = `${img('day')}${img('night')}<span class="pointer-events-none absolute inset-x-0 bottom-3 grid justify-items-center"><span class="btn-terra !px-4 !py-2 text-sm">${svg('cube', 'h-4 w-4')}<span data-pl>แตะเพื่อดู 3 มิติ</span></span></span>`;
    b.addEventListener('click', go, { once: true });
    host.appendChild(b);
  }
  function mountModel(host, type, size, opts = {}) {
    if (opts.glb) host.addEventListener('glbfail', () => host.insertAdjacentHTML('afterend', `<p class="relative z-10 px-4 pb-2 text-center text-[11px] text-terra-600">กำลังแสดงโมเดลจำลองแทน เพราะโหลดไฟล์ .glb ไม่สำเร็จ${location.protocol === 'file:' ? ' (เปิดแบบ file://) — เปิดผ่านเซิร์ฟเวอร์ด้วย npm start' : ''}</p>`), { once: true });
    if (GL && GL.addView(host, type, opts)) return 'webgl';
    const m = window.Lopburi3D.createModel(type, size);
    host.appendChild(m.root);
    window.Lopburi3D.interactive(host, m.stage, { speed: 0.1, ry: -28 + (opts.shift || 0) });
    return 'css';
  }
  const heroHost = $('#heroModel');
  mountLazy(heroHost, 'hero', 'พระปรางค์สามยอด', 'triprang', 520, { speed: 0.0042, glb: A.find(x => x.id === 'sam-yot').glb.url });
  if (window.Motion) { window.Motion.countOnView($('#srcCount'), S.length, { suffix: '+' }); $$('[data-count]').forEach(el => window.Motion.countOnView(el, +el.dataset.count)); window.Motion.float($('#bannerSeal')); } else $('#srcCount').textContent = S.length + '+';


  /* ---------- AR / ดู 3 มิติเต็มจอ (model-viewer โหลดตอนกดเท่านั้น ~1 MB) ---------- */
  const arDlg = $('#arDialog'); let arBlobUrl = null, arReturnFocus = null, arLoading = null;
  const arStatus = (t) => { $('#arStatus').textContent = t; };
  function ensureAR() {
    if (window.__lopburiARReady) return Promise.resolve();
    return arLoading || (arLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'assets/js/ar.js'; s.onload = res; s.onerror = () => { arLoading = null; rej(new Error('โหลดตัวแสดง AR ไม่สำเร็จ')); }; document.head.appendChild(s);
    }));
  }
  function arCleanup() { $('#arStage').replaceChildren(); if (arBlobUrl) { URL.revokeObjectURL(arBlobUrl); arBlobUrl = null; } $('#arHelp').classList.add('hidden'); }
  async function openAR(id, trigger) {
    const a = id === 'province' ? { name: 'แผนที่ 3 มิติทั้งจังหวัด', glb: { ar: window.PROVINCE_MODEL.ar } } : A.find(x => x.id === id); if (!a) return;
    arReturnFocus = trigger || null; arCleanup();
    $('#arTitle').textContent = a.name + ' — 3 มิติ / AR'; arStatus('กำลังเตรียมโมเดล…');
    arDlg.showModal(); if (window.Motion) window.Motion.dialogIn(arDlg);
    try {
      await ensureAR();
      let src, isBlob = false;
      if (a.glb && a.glb.ar && location.protocol === 'file:') throw new Error('เปิดผ่านเซิร์ฟเวอร์ (npm start) หรือเว็บ HTTPS เพื่อดูไฟล์ AR นี้');
      if (a.glb && a.glb.ar) src = a.glb.ar;                      // ไฟล์ .glb ที่ทำไว้สำหรับ AR
      else { const blob = await window.LopburiGL.exportGLB(a.model); arBlobUrl = src = URL.createObjectURL(blob); isBlob = true; } // โมเดลที่สร้างด้วยโค้ด: ส่งออกขนาดจริง ~40 ซม.
      const mv = document.createElement('model-viewer');
      Object.entries({ src, alt: `โมเดล 3 มิติ ${a.name}`, ar: '', 'ar-modes': isBlob ? 'webxr quick-look' : 'webxr scene-viewer quick-look', 'ar-scale': 'auto', 'ar-placement': 'floor',
        'camera-controls': '', 'auto-rotate': '', 'shadow-intensity': '1', 'shadow-softness': '0.9', 'touch-action': 'pan-y', 'interaction-prompt': 'auto' }).forEach(([k, v]) => mv.setAttribute(k, v));
      mv.className = 'h-full w-full'; mv.style.background = 'transparent'; mv.setAttribute('exposure', isDark() ? '0.75' : '1');
      const btn = document.createElement('button'); btn.slot = 'ar-button'; btn.type = 'button'; btn.className = 'btn-terra absolute bottom-4 left-1/2 -translate-x-1/2';
      btn.innerHTML = svg('cube', 'h-5 w-5') + 'ดูใน AR (วางบนโต๊ะ)'; mv.append(btn);
      mv.addEventListener('load', () => setTimeout(() => {
        if (mv.canActivateAR) arStatus('แตะ “ดูใน AR” เพื่อวางโมเดลบนโต๊ะหรือพื้นจริง · ลากเพื่อหมุน ใช้สองนิ้วซูม');
        else {
          arStatus('ลากเพื่อหมุน ใช้สองนิ้วซูม');
          const help = $('#arHelp'); help.classList.remove('hidden');
          help.textContent = (window.isSecureContext ? '' : 'หน้านี้ไม่ได้เปิดผ่าน HTTPS จึงใช้ AR ไม่ได้ · ') + 'อุปกรณ์หรือเบราว์เซอร์นี้ยังเปิด AR ไม่ได้ — AR ใช้ได้บน Android (Chrome พร้อม Google Play Services for AR) และ iPhone/iPad (Safari) ลองเปิดหน้านี้จากมือถือ';
        }
      }, 400));
      mv.addEventListener('error', () => arStatus('แสดงโมเดลไม่สำเร็จ ลองใหม่อีกครั้ง'));
      $('#arStage').append(mv);
    } catch (e) { arStatus('เปิดโมเดลไม่สำเร็จ: ' + (e.message || e)); }
  }
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-ar]'); if (t) openAR(t.dataset.ar, t); });
  $('#arClose').addEventListener('click', () => arDlg.close());
  arDlg.addEventListener('click', (e) => { if (e.target === arDlg) arDlg.close(); });
  arDlg.addEventListener('close', () => { arCleanup(); if (arReturnFocus) arReturnFocus.focus(); });


  /* ---------- แผนที่ 3 มิติทั้งจังหวัด (โหลดเมื่อเลื่อนใกล้ถึง) ---------- */
  (function initMap3D() {
    const host = $('#mapViewer'), P = window.PROVINCE_MODEL; if (!host || !P) return;
    const places = P.hotspots.map(h => ({ ...h, a: A.find(x => x.id === h.id) })).filter(h => h.a);
    host.insertAdjacentHTML('beforeend', `
      <div id="mvLoading" data-map-ui style="display:none" class="absolute inset-0 z-20 grid place-items-center bg-cream-100/80 px-6 text-center text-sm text-ink-500"><div><div id="mvSpin" class="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-terra-400/30 border-t-terra-500"></div><p id="mvLoadTxt">กำลังโหลดโมเดลแผนที่ (ราว 2.5 MB)…</p></div></div>
      <div id="mvMarkers" class="pointer-events-none absolute inset-0 z-10 overflow-hidden"></div>
      <div data-map-ui class="absolute right-3 top-[76px] z-20 flex flex-col gap-2">
        <button type="button" data-mv="in" class="neu grid h-10 w-10 place-items-center text-xl text-ink-700" aria-label="ซูมเข้า">+</button>
        <button type="button" data-mv="out" class="neu grid h-10 w-10 place-items-center text-xl text-ink-700" aria-label="ซูมออก">−</button>
        <button type="button" data-mv="reset" class="neu grid h-10 w-10 place-items-center text-ink-700" aria-label="รีเซ็ตมุมมอง">${svg('home', 'h-5 w-5')}</button>
        <button type="button" data-ar="province" class="neu grid h-10 w-10 place-items-center text-terra-600" aria-label="ดูแผนที่แบบ AR" title="ดูแบบ AR">${svg('cube', 'h-5 w-5')}</button>
      </div>
      <div id="mvInfo" data-map-ui class="card absolute inset-x-3 bottom-3 z-20 hidden max-w-md p-4 sm:left-4 sm:right-auto" role="status"></div>`);
    $('#mvChips').innerHTML = places.map(h => `<button type="button" class="chip inline-flex items-center gap-2" data-mvsel="${h.id}"><b class="grid h-6 w-6 place-items-center rounded-full bg-terra-500 text-[11px] text-white">${h.a.no}</b>${esc(h.a.name)}</button>`).join('');
    const layer = $('#mvMarkers');
    places.forEach(h => {
      const w = document.createElement('div'); w.className = 'absolute left-0 top-0 will-change-transform'; w.style.visibility = 'hidden';
      w.innerHTML = `<button type="button" data-map-ui data-mvsel="${h.id}" class="pointer-events-auto group relative -translate-x-1/2 -translate-y-full outline-offset-4" aria-label="${esc(h.a.name)}">
        <span class="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-terra-500 text-xs font-semibold text-white shadow-dark transition group-hover:scale-110">${h.a.no}</span>
        <span class="mx-auto block h-2 w-0.5 bg-terra-500"></span>
        <span class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-char-800 px-2.5 py-1 text-xs text-snow-50 shadow-dark group-hover:block">${esc(h.a.name)}</span></button>`;
      layer.appendChild(w); h.el = w; h.btn = w.firstElementChild;
    });
    let viewer = null, started = false;
    host.dataset.state = 'poster';
    (function poster() {
      const img = (m) => `<img src="assets/poster/map-${m}.webp" alt="" loading="lazy" decoding="async" draggable="false" class="poster-img poster-${m} absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]" onerror="this.remove()">`;
      const b = document.createElement('button'); b.type = 'button'; b.id = 'mvPoster';
      b.className = 'poster group absolute inset-0 z-[15] block h-full w-full overflow-hidden transition-opacity duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-terra-500';
      b.setAttribute('aria-label', 'เปิดแผนที่ 3 มิติทั้งจังหวัด');
      b.innerHTML = `${img('day')}${img('night')}<span class="pointer-events-none absolute inset-x-0 bottom-5 grid justify-items-center"><span class="btn-terra">${svg('cube', 'h-5 w-5')}แตะเพื่อดูแผนที่ 3 มิติ</span></span>`;
      b.addEventListener('click', () => start());
      host.appendChild(b);
    })();
    const info = $('#mvInfo');
    function showInfo(id) {
      places.forEach(h => { const on = h.id === id, dot = h.btn.firstElementChild; dot.classList.toggle('scale-125', on); dot.classList.toggle('bg-char-800', on); dot.classList.toggle('bg-terra-500', !on); h.btn.setAttribute('aria-pressed', on); });
      $$('[data-mvsel]', $('#mvChips')).forEach(b => b.setAttribute('aria-pressed', b.dataset.mvsel === id));
      const h = places.find(x => x.id === id);
      if (!h) { info.classList.add('hidden'); return; }
      info.innerHTML = `<div class="flex items-start gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style="background:linear-gradient(145deg,#dc6f45,#a8431f)">${h.a.no}</span>
        <div class="min-w-0 flex-1"><b class="block text-ink-900">${esc(h.a.name)}</b><span class="block text-xs text-terra-600">${esc(h.a.eraLabel)}</span><p class="mt-1 text-xs leading-relaxed text-ink-500">${esc(h.a.tagline)}</p></div>
        <button type="button" data-mv="close" class="text-ink-400 hover:text-ink-900" aria-label="ปิดการ์ด">✕</button></div>
        <div class="mt-3 flex flex-wrap gap-2"><a href="#${h.id}" class="btn-terra !px-4 !py-2 text-sm">อ่านรายละเอียด</a><button type="button" data-ar="${h.id}" class="btn-soft !px-4 !py-2 text-sm">${svg('cube', 'h-4 w-4 text-terra-500')}ดูโมเดลอาคาร AR</button></div>`;
      info.classList.remove('hidden'); if (window.Motion) window.Motion.slideUp(info);
    }
    host.addEventListener('click', (e) => {
      const t = e.target.closest('[data-mv]'); if (!t || !viewer) return;
      const act = { in: () => viewer.zoom(1.3), out: () => viewer.zoom(0.77), reset: () => viewer.reset(), close: () => viewer.reset() }[t.dataset.mv];
      if (act) act();
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-mvsel]'); if (!t) return;
      if (!viewer) start();
      if (viewer) { const id = t.dataset.mvsel; Promise.resolve(viewer.ready).then(() => viewer.select(id)).catch(() => {}); host.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    function start() {
      if (started) return; started = true;
      host.dataset.state = 'loading'; $('#mvLoading').style.display = '';
      viewer = (window.LopburiGL && window.LopburiGL.createMapViewer(host, { url: P.url, hotspots: places.map(h => ({ id: h.id, x: h.x, z: h.z, el: h.el })) })) || null;
      if (!viewer) { const pp = $('#mvPoster'); if (pp) pp.remove(); host.dataset.state = 'live'; $('#mvLoadTxt').textContent = 'อุปกรณ์นี้แสดง 3 มิติแบบ WebGL ไม่ได้ ใช้แผนที่ภาพด้านบนแทน'; $('#mvSpin').style.display = 'none'; $('#mvMarkers').style.display = 'none'; return; }
      viewer.onSelect(showInfo);
      viewer.onProgress = (f) => { $('#mvLoadTxt').textContent = `กำลังโหลดโมเดลแผนที่… ${Math.round(f * 100)}%`; };
      viewer.ready.then(() => { $('#mvLoading').style.display = 'none'; host.dataset.ready = '1'; host.dataset.state = 'live'; const p = $('#mvPoster'); if (p) { p.classList.add('opacity-0'); p.disabled = true; setTimeout(() => p.remove(), 450); } if (window.Motion) window.Motion.pop($$('#mvMarkers [data-mvsel] > span:first-child'), { delay: 110 }); }).catch((e) => { const pp = $('#mvPoster'); if (pp) pp.remove(); host.dataset.state = 'live'; console.warn('โหลดโมเดลแผนที่ไม่สำเร็จ', e); $('#mvSpin').style.display = 'none'; $('#mvLoadTxt').textContent = 'โหลดโมเดลแผนที่ไม่สำเร็จ ' + (location.protocol === 'file:' ? '(เปิดแบบ file:// — เปิดผ่านเซิร์ฟเวอร์ด้วย npm start)' : 'ลองรีเฟรชหน้า'); });
    }
  })();

  /* ---------- timeline ---------- */
  $('#timeline').innerHTML = window.TIMELINE.map((t, i) => `
    <li class="reveal card p-6" style="transition-delay:${i * 70}ms">
      <p class="text-4xl font-semibold text-terra-500/30">${String(i + 1).padStart(2, '0')}</p>
      <h3 class="mt-2 text-xl font-semibold">${esc(t.era)}</h3>
      <p class="mt-1 text-xs font-medium tracking-wide text-terra-500">${esc(t.when)}</p>
      <p class="mt-3 text-sm leading-relaxed text-ink-500">${esc(t.text)}</p>
      <a class="mt-4 inline-block text-xs text-terra-600 underline-offset-4 hover:underline" href="${esc(SRC[t.src].url)}" target="_blank" rel="noopener noreferrer">ที่มา: ${esc(SRC[t.src].name.split(' — ')[0])} ↗</a>
    </li>`).join('');

  /* ---------- Top list ---------- */
  $('#topList').innerHTML = ['sam-yot', 'narai-palace', 'khao-wong'].map(id => A.find(a => a.id === id)).map(a => `
    <li><a href="#${a.id}" class="neu flex items-center gap-4 p-3 hover:-translate-y-0.5">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white" style="background:linear-gradient(145deg,#dc6f45,#a8431f)">${a.no}</span>
      <span class="min-w-0 flex-1"><b class="block truncate font-medium text-ink-900">${esc(a.name)}</b><span class="block truncate text-xs text-ink-500">${esc(a.eraLabel)}</span></span>
      ${svg('arrow', 'h-5 w-5 text-terra-500')}</a></li>`).join('');

  /* ---------- map hotspots ---------- */
  const mapWrap = $('#mapWrap');
  A.filter(a => a.map).forEach(a => {
    const b = document.createElement('a');
    b.href = '#' + a.id; b.className = 'group absolute -translate-y-1/2 -translate-x-[calc(100%+6px)]';
    b.style.left = a.map[0] + '%'; b.style.top = a.map[1] + '%';
    b.setAttribute('aria-label', `${a.name} — ดูรายละเอียด`);
    b.innerHTML = `<span class="absolute inset-0 -m-1 animate-ping rounded-full bg-terra-400/40 sm:-m-2"></span>
      <span class="absolute -inset-2" aria-hidden="true"></span><span class="relative grid h-5 w-5 place-items-center rounded-full border border-white bg-terra-500 text-[9px] font-semibold text-white shadow-dark transition group-hover:scale-125 sm:h-9 sm:w-9 sm:border-2 sm:text-sm">${a.no}</span>
      <span class="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-char-800 px-3 py-1.5 text-xs text-snow-50 opacity-0 shadow-dark transition group-hover:opacity-100 group-focus-visible:opacity-100">${esc(a.name)}</span>`;
    mapWrap.appendChild(b);
  });

  /* ---------- places ---------- */
  const list = $('#placeList');
  function photoBlock(a) {
    if (a.photo) {
      const p = a.photo;
      return `<figure class="overflow-hidden rounded-2xl shadow-neu"><img src="${esc(p.src)}" alt="${esc(p.alt || a.name)}" loading="lazy" class="w-full object-cover">
        <figcaption class="bg-cream-50 px-4 py-2 text-xs text-ink-500">ภาพ: ${esc(p.author)} · ${p.licenseUrl ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(p.licenseUrl)}">${esc(p.license)}</a>` : esc(p.license)} · <a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(p.sourceUrl)}">ต้นฉบับ ↗</a></figcaption></figure>`;
    }
    return `<div class="rounded-2xl bg-cream-100 px-4 py-5 text-center text-xs text-ink-500 shadow-press"><p>ช่องภาพถ่ายจริง · ยังไม่ได้ใส่ภาพ</p><p class="mt-1 text-ink-400">ภาพที่ใส่ต้องมีผู้ถ่าย สัญญาอนุญาต และลิงก์ต้นทางใต้ภาพ</p></div>`;
  }
  function videoBlock(a) {
    const v = a.video;
    if (v.id) {
      return `<div class="overflow-hidden rounded-2xl shadow-neu"><div class="aspect-video"><iframe class="h-full w-full" loading="lazy" src="https://www.youtube-nocookie.com/embed/${esc(v.id)}" title="${esc(v.title || a.name)}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <p class="bg-cream-50 px-4 py-2 text-xs text-ink-500">วิดีโอ: ${esc(v.title || '')} · ช่อง ${esc(v.channel || '')} · <a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(v.url)}">ดูบน YouTube ↗</a></p></div>`;
    }
    return `<a class="btn-soft w-full !py-3 text-sm" target="_blank" rel="noopener noreferrer" href="${esc(v.search)}"><svg viewBox="0 0 24 24" class="h-5 w-5 fill-terra-500" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>ค้นวิดีโอแนะนำบน YouTube</a>
      <p class="mt-2 text-center text-[11px] text-ink-400">เปิดผลค้นหา “${esc(v.query)}” — วิดีโอทุกคลิปเป็นสิทธิ์ของเจ้าของช่อง ดูชื่อช่องในหน้าวิดีโอ</p>`;
  }
  const bullets = (arr, dot = 'bg-terra-400') => `<ul class="space-y-3">${arr.map(t => `<li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}"></span><span>${esc(t)}</span></li>`).join('')}</ul>`;
  const paras = (arr) => arr.map(t => `<p>${esc(t)}</p>`).join('');

  function render(filter = 'all') {
    list.innerHTML = '';
    const items = A.filter(a => filter === 'all' || a.era === filter);
    $('#emptyMsg').classList.toggle('hidden', items.length > 0);
    items.forEach((a, idx) => {
      const flip = idx % 2 === 1;
      const el = document.createElement('article');
      el.id = a.id; el.className = 'reveal card scroll-mt-6 p-4 sm:p-6 lg:p-8';
      el.innerHTML = `
        <div class="grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          <div class="${flip ? 'lg:order-2' : ''} lg:col-span-5 lg:sticky lg:top-6">
            <div class="stage-bg relative overflow-hidden rounded-3xl shadow-press">
              <span class="absolute left-5 top-3 z-10 text-6xl font-semibold text-terra-500/20">${a.no}</span>
              <div class="model relative h-[320px] sm:h-[380px]" aria-label="โมเดล 3 มิติจำลอง ${esc(a.name)} ลากเพื่อหมุน"></div>
              <p class="relative pt-1 text-center text-[11px] text-ink-500"><span data-hint class="hidden">↻ ลาก / ปุ่มลูกศร เพื่อหมุน · ดับเบิลคลิกรีเซ็ต</span>${a.glb ? `<span class="block">${esc(a.glb.credit)}</span>` : ''}</p>
              <div class="relative flex justify-center pb-3 pt-2"><button type="button" data-ar="${a.id}" class="btn-soft !px-4 !py-2 text-sm">${svg('cube', 'h-4 w-4 text-terra-500')}ดูแบบ AR</button></div>
            </div>
            <div class="mt-5 space-y-4">${photoBlock(a)}${videoBlock(a)}</div>
          </div>
          <div class="${flip ? 'lg:order-1' : ''} lg:col-span-7">
            <span class="inline-block rounded-full px-3 py-1 text-xs font-medium ${ERA_COLOR[a.era]}">${esc(a.eraLabel)}</span>
            <h3 class="mt-4 text-4xl font-semibold sm:text-5xl">${esc(a.name)}</h3>
            <p class="mt-1 text-sm tracking-widest text-terra-500">${esc(a.en)}</p>
            <p class="mt-5 text-xl font-medium leading-snug text-ink-900">${esc(a.tagline)}</p>
            <p class="mt-3 leading-relaxed text-ink-500">${esc(a.summary)}</p>
            <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              ${a.facts.map(([k, v]) => `<div class="neu p-3"><dt class="text-[11px] uppercase tracking-wider text-terra-500">${esc(k)}</dt><dd class="mt-1 text-sm font-medium text-ink-900">${esc(v)}</dd></div>`).join('')}
            </dl>
            <div class="mt-8" data-tabs>
              <div role="tablist" class="flex flex-wrap gap-2">
                ${[['history', 'ประวัติศาสตร์'], ['arch', 'สถาปัตยกรรม'], ['hi', 'ไฮไลต์'], ['visit', 'เตรียมตัวไป']].map(([k, l], i) =>
                  `<button role="tab" id="${a.id}-t-${k}" aria-controls="${a.id}-p-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" class="chip aria-selected:bg-terra-500 aria-selected:text-white aria-selected:shadow-press">${l}</button>`).join('')}
              </div>
              <div class="mt-5 min-h-[160px] leading-relaxed text-ink-700">
                <div role="tabpanel" id="${a.id}-p-history" aria-labelledby="${a.id}-t-history" class="space-y-4">${paras(a.history)}</div>
                <div role="tabpanel" id="${a.id}-p-arch" aria-labelledby="${a.id}-t-arch" class="hidden space-y-4">${paras(a.architecture)}</div>
                <div role="tabpanel" id="${a.id}-p-hi" aria-labelledby="${a.id}-t-hi" class="hidden">${bullets(a.highlights)}</div>
                <div role="tabpanel" id="${a.id}-p-visit" aria-labelledby="${a.id}-t-visit" class="hidden">${bullets(a.visit, 'bg-amber-500')}</div>
              </div>
            </div>
            <div class="mt-8 border-t border-cream-200 pt-5">
              <p class="mb-2 text-xs uppercase tracking-wider text-terra-500">แหล่งอ้างอิง</p>
              <div class="flex flex-wrap gap-2">${a.sources.map(id => `<a class="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-700 shadow-neu hover:text-terra-600" target="_blank" rel="noopener noreferrer" href="${esc(SRC[id].url)}" title="${esc(SRC[id].name)}">${esc(SRC[id].name.split(' — ')[0])} ↗</a>`).join('')}</div>
            </div>
          </div>
        </div>`;
      list.appendChild(el);
      mountLazy($('.model', el), a.id, a.name, a.model, 360, { az: 0.62 + idx * 0.35, shift: idx * 20, glb: a.glb && a.glb.url });
    });
    observeReveal();
  }
  list.addEventListener('click', (e) => {
    const t = e.target.closest('[role=tab]'); if (!t) return;
    $$('[role=tab]', t.closest('[data-tabs]')).forEach(b => { const on = b === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).classList.toggle('hidden', !on); });
    if (window.Motion) window.Motion.slideUp($('#' + t.getAttribute('aria-controls')));
  });
  list.addEventListener('keydown', (e) => {
    const t = e.target.closest('[role=tab]'); if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = $$('[role=tab]', t.closest('[data-tabs]')); const i = tabs.indexOf(t);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
  });
  const filters = $('#filters');
  Object.entries(ERA).forEach(([k, l]) => {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = l; b.setAttribute('aria-pressed', k === 'all');
    b.addEventListener('click', () => { $$('button', filters).forEach(x => x.setAttribute('aria-pressed', x === b)); render(k); });
    filters.appendChild(b);
  });

  /* ---------- route ---------- */
  $('#routeList').innerHTML = window.ROUTE.map(([n, id, note], i) => `
    <li class="reveal" style="transition-delay:${i * 50}ms"><a href="#${id}" class="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-semibold text-white" style="background:linear-gradient(145deg,#dc6f45,#a8431f)">${i + 1}</span>
      <span class="min-w-0"><b class="block font-medium text-ink-900">${esc(n)}</b><span class="block text-sm text-ink-500">${esc(note)}</span></span></a></li>`).join('');

  /* ---------- credits ---------- */
  $('#mediaTable').innerHTML = A.map(a => `<tr><td class="px-4 py-3 font-medium text-ink-900">${esc(a.name)}</td>
    <td class="px-4 py-3">${a.photo ? `<span class="text-emerald-700">มี · ${esc(a.photo.author)}</span>` : '<span class="text-ink-400">ยังไม่ได้ใส่</span>'}</td>
    <td class="px-4 py-3">${a.video.id ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(a.video.url)}">${esc(a.video.channel)}</a>` : `<a class="text-terra-600 underline" target="_blank" rel="noopener noreferrer" href="${esc(a.video.search)}">ลิงก์ค้นหา</a>`}</td></tr>`).join('');
  $('#srcTotal').textContent = S.length;
  $('#srcList').innerHTML = S.map(s => `<li><a class="block rounded-xl bg-cream-50 px-3 py-2 text-ink-700 shadow-neu hover:text-terra-600" target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.name)} <span class="text-terra-400">↗</span></a></li>`).join('');

  /* ---------- reveal ---------- */
  let io;
  function observeReveal() {
    if (window.Motion) { window.Motion.reveal($$('.reveal:not(.in)')); return; }
    io = io || new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .06, rootMargin: '0px 0px -40px' });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }
  render(); observeReveal();
  if (location.hash && $(location.hash)) setTimeout(() => $(location.hash).scrollIntoView(), 50);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', () => { const t = $(a.getAttribute('href')); if (t) t.classList.add('in'); }));

  /* ---------- guestbook ---------- */
  const CFG = window.LOPBURI_CONFIG || {};
  const API = CFG.guestbookApi || 'api/guestbook', LS = 'lopburi.guestbook.v1';
  let mode = 'local', entries = [], rating = 0;
  const gbList = $('#gbList');
  $('#gbPlace').innerHTML = '<option value="">— ภาพรวมทั้งจังหวัด —</option>' + A.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  const stars = $('#stars');
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.setAttribute('aria-label', i + ' ดาว'); b.textContent = '★'; b.className = 'text-ink-400/40 transition hover:scale-110';
    b.addEventListener('click', () => { rating = i; paint(); });
    stars.appendChild(b);
  }
  const paint = () => $$('button', stars).forEach((b, i) => { b.classList.toggle('text-amber-500', i < rating); b.classList.toggle('text-ink-400/40', i >= rating); b.setAttribute('aria-checked', i + 1 === rating); });
  const msg = $('#gbMsg'); msg.addEventListener('input', () => ($('#gbCount').textContent = msg.value.length + '/500'));
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } };
  const writeLocal = (v) => { try { localStorage.setItem(LS, JSON.stringify(v.slice(0, 200))); } catch { /* private mode */ } };
  const seed = [{ id: 'seed1', name: 'ทีมงานเว็บไซต์', rating: 5, place: 'sam-yot', message: 'ยินดีต้อนรับสู่สมุดเยี่ยม เขียนเล่าประสบการณ์ของคุณได้เลย เคล็ดลับเรื่องลิงและเวลาที่เหมาะกับการถ่ายภาพก็ช่วยผู้มาหลังได้มาก', at: '2026-11-20T00:00:00.000Z', seed: true }];

  async function load() {
    try {
      if (!CFG.guestbookApi && /\.github\.io$/i.test(location.hostname)) throw 0; // GitHub Pages ไม่มีเซิร์ฟเวอร์: ใช้โหมดเก็บในเบราว์เซอร์ทันที ไม่ต้องลองเรียก API
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw 0;
      entries = await r.json(); mode = 'server';
    } catch { entries = readLocal(); mode = 'local'; }
    $('#gbMode').textContent = mode === 'server' ? '● บันทึกร่วมกันทุกคน (เซิร์ฟเวอร์)' : '● โหมดออฟไลน์: บันทึกเฉพาะในเบราว์เซอร์นี้ (รัน node server.js เพื่อแชร์ร่วมกัน)';
    draw();
  }
  function draw() {
    gbList.innerHTML = '';
    [...entries, ...seed].forEach(e => {
      const li = document.createElement('li'); li.className = 'card p-5';
      const head = document.createElement('div'); head.className = 'flex flex-wrap items-center justify-between gap-2';
      const n = document.createElement('p'); n.className = 'text-lg font-medium text-ink-900'; n.textContent = e.name;
      const st = document.createElement('p'); st.className = 'text-amber-500'; st.setAttribute('aria-label', e.rating + ' ดาว'); st.textContent = e.rating ? '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating) : '';
      head.append(n, st);
      const meta = document.createElement('p'); meta.className = 'mt-1 text-xs text-ink-400';
      const pl = A.find(a => a.id === e.place);
      meta.textContent = [pl ? T('ประทับใจ:') + ' ' + T(pl.name) : null, new Date(e.at).toLocaleDateString(window.I18N ? I18N.locale : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' })].filter(Boolean).join(' · ');
      const p = document.createElement('p'); p.className = 'mt-3 whitespace-pre-wrap break-words text-ink-700'; p.textContent = e.message;
      li.append(head, meta, p); gbList.appendChild(li);
    });
    const real = entries.filter(e => e.rating);
    $('#gbTotal').textContent = `${entries.length} ข้อความจากผู้มาเยือน`;
    $('#gbAvg').textContent = real.length ? `คะแนนเฉลี่ย ${(real.reduce((s, e) => s + e.rating, 0) / real.length).toFixed(1)} / 5` : '';
  }
  $('#gbForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget, err = $('#gbErr'); err.textContent = '';
    if (f.website.value) return;
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
      } else { entries.unshift({ ...entry, id: 'l' + Date.now(), at: new Date().toISOString() }); writeLocal(entries); }
      f.reset(); rating = 0; paint(); $('#gbCount').textContent = '0/500'; draw(); if (window.Motion) window.Motion.enter(gbList.firstElementChild);
    } catch (e) { err.textContent = (e instanceof TypeError ? 'บันทึกไม่สำเร็จ' : e.message) || 'เกิดข้อผิดพลาด'; }
    btn.disabled = false;
  });
  load();

  /* ---------- หลายภาษา ---------- */
  window.addEventListener('langchange', () => { draw(); loadWeather(); paintThemeLabel(isDark() ? 'dark' : 'light'); });
  if (window.I18N) I18N.init();

  /* ---------- เคอร์เซอร์และลูกเล่นเมาส์ (anime.js) ---------- */
  if (window.Motion) { window.Motion.cursor(); window.Motion.ripples(); }
})();
