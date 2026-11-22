/* ส่วนที่ใช้ร่วมกันทุกหน้า (หน้าแรก index.html และหน้าสถานที่ places/*.html):
   ไอคอน, โหมดกลางวัน/กลางคืน, ภาพปก -> โมเดล 3 มิติ (กดแล้วโหลด), หน้าต่าง AR */
(function () {
  const T = window.T || ((s, ...v) => v.reduce((r, x, i) => r.replace('{' + i + '}', x), s));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = window.ATTRACTIONS || [];
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
  const initIcons = () => $$('i[data-i]').forEach(i => { i.outerHTML = svg(i.dataset.i, i.className); });


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
  /* ---------- ปรับขนาดตัวอักษร (A− / A+) ---------- */
  const FS_KEY = 'lopburi.fs', FS_STEPS = [0.85, 1, 1.15, 1.3, 1.5];
  function initFontSize() {
    const btn = $('#fsBtn'), menu = $('#fsMenu'); if (!btn || !menu) return;
    const dec = $('#fsDec'), inc = $('#fsInc'), reset = $('#fsReset'), val = $('#fsVal'), dots = $$('#fsDots i');
    let cur = 1; try { const v = parseFloat(localStorage.getItem(FS_KEY)); if (FS_STEPS.includes(v)) cur = v; } catch (e) { /* โหมดส่วนตัว */ }
    const idx = () => FS_STEPS.indexOf(cur);
    function paint() {
      document.documentElement.style.setProperty('--fs', cur);
      val.textContent = Math.round(cur * 100) + '%';
      dec.disabled = idx() <= 0; inc.disabled = idx() >= FS_STEPS.length - 1;
      dots.forEach((d, i) => { d.classList.toggle('bg-terra-500', i === idx()); d.classList.toggle('bg-ink-400/40', i !== idx()); d.classList.toggle('scale-150', i === idx()); });
    }
    function set(v) { cur = v; paint(); try { localStorage.setItem(FS_KEY, String(v)); } catch (e) { /* โหมดส่วนตัว */ } }
    const open = () => { menu.classList.toggle('hidden', false); btn.setAttribute('aria-expanded', 'true'); };
    const close = (back) => { menu.classList.toggle('hidden', true); btn.setAttribute('aria-expanded', 'false'); if (back) btn.focus(); };
    btn.addEventListener('click', () => (menu.classList.contains('hidden') ? open() : close(false)));
    dec.addEventListener('click', () => { if (idx() > 0) set(FS_STEPS[idx() - 1]); });
    inc.addEventListener('click', () => { if (idx() < FS_STEPS.length - 1) set(FS_STEPS[idx() + 1]); });
    reset.addEventListener('click', () => set(1));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.classList.contains('hidden')) { e.stopPropagation(); close(true); } });
    document.addEventListener('click', (e) => { if (!menu.classList.contains('hidden') && !e.target.closest('#fsBtn,#fsMenu')) close(false); });
    paint();
  }

  function initTheme() {
  initFontSize();
  $('#themeBtn').addEventListener('click', () => { const toDark = !isDark(); applyTheme(toDark ? 'dark' : 'light', true); if (window.Motion) window.Motion.themeBurst($('#themeBtn'), toDark); });
  // ตามการตั้งค่าระบบ ถ้าผู้ใช้ยังไม่เคยเลือกเอง
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { let saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (err) { /* ไม่มี storage */ } if (!saved) applyTheme(e.matches ? 'dark' : 'light', false); });

  }

  /* ---------- โมเดล 3 มิติ: Three.js เป็นหลัก / CSS 3D เป็นตัวสำรอง ---------- */
  // สร้างตัวเรนเดอร์ WebGL ตอนผู้ใช้กดเปิดโมเดลครั้งแรกเท่านั้น (หน้าแรกจึงเบา: โหลดแค่ภาพปก)
  let GL = null, glTried = false, glLoading = null;
  // ตัวแสดง 3 มิติ (three-scenes.js ~740 KB) โหลดเมื่อผู้ใช้กดครั้งแรกเท่านั้น; ว่างเมื่อเบราว์เซอร์ว่างงานก็ prefetch ไว้ให้กดแล้วเปิดไว
  function loadGLScript() {
    if (window.LopburiGL) return Promise.resolve();
    return glLoading || (glLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'assets/js/three-scenes.js';
      s.onload = res; s.onerror = () => { glLoading = null; rej(new Error('โหลดตัวแสดง 3 มิติไม่สำเร็จ')); }; document.head.appendChild(s);
    }));
  }
  if (location.protocol !== 'file:') {
    const warm = () => { if (window.LopburiGL || document.querySelector('link[data-warm-gl]')) return; const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = 'assets/js/three-scenes.js'; l.dataset.warmGl = '1'; document.head.appendChild(l); };
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 6000 }) : setTimeout(warm, 4000));
    if (document.readyState === 'complete') idle(); else window.addEventListener('load', () => setTimeout(idle, 1500), { once: true });
  }
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
  /* ภาพปกของโมเดล: ปกติ assets/poster/<key>-day|night.webp — แต่ถ้าผู้ดูแลอัปโหลดโมเดลใหม่ในชุด PHP (window.LOP_MODELS จาก data.php) ภาพปกเดิมไม่ตรงกับโมเดลใหม่แล้ว
     จึงใช้ภาพปกที่อัปโหลดคู่กัน หรือไม่แสดงภาพปก (คืน '') ถ้าไม่ได้อัปโหลด — hero = โมเดลพระปรางค์สามยอด, map = แผนที่ทั้งจังหวัด */
  function posterUrl(key, m) {
    const o = window.LOP_MODELS && window.LOP_MODELS[key === 'hero' ? 'sam-yot' : key === 'map' ? 'province' : key];
    return o ? (o.poster || '') : `assets/poster/${key}-${m}.webp`;
  }
  function mountLazy(host, key, label, type, size, opts = {}) {
    const go = async () => {
      ACTIVE3D.add(key);
      const p = host.querySelector('.poster');
      const busy = () => { if (p) { p.disabled = true; p.dataset.busy = '1'; const l = p.querySelector('[data-pl]'); if (l) l.textContent = T('กำลังโหลดโมเดล…'); } };
      if (!window.LopburiGL) { busy(); try { await loadGLScript(); } catch (e) { console.warn(e.message); } }
      ensureGL();
      mountModel(host, type, size, opts);
      host.dataset.active = '1';
      if (host.hasAttribute('aria-label')) host.setAttribute('role', 'img');
      const hint = host.parentElement && host.parentElement.querySelector('[data-hint]'); if (hint) hint.classList.remove('hidden');
      if (!p) return;
      const done = () => { p.classList.add('opacity-0'); setTimeout(() => p.remove(), 450); };
      if (host.dataset.glb === 'loading') {
        busy();
        const mo = new MutationObserver(() => { if (host.dataset.glb !== 'loading') { mo.disconnect(); done(); } }); mo.observe(host, { attributes: true, attributeFilter: ['data-glb'] });
      } else done();
    };
    if (ACTIVE3D.has(key)) { go(); return; }
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'poster group absolute inset-0 z-10 block h-full w-full overflow-hidden transition-opacity duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-terra-500';
    b.setAttribute('aria-label', 'แตะเพื่อดู 3 มิติ: ' + label);
    const img = (m) => { const u = posterUrl(key, m); return u ? `<img src="${u}" alt="" loading="lazy" decoding="async" draggable="false" class="poster-img poster-${m} absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]" onerror="this.remove()">` : ''; };
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
  function initAR() {
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
      else { await loadGLScript(); const blob = await window.LopburiGL.exportGLB(a.model); arBlobUrl = src = URL.createObjectURL(blob); isBlob = true; } // โมเดลที่สร้างด้วยโค้ด: ส่งออกขนาดจริง ~40 ซม.
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


  }

  /* ---------- เครดิตและแหล่งอ้างอิง: หน้าต่างป๊อบอัพ (เปิดจากปุ่ม [data-credits] หรือ #credits) ---------- */
  function initCredits() {
    const dlg = $('#creditsDialog'); if (!dlg) return;
    const S = window.SOURCES || [];
    $('#mediaTable').innerHTML = A.map(a => `<tr><td class="px-4 py-3 font-medium text-ink-900">${esc(a.name)}</td>
      <td class="px-4 py-3">${a.photo ? `<span class="text-emerald-700">มี · ${esc(a.photo.author)}</span>` : '<span class="text-ink-400">ยังไม่ได้ใส่</span>'}</td>
      <td class="px-4 py-3">${a.video.id ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(a.video.url)}">${esc(a.video.channel)}</a>` : `<a class="text-terra-600 underline" target="_blank" rel="noopener noreferrer" href="${esc(a.video.search)}">ลิงก์ค้นหา</a>`}</td></tr>`).join('');
    $('#srcTotal').textContent = S.length;
    $('#srcList').innerHTML = S.map(s => `<li><a class="block rounded-xl bg-cream-100 px-3 py-2 text-ink-700 shadow-neu hover:text-terra-600" target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.name)} <span class="text-terra-400">↗</span></a></li>`).join('');

    const tabs = $$('[role=tab]', dlg);
    const pick = (t) => { tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).classList.toggle('hidden', !on); }); $('#' + t.getAttribute('aria-controls')).parentElement.scrollTop = 0; };
    tabs.forEach(t => t.addEventListener('click', () => pick(t)));
    $('[role=tablist]', dlg).addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const t = e.target.closest('[role=tab]'); if (!t) return;
      const n = tabs[(tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); pick(n);
    });

    let back = null;
    const open = (trigger) => {
      back = trigger || null; pick(tabs[0]);
      if (!dlg.open) dlg.showModal();
      if (window.Motion) window.Motion.dialogIn(dlg);
    };
    document.addEventListener('click', (e) => { const t = e.target.closest('[data-credits]'); if (t) { e.preventDefault(); open(t); } });
    $('#creditsClose').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => {
      if (location.hash === '#credits') history.replaceState(null, '', location.pathname + location.search);
      if (back) back.focus();
    });
    if (location.hash === '#credits') open(null);
    window.addEventListener('hashchange', () => { if (location.hash === '#credits') open(null); });
  }

  /* ---------- ขยายรูป (lightbox): กดรูปที่มี [data-lb] เปิดภาพใหญ่ + เครดิต
     เลื่อนภาพ: ปุ่ม/ลูกศร/ปัด ; ซูม: ปุ่ม +/−, ล้อเมาส์, บีบสองนิ้ว, ดับเบิลคลิก/แตะสองครั้ง, คีย์ + − 0 ; ลากเพื่อเลื่อนดูเมื่อซูมอยู่ ---------- */
  function initLightbox() {
    const dlg = $('#lightbox'); if (!dlg) return;
    const img = $('#lbImg'), cap = $('#lbCap'), cnt = $('#lbCount'), prev = $('#lbPrev'), next = $('#lbNext'), stage = $('#lbStage');
    const zin = $('#lbZoomIn'), zout = $('#lbZoomOut'), zreset = $('#lbZoomReset');
    const items = () => $$('[data-lb]');
    let idx = 0, back = null;

    /* ---- ซูม/เลื่อน ---- */
    let s = 1, tx = 0, ty = 0;
    const maxScale = () => Math.min(6, Math.max(2.5, ((img.naturalWidth || 0) / (img.clientWidth || 1)) * 2));
    function clampPan() {
      const w = img.clientWidth * s, h = img.clientHeight * s, sw = stage.clientWidth, sh = stage.clientHeight;
      const mx = Math.max(0, (w - sw) / 2 + 8), my = Math.max(0, (h - sh) / 2 + 8);
      tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty));
      if (w <= sw) tx = 0; if (h <= sh) ty = 0;
    }
    function paint(anim) {
      clampPan();
      img.style.transition = anim ? 'opacity .2s, transform .18s ease-out' : 'opacity .2s';
      img.style.transform = s === 1 && !tx && !ty ? '' : `translate(${tx}px,${ty}px) scale(${s})`;
      img.classList.toggle('cursor-zoom-in', s === 1); img.classList.toggle('cursor-grab', s > 1);
      zreset.textContent = Math.round(s * 100) + '%'; zout.disabled = s <= 1.001; zin.disabled = s >= maxScale() - 0.001;
    }
    // ซูมรอบจุด (cx, cy) ที่วัดจากกึ่งกลางพื้นที่แสดงภาพ
    function zoomTo(ns, cx = 0, cy = 0, anim = false) {
      ns = Math.min(maxScale(), Math.max(1, ns)); const k = ns / s;
      tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; s = ns; if (s === 1) { tx = 0; ty = 0; } paint(anim);
    }
    const resetZoom = (anim) => { s = 1; tx = 0; ty = 0; paint(anim); };
    const rel = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)]; };

    function show(i) {
      const list = items(); if (!list.length) return;
      idx = (i + list.length) % list.length;
      const t = list[idx], im = t.querySelector('img'), fc = t.closest('figure') && t.closest('figure').querySelector('figcaption');
      resetZoom(false);
      img.classList.add('opacity-0'); img.onload = () => { img.classList.remove('opacity-0'); paint(false); }; img.onerror = () => img.classList.remove('opacity-0');
      img.src = im.currentSrc || im.src; img.alt = im.alt;
      cap.innerHTML = fc ? fc.innerHTML : '';
      cnt.textContent = T('ภาพที่ {0} จาก {1}', idx + 1, list.length);
      prev.hidden = next.hidden = list.length < 2;
      [list[(idx + 1) % list.length], list[(idx + list.length - 1) % list.length]].forEach(n => { const p = new Image(); p.src = n.querySelector('img').src; });
    }
    const step = (d) => show(idx + d);
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-lb]'); if (!t) return;
      back = t; show(items().indexOf(t)); dlg.showModal(); document.documentElement.style.overflow = 'hidden';
      if (window.Motion) window.Motion.dialogIn(dlg);
      $('#lbClose').focus();
    });
    $('#lbClose').addEventListener('click', () => dlg.close());
    prev.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
    zin.addEventListener('click', () => zoomTo(s * 1.5, 0, 0, true));
    zout.addEventListener('click', () => zoomTo(s / 1.5, 0, 0, true));
    zreset.addEventListener('click', () => resetZoom(true));
    dlg.addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(s * 1.4, 0, 0, true); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(s / 1.4, 0, 0, true); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(true); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); const d = e.key === 'ArrowLeft' ? -1 : 1;
        if (s > 1.001) { tx -= d * 60; paint(true); } else step(d);
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && s > 1.001) { e.preventDefault(); ty += (e.key === 'ArrowUp' ? 1 : -1) * 60; paint(true); }
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // คลิกนอกกรอบ (พื้นหลัง)
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const [cx, cy] = rel(e); zoomTo(s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), cx, cy); }, { passive: false });
    stage.addEventListener('dblclick', (e) => { if (e.target.closest('button')) return; const [cx, cy] = rel(e); if (s > 1.001) resetZoom(true); else zoomTo(Math.min(2.5, maxScale()), cx, cy, true); });

    /* ---- ท่าทางสัมผัส/เมาส์: ลากเลื่อน (ตอนซูม) หรือปัดเปลี่ยนภาพ (ตอนไม่ซูม) และบีบสองนิ้ว ---- */
    const ptrs = new Map(); let pinch = null, drag = null, lastTap = 0;
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s }; drag = null; }
      else if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, t: performance.now(), moved: 0, onStage: e.target === stage };
    });
    stage.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (!pinch.d) return;
        const r = stage.getBoundingClientRect(), mx = (a.x + b.x) / 2 - (r.left + r.width / 2), my = (a.y + b.y) / 2 - (r.top + r.height / 2);
        zoomTo(pinch.s * (d / pinch.d), mx, my); return;
      }
      if (ptrs.size === 1 && drag) {
        drag.moved += Math.abs(e.clientX - px) + Math.abs(e.clientY - py);
        if (s > 1.001) { tx += e.clientX - px; ty += e.clientY - py; paint(false); }
      }
    });
    const endPtr = (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
      if (pinch && ptrs.size < 2) { pinch = null; drag = null; return; }
      if (drag && ptrs.size === 0) {
        const dx = e.clientX - drag.sx, quick = performance.now() - drag.t < 600;
        if (s <= 1.001 && Math.abs(dx) > 50 && e.type === 'pointerup') step(dx < 0 ? 1 : -1);
        else if (e.type === 'pointerup' && drag.onStage && drag.moved < 8) dlg.close(); // แตะพื้นที่ว่างข้างภาพ = ปิด (ลาก/แตะบนภาพไม่ปิด)
        else if (e.type === 'pointerup' && e.pointerType === 'touch' && drag.moved < 8 && quick) { // แตะสองครั้ง (บนจอสัมผัส)
          const now = performance.now(); if (now - lastTap < 350) { const [cx, cy] = rel(e); if (s > 1.001) resetZoom(true); else zoomTo(Math.min(2.5, maxScale()), cx, cy, true); lastTap = 0; } else lastTap = now;
        }
        drag = null;
      }
    };
    stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
    window.addEventListener('resize', () => { if (dlg.open) paint(false); });
    dlg.addEventListener('close', () => { document.documentElement.style.overflow = ''; img.removeAttribute('src'); resetZoom(false); ptrs.clear(); pinch = drag = null; if (back && back.isConnected) back.focus(); });
  }

  window.LopburiUI = { posterUrl, $, $$, esc, svg, ICONS, initIcons, isDark, paintThemeLabel, applyTheme, initTheme, ensureGL, mountModel, mountLazy, initAR, initCredits, initLightbox, loadGLScript };
})();
