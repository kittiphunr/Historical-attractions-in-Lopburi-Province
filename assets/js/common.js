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
  function initTheme() {
  $('#themeBtn').addEventListener('click', () => { const toDark = !isDark(); applyTheme(toDark ? 'dark' : 'light', true); if (window.Motion) window.Motion.themeBurst($('#themeBtn'), toDark); });
  // ตามการตั้งค่าระบบ ถ้าผู้ใช้ยังไม่เคยเลือกเอง
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { let saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (err) { /* ไม่มี storage */ } if (!saved) applyTheme(e.matches ? 'dark' : 'light', false); });

  }

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

  window.LopburiUI = { $, $$, esc, svg, ICONS, initIcons, isDark, paintThemeLabel, applyTheme, initTheme, ensureGL, mountModel, mountLazy, initAR, initCredits };
})();
