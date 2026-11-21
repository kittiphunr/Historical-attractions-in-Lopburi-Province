/* ระบบหลายภาษา (ไทย / English / 简体中文 / 日本語)
   - ภาษาไทยคือข้อความต้นฉบับในหน้าเว็บและ data.js ส่วนภาษาอื่นเป็นพจนานุกรม "ข้อความไทย -> คำแปล" ใน assets/js/lang/<code>.js
     (โหลดเฉพาะภาษาที่ผู้ใช้เลือก) ตัวแปลสแกนข้อความและ aria-label/alt/title/placeholder ทั้งหน้า และเฝ้าดูเนื้อหาที่ถูกสร้างภายหลัง
     (MutationObserver) จึงแปลเนื้อหาที่ app.js สร้างได้โดยไม่ต้องแก้เทมเพลต เก็บข้อความต้นฉบับไว้ สลับกลับเป็นไทยได้เสมอ
   - ข้อความที่มีตัวแปรใช้รูปแบบ {0} {1} เช่น "{0} ข้อความจากผู้มาเยือน" และเรียกผ่าน I18N.t(ข้อความ, ...ค่า)
   - ถ้าไม่มีคำแปล จะแสดงข้อความไทยต้นฉบับ (ไม่แสดงค่าว่าง) */
