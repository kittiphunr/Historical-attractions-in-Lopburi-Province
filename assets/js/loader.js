/* หน้าโหลด (loading) ตอนเข้าหน้าย่อย/กลับหน้าแรก
   - เมื่อกดลิงก์ภายในเว็บไปอีกหน้า: แสดงฉากโหลด (ตราจังหวัดเต้นเบา ๆ) ทันที แล้วฉากเดียวกันยังคงอยู่ในหน้าใหม่
     จนหน้าใหม่โหลดเสร็จ (รวมฟอนต์) จึงค่อยจางหาย — ไม่มีจอขาว/กระพริบคั่นกลาง
   - ฉากโหลดเป็น CSS ล้วน (html.pl-boot ใน assets/tailwind.css) จึงขึ้นก่อนเนื้อหาหน้าจะถูกวาด
   - ชี้ลิงก์ไปหน้าสถานที่ค้างไว้จะ prefetch ล่วงหน้าให้เปิดเร็วขึ้น */
(function () {
  var KEY = 'lopburi.nav', root = document.documentElement, SAFETY_MS = 12000;
  // ผู้ใช้เคยเลือกภาษาอื่นไว้ (กดจากเมนูภาษา): เปิดหน้าไทยแล้วพาไปหน้าเดียวกันในภาษานั้น (ผู้ใช้ใหม่/บอตไม่มีค่าที่จำไว้ จึงไม่ถูกพาไปไหน)
  try {
    var d = root.dataset, pref = localStorage.getItem('lopburi.lang');
    if (d.alts === '1' && !d.prefix && !d.langCode && /^(en|zh|ja)$/.test(pref || '') && !/[?&]lang=/.test(location.search)) {
      location.replace(new URL(pref + '/' + (d.rel || '') + location.hash, document.baseURI).href);
    }
  } catch (e) { /* ไม่มี storage */ }
  var flagged = false;
  try { flagged = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* ไม่มี storage */ }

  function boot() { root.classList.remove('pl-done'); root.classList.add('pl-boot'); }
  function clearFlag() { try { sessionStorage.removeItem(KEY); } catch (e) { /* ไม่มี storage */ } }
  function finish() {
    if (!root.classList.contains('pl-boot')) return;
    clearFlag(); root.classList.add('pl-done');
    setTimeout(function () { root.classList.remove('pl-boot', 'pl-done'); }, 450);
  }

  // มาถึงหน้าใหม่ด้วยการกดลิงก์ภายในเว็บ: ขึ้นฉากโหลดต่อทันที แล้วรอให้พร้อม
  if (flagged) {
    boot();
    var ready = function () {
      var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
      fonts.then(function () { requestAnimationFrame(finish); });
    };
    if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready, { once: true });
    setTimeout(finish, SAFETY_MS);
  }

  // กลับมาจาก bfcache (กดย้อนกลับ) ต้องไม่ค้างฉากโหลด
  window.addEventListener('pageshow', function (e) { if (e.persisted) { clearFlag(); root.classList.remove('pl-boot', 'pl-done'); } });

  function internalTarget(a, e) {
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download') || a.hasAttribute('data-credits') || a.hasAttribute('data-ar')) return false;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return false; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return false;
    return u.pathname !== location.pathname; // ลิงก์ #anchor ในหน้าเดียวกันไม่ต้องโหลด
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!internalTarget(a, e)) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (err) { /* ไม่มี storage */ }
    boot();
    setTimeout(function () { if (document.visibilityState === 'visible') finish(); }, SAFETY_MS); // ถ้านำทางไม่สำเร็จ
  });

  // prefetch หน้าสถานที่เมื่อเมาส์ชี้/แตะลิงก์
  var done = {};
  function prefetch(e) {
    var a = e.target.closest && e.target.closest('a[href*="places/"]');
    if (!a || !internalTarget(a, { button: 0 })) return;
    var h = a.href; if (done[h]) return; done[h] = 1;
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = h; document.head.appendChild(l);
  }
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });
})();
