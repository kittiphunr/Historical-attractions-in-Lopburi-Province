/* หน้าสถานที่ (places/<id>.html): ใช้ตัวช่วยร่วมจาก common.js */
(function () {
  const U = window.LopburiUI, { $, $$, mountLazy, isDark, paintThemeLabel } = U;
  const A = window.ATTRACTIONS, id = document.body.dataset.place, a = A.find(x => x.id === id);
  U.initIcons(); U.initTheme(); U.initAR(); U.initCredits(); U.initLightbox();

  // เมนูข้าง/ล่าง: ไฮไลต์ "10 แห่ง" เพราะอยู่ในหมวดสถานที่
  if (a) $$('[data-sec="places"]').forEach(el => { el.setAttribute('aria-current', 'true'); if (el.closest('nav[aria-label*=มือถือ]')) el.classList.add('text-terra-600'); });

  // ภาพปก -> กดเพื่อโหลดโมเดล 3 มิติ (ไม่โหลดไฟล์ .glb จนกว่าจะกด)
  if (a) mountLazy($('#placeModel'), a.id, a.name, a.model, 420, { az: 0.62, glb: a.glb && a.glb.url, tight: !!(a.glb && a.glb.base) });

  // เนื้อหาค่อย ๆ ปรากฏเมื่อเลื่อนถึง
  const reveal = $$('.reveal');
  if (window.Motion) window.Motion.reveal(reveal);
  else { const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .06 }); reveal.forEach(el => io.observe(el)); }

  window.addEventListener('langchange', () => paintThemeLabel(isDark() ? 'dark' : 'light'));
  if (window.I18N) window.I18N.init();
  if (window.Motion) { window.Motion.cursor(); window.Motion.ripples(); }
})();