(function () {
  const LANGS = [
    { code: 'th', name: 'ไทย', short: 'TH', htmlLang: 'th', locale: 'th-TH' },
    { code: 'en', name: 'English', short: 'EN', htmlLang: 'en', locale: 'en-US' },
    { code: 'zh', name: '简体中文', short: '中文', htmlLang: 'zh-Hans', locale: 'zh-CN' },
    { code: 'ja', name: '日本語', short: '日本語', htmlLang: 'ja', locale: 'ja-JP' }
  ];
  const KEY = 'lopburi.lang';
  const ATTRS = ['aria-label', 'alt', 'title', 'placeholder'];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|CODE)$/;
  const packs = {}; const loading = {};
  const origText = new WeakMap(), origAttr = new WeakMap();
  let lang = 'th', dict = null, patterns = [], observer = null, initialized = false;

  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

  function buildPatterns(ui) {
    return Object.keys(ui).filter(k => /\{\d\}/.test(k)).map(k => {
      const re = new RegExp('^' + esc(k).replace(/\{(\d)\}/g, '(.+?)') + '$');
      return { re, val: ui[k] };
    });
  }
  function lookup(key) {
    if (!dict || !key) return null;
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    for (const p of patterns) {
      const m = key.match(p.re);
      if (m) { let out = p.val; m.slice(1).forEach((g, i) => { const tr = lookup(norm(g)); out = out.replace('{' + i + '}', tr != null ? tr : g); }); return out; }
    }
    return null;
  }

  /* ชื่อหน้า/คำอธิบายที่ต่อด้วย " — " (เช่น "ชื่อสถานที่ — ลพบุรี เมืองสามยุค"): ลองแปลทั้งข้อความก่อน ถ้าไม่มีให้แปลทีละท่อน */
  function lookupTitle(str) {
    const full = lookup(norm(str)); if (full != null) return full;
    if (!str.includes(' — ')) return null;
    let hit = false;
    const out = str.split(' — ').map(p => { const t = lookup(norm(p)); if (t != null) { hit = true; return t; } return p; });
    return hit ? out.join(' — ') : null;
  }

  /* ใช้ในโค้ด: I18N.t('{0} ข้อความ', 5) */
  function t(s, ...vars) {
    let r = s;
    if (lang !== 'th') { const tr = lookup(norm(s)); if (tr != null) r = tr; }
    vars.forEach((v, i) => { r = r.replace('{' + i + '}', v); });
    return r;
  }

  function trTextNode(n) {
    const p = n.parentNode; if (!p || SKIP.test(p.nodeName)) return;
    let o = origText.get(n);
    if (o === undefined) { o = n.nodeValue; origText.set(n, o); }
    if (lang === 'th') { if (n.nodeValue !== o) n.nodeValue = o; return; }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(o); const tr = m[2] ? lookup(norm(m[2])) : null;
    const next = tr != null ? m[1] + tr + m[3] : o;
    if (n.nodeValue !== next) n.nodeValue = next;
  }
  function trAttrs(el) {
    const names = el.nodeName === 'META' ? ['content'] : ATTRS;
    names.forEach(a => {
      if (!el.hasAttribute(a)) return;
      if (el.nodeName === 'META' && !/^(description|og:title|og:description)$/.test(el.getAttribute('name') || el.getAttribute('property') || '')) return;
      let store = origAttr.get(el); if (!store) { store = {}; origAttr.set(el, store); }
      if (store[a] === undefined) store[a] = el.getAttribute(a);
      const o = store[a]; const tr = lang === 'th' ? null : (el.nodeName === 'META' ? lookupTitle(o) : lookup(norm(o)));
      const next = tr != null ? tr : o; if (el.getAttribute(a) !== next) el.setAttribute(a, next);
    });
  }
  function apply(root) {
    if (root.nodeType === 3) { trTextNode(root); return; }
    if (root.nodeType !== 1) return;
    if (SKIP.test(root.nodeName)) return;
    trAttrs(root);
    root.querySelectorAll('[aria-label],[alt],[title],[placeholder]').forEach(trAttrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) trTextNode(n);
  }
  function applyAll() {
    apply(document.body);
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(trAttrs);
    if (document.documentElement.dataset.thTitle === undefined) document.documentElement.dataset.thTitle = document.title;
    const th = document.documentElement.dataset.thTitle; const tr = lang === 'th' ? null : lookupTitle(th); document.title = tr != null ? tr : th;
  }

  function loadPack(code) {
    if (packs[code]) return Promise.resolve();
    if (loading[code]) return loading[code];
    if (code === 'zh' || code === 'ja') {
      const f = document.createElement('link'); f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=' + (code === 'zh' ? 'Noto+Sans+SC' : 'Noto+Sans+JP') + ':wght@400;500;600;700&display=swap';
      document.head.appendChild(f);
    }
    return (loading[code] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'assets/js/lang/' + code + '.js';
      s.onload = res; s.onerror = () => { delete loading[code]; rej(new Error('ไม่พบไฟล์ภาษา ' + code)); };
      document.head.appendChild(s);
    }));
  }

  function setupObserver() {
    if (observer) return;
    observer = new MutationObserver((muts) => { if (lang === 'th') return; muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) apply(n); })); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function paintMenu() {
    const cur = LANGS.find(l => l.code === lang);
    const label = document.getElementById('langCur'); if (label) label.textContent = cur.short;
    document.querySelectorAll('#langMenu [data-lang]').forEach(b => { const on = b.dataset.lang === lang; b.setAttribute('aria-selected', on); b.classList.toggle('text-terra-600', on); b.querySelector('[data-check]').style.visibility = on ? 'visible' : 'hidden'; });
  }

  async function set(code, opts = {}) {
    if (!LANGS.some(l => l.code === code)) code = 'th';
    if (code === lang && initialized) return;
    try { if (code !== 'th') await loadPack(code); } catch (e) { console.warn(e.message); code = 'th'; }
    const change = () => {
      lang = code; const info = LANGS.find(l => l.code === code);
      dict = code === 'th' ? null : packs[code].ui; patterns = dict ? buildPatterns(dict) : [];
      document.documentElement.lang = info.htmlLang;
      applyAll(); paintMenu();
      if (opts.persist !== false) { try { localStorage.setItem(KEY, code); } catch (e) { /* โหมดส่วนตัว */ } }
      if (opts.persist !== false) { try { const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.set('lang', code); history.replaceState(null, '', u); } } catch (e) { /* บางสภาพแวดล้อม (เช่น file://) ไม่อนุญาต */ } }
      window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code, locale: info.locale } }));
    };
    if (opts.animate !== false && initialized && window.Motion) window.Motion.swap(document.getElementById('main'), change); else change();
  }

  function detect() {
    const q = new URLSearchParams(location.search).get('lang'); if (q && LANGS.some(l => l.code === q)) return q;
    let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) { /* ไม่มี storage */ }
    if (saved && LANGS.some(l => l.code === saved)) return saved;
    for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'th'])) {
      const c = String(l).toLowerCase();
      if (c.startsWith('th')) return 'th'; if (c.startsWith('zh')) return 'zh'; if (c.startsWith('ja')) return 'ja'; if (c.startsWith('en')) return 'en';
    }
    return 'th';
  }

  function initMenu() {
    const btn = document.getElementById('langBtn'), menu = document.getElementById('langMenu'); if (!btn || !menu) return;
    menu.innerHTML = LANGS.map(l => `<li role="presentation"><button type="button" role="option" data-lang="${l.code}" lang="${l.htmlLang}" class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink-700 transition hover:bg-cream-100"><span>${l.name}</span><svg data-check viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></button></li>`).join('');
    const close = (focus) => { menu.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
    const open = () => { menu.classList.remove('hidden'); btn.setAttribute('aria-expanded', 'true'); if (window.Motion) window.Motion.slideUp(menu); const cur = menu.querySelector('[aria-selected="true"]') || menu.querySelector('button'); cur && cur.focus(); };
    btn.addEventListener('click', () => (menu.classList.contains('hidden') ? open() : close()));
    menu.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (!b) return; close(true); set(b.dataset.lang); });
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i + items.length - 1) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('click', (e) => { if (!menu.classList.contains('hidden') && !e.target.closest('#langBtn,#langMenu')) close(false); });
  }

  async function init() {
    initMenu(); setupObserver();
    const want = detect();
    await set(want, { persist: false, animate: false });
    initialized = true; paintMenu();
  }

  window.I18N = {
    LANGS, t, set, init, apply, lookup,
    get lang() { return lang; },
    get locale() { return LANGS.find(l => l.code === lang).locale; },
    register(code, pack) { packs[code] = pack; }
  };
  window.T = t;
})();
