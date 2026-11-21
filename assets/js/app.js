(function () {
  const T = window.T || ((s, ...v) => v.reduce((r, x, i) => r.replace('{' + i + '}', x), s));
  const { $, $$, esc, svg } = window.LopburiUI;
  const PFX = document.documentElement.dataset.prefix || ''; // 'en/' ฯลฯ บนหน้าแยกตามภาษา (ลิงก์ภายในต้องอยู่ในภาษาเดียวกัน)
  const A = window.ATTRACTIONS, S = window.SOURCES, SRC = Object.fromEntries(S.map(s => [s.id, s]));
  const ERA = { all: 'ทั้งหมด', dvaravati: 'ทวารวดี', khmer: 'ขอม', ayutthaya: 'อยุธยา–พระนารายณ์', faith: 'ภูเขา–ศรัทธา', nature: 'แหล่งน้ำ–ธรรมชาติ' };
  const ERA_COLOR = { dvaravati: 'bg-sky-500/15 text-sky-700', khmer: 'bg-terra-500/10 text-terra-600', ayutthaya: 'bg-amber-500/15 text-amber-700', faith: 'bg-emerald-600/15 text-emerald-700', nature: 'bg-teal-600/15 text-teal-700' };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.LopburiUI.initIcons();

  /* ---------- บาร์โค้ดบนตั๋ว: รหัสจังหวัดลพบุรี (ISO 3166-2:TH-16) ---------- */
  if (window.renderBarcode && $('#ticketBarcode')) { window.renderBarcode($('#ticketBarcode'), 'TH-16'); if (window.Motion) window.Motion.barcode($('#ticketBarcode')); }


  const { isDark, paintThemeLabel } = window.LopburiUI;
  window.LopburiUI.initTheme();

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

  const { mountLazy } = window.LopburiUI;
  const heroHost = $('#heroModel');
  mountLazy(heroHost, 'hero', 'พระปรางค์สามยอด', 'triprang', 520, { speed: 0.0042, glb: A.find(x => x.id === 'sam-yot').glb.url });
  if (window.Motion) { window.Motion.countOnView($('#srcCount'), S.length, { suffix: '+' }); $$('[data-count]').forEach(el => window.Motion.countOnView(el, +el.dataset.count)); window.Motion.float($('#bannerSeal')); } else $('#srcCount').textContent = S.length + '+';


  window.LopburiUI.initAR();
  window.LopburiUI.initCredits();

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
      b.setAttribute('aria-label', 'แตะเพื่อดูแผนที่ 3 มิติทั้งจังหวัด');
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
        <div class="mt-3 flex flex-wrap gap-2"><a href="${PFX}places/${h.id}.html" class="btn-terra !px-4 !py-2 text-sm">อ่านรายละเอียด</a><button type="button" data-ar="${h.id}" class="btn-soft !px-4 !py-2 text-sm">${svg('cube', 'h-4 w-4 text-terra-500')}ดูโมเดลอาคาร AR</button></div>`;
      info.classList.remove('hidden'); if (window.Motion) window.Motion.slideUp(info);
    }
    host.addEventListener('click', (e) => {
      const t = e.target.closest('[data-mv]'); if (!t || !viewer) return;
      const act = { in: () => viewer.zoom(1.3), out: () => viewer.zoom(0.77), reset: () => viewer.reset(), close: () => viewer.reset() }[t.dataset.mv];
      if (act) act();
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-mvsel]'); if (!t) return;
      const id = t.dataset.mvsel;
      start().then((v) => { if (v) Promise.resolve(v.ready).then(() => v.select(id)).catch(() => {}); });
      host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    let startP = null;
    // เริ่มแผนที่ 3 มิติ (โหลดตัวแสดง 3 มิติก่อนถ้ายังไม่ได้โหลด) คืน promise ของตัวควบคุมแผนที่ (หรือ null ถ้าไม่มี WebGL)
    function start() {
      if (startP) return startP; started = true;
      host.dataset.state = 'loading'; $('#mvLoading').style.display = '';
      return (startP = window.LopburiUI.loadGLScript().catch((e) => console.warn(e.message)).then(() => { create(); return viewer; }));
    }
    function create() {
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
    <li><a href="${PFX}places/${a.id}.html" class="neu flex items-center gap-4 p-3 hover:-translate-y-0.5">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white" style="background:linear-gradient(145deg,#dc6f45,#a8431f)">${a.no}</span>
      <span class="min-w-0 flex-1"><b class="block truncate font-medium text-ink-900">${esc(a.name)}</b><span class="block truncate text-xs text-ink-500">${esc(a.eraLabel)}</span></span>
      ${svg('arrow', 'h-5 w-5 text-terra-500')}</a></li>`).join('');

  /* ---------- map hotspots ---------- */
  const mapWrap = $('#mapWrap');
  A.filter(a => a.map).forEach(a => {
    const b = document.createElement('a');
    b.href = PFX + 'places/' + a.id + '.html'; b.className = 'group absolute -translate-y-1/2 -translate-x-[calc(100%+6px)]';
    b.style.left = a.map[0] + '%'; b.style.top = a.map[1] + '%';
    b.setAttribute('aria-label', `${a.name} — ดูรายละเอียด`);
    b.innerHTML = `<span class="absolute inset-0 -m-1 animate-ping rounded-full bg-terra-400/40 sm:-m-2"></span>
      <span class="absolute -inset-2" aria-hidden="true"></span><span class="relative grid h-5 w-5 place-items-center rounded-full border border-white bg-terra-500 text-[9px] font-semibold text-white shadow-dark transition group-hover:scale-125 sm:h-9 sm:w-9 sm:border-2 sm:text-sm">${a.no}</span>
      <span class="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-char-800 px-3 py-1.5 text-xs text-snow-50 opacity-0 shadow-dark transition group-hover:opacity-100 group-focus-visible:opacity-100">${esc(a.name)}</span>`;
    mapWrap.appendChild(b);
  });

  /* ---------- places ---------- */
  const list = $('#placeList');
  const POSTER = (id, m) => `<img src="assets/poster/${id}-${m}.webp" alt="" loading="lazy" decoding="async" draggable="false" class="poster-img poster-${m} absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]" onerror="this.remove()">`;
  function render(filter = 'all') {
    list.innerHTML = '';
    const items = A.filter(a => filter === 'all' || a.era === filter);
    $('#emptyMsg').classList.toggle('hidden', items.length > 0);
    items.forEach((a) => {
      const el = document.createElement('article');
      el.id = a.id; el.className = 'reveal card group flex scroll-mt-6 flex-col overflow-hidden p-0 transition hover:-translate-y-1';
      el.innerHTML = `
        <a href="${PFX}places/${a.id}.html" class="flex flex-1 flex-col outline-offset-[-4px]">
          <div class="stage-bg relative aspect-[4/3] overflow-hidden">
            <span class="absolute left-5 top-3 z-10 text-6xl font-semibold text-terra-500/25">${a.no}</span>
            ${a.glb ? `${POSTER(a.id, 'day')}${POSTER(a.id, 'night')}
            <span class="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-cream-50/90 px-2.5 py-1 text-[11px] text-ink-700 shadow-neu">${svg('cube', 'h-3.5 w-3.5 text-terra-500')}3D</span>` : `<span class="absolute inset-0 grid place-items-center text-center" role="img" aria-label="โมเดล 3 มิติกำลังจัดทำ">${svg('cube', 'mx-auto h-12 w-12 text-terra-500/40')}<span class="mt-2 block text-xs text-ink-500">โมเดล 3 มิติกำลังจัดทำ</span></span>`}
          </div>
          <div class="flex flex-1 flex-col p-5">
            <span class="inline-block w-fit rounded-full px-3 py-1 text-xs font-medium ${ERA_COLOR[a.era]}">${esc(a.eraLabel)}</span>
            <h3 class="mt-3 text-2xl font-semibold text-ink-900">${esc(a.name)}</h3>
            <p class="mt-0.5 text-xs tracking-widest text-terra-500">${esc(a.en)}</p>
            <p class="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-500">${esc(a.tagline)}</p>
            <span class="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-terra-600">ดูรายละเอียด ${svg('arrow', 'h-4 w-4 transition group-hover:translate-x-1')}</span>
          </div>
        </a>`;
      list.appendChild(el);
    });
    observeReveal();
  }
  const filters = $('#filters');
  Object.entries(ERA).forEach(([k, l]) => {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = l; b.setAttribute('aria-pressed', k === 'all');
    b.addEventListener('click', () => { $$('button', filters).forEach(x => x.setAttribute('aria-pressed', x === b)); render(k); });
    filters.appendChild(b);
  });

  /* ---------- route ---------- */
  $('#routeList').innerHTML = window.ROUTE.map(([n, id, note], i) => `
    <li class="reveal" style="transition-delay:${i * 50}ms"><a href="${PFX}places/${id}.html" class="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-semibold text-white" style="background:linear-gradient(145deg,#dc6f45,#a8431f)">${i + 1}</span>
      <span class="min-w-0"><b class="block font-medium text-ink-900">${esc(n)}</b><span class="block text-sm text-ink-500">${esc(note)}</span></span></a></li>`).join('');

  /* ---------- reveal ---------- */
  let io;
  function observeReveal() {
    if (window.Motion) { window.Motion.reveal($$('.reveal:not(.in)')); return; }
    io = io || new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .06, rootMargin: '0px 0px -40px' });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }
  render(); observeReveal();
  const oldId = location.hash.slice(1);
  if (oldId && A.some(x => x.id === oldId)) location.replace(PFX + 'places/' + oldId + '.html'); // ลิงก์เก่า #id -> หน้าแยก
  else if (location.hash && $(location.hash)) setTimeout(() => $(location.hash).scrollIntoView(), 50);
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
        let captcha = null;
        if (window.LopburiCaptcha && window.LopburiCaptcha.enabled) {
          err.textContent = 'กำลังตรวจสอบความปลอดภัย…';
          try { captcha = await window.LopburiCaptcha.get(f); } catch (e2) { throw new Error('ยืนยันตัวตนไม่สำเร็จ ลองใหม่อีกครั้ง'); }
          err.textContent = '';
        }
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(captcha ? { ...entry, captcha } : entry) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error || 'บันทึกไม่สำเร็จ');
        entries.unshift(j);
      } else { entries.unshift({ ...entry, id: 'l' + Date.now(), at: new Date().toISOString() }); writeLocal(entries); }
      f.reset(); rating = 0; paint(); $('#gbCount').textContent = '0/500'; draw(); if (window.Motion) window.Motion.enter(gbList.firstElementChild);
    } catch (e) { err.textContent = (e instanceof TypeError ? 'บันทึกไม่สำเร็จ' : e.message) || 'เกิดข้อผิดพลาด'; }
    btn.disabled = false;
  });
  if (window.LopburiCaptcha && window.LopburiCaptcha.enabled) $('#gbForm').addEventListener('focusin', () => { if (mode === 'server') window.LopburiCaptcha.prepare($('#gbForm')); }, { once: true });
  load();

  /* ---------- หลายภาษา ---------- */
  window.addEventListener('langchange', () => { draw(); loadWeather(); paintThemeLabel(isDark() ? 'dark' : 'light'); });
  if (window.I18N) I18N.init();

  /* ---------- เคอร์เซอร์และลูกเล่นเมาส์ (anime.js) ---------- */
  if (window.Motion) { window.Motion.cursor(); window.Motion.ripples(); }
})();
