/* ชั้นอนิเมชันของเว็บ ใช้ anime.js v4 (MIT) — window.Motion
   ทุกฟังก์ชันเคารพ prefers-reduced-motion (ข้ามอนิเมชันและแสดงผลสุดท้ายทันที)
   ถ้าไฟล์นี้โหลดไม่ได้ app.js จะถอยไปใช้ IntersectionObserver ธรรมดา */
import { animate, stagger, createSpring, createAnimatable } from 'animejs';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clean = (el, ...props) => props.forEach(p => el.style.removeProperty(p));

/* --- เผยองค์ประกอบ (.reveal) เมื่อเลื่อนถึง: เลื่อนขึ้น + เฟด เป็นชุดต่อเนื่อง (stagger) --- */
const io = new IntersectionObserver((entries) => {
  const vis = entries.filter(e => e.isIntersecting).map(e => e.target);
  vis.forEach((el, i) => { io.unobserve(el); play(el, i); });
}, { threshold: 0.06, rootMargin: '0px 0px -40px' });

function play(el, i) {
  if (reduce) { el.classList.add('in'); return; }
  el.style.transition = 'none';
  animate(el, {
    opacity: [0, 1], translateY: [38, 0], scale: [0.985, 1],
    duration: 950, delay: Math.min(i, 7) * 90, ease: 'outExpo',
    onComplete: () => { el.classList.add('in'); clean(el, 'opacity', 'transform', 'transition'); }
  });
}

const Motion = {
  reduce,

  reveal(els) { els.forEach(el => { if (el.dataset.rv || el.classList.contains('in')) return; el.dataset.rv = '1'; io.observe(el); }); },

  /* นับเลขขึ้นเมื่อมองเห็น */
  countOnView(el, to, { suffix = '', duration = 1600 } = {}) {
    const set = (v) => { el.textContent = Math.round(v) + suffix; };
    if (reduce) { set(to); return; }
    set(0);
    const o = new IntersectionObserver((es) => {
      if (!es.some(e => e.isIntersecting)) return; o.disconnect();
      const s = { v: 0 }; animate(s, { v: to, duration, ease: 'outExpo', onUpdate: () => set(s.v) });
    }, { threshold: 0.4 }); o.observe(el);
  },

  /* ลอยขึ้นลงเบา ๆ ต่อเนื่อง */
  float(el, amp = 6, ms = 2800) { if (reduce || !el) return; animate(el, { translateY: [0, -amp], duration: ms, ease: 'inOutSine', loop: true, alternate: true }); },

  /* หมุนต่อเนื่อง (เช่น แฉกพระอาทิตย์) */
  spin(el, ms = 24000) { if (reduce || !el) return; el.style.transformOrigin = '32px 32px'; el.style.transformBox = 'view-box'; animate(el, { rotate: 360, duration: ms, ease: 'linear', loop: true }); },

  /* เด้งเข้า (สปริง) เช่น หมุดบนแผนที่ 3 มิติ */
  pop(els, { delay = 90 } = {}) {
    if (reduce) return;
    animate(els, { scale: [0, 1], opacity: [0, 1], duration: 900, delay: stagger(delay), ease: createSpring({ stiffness: 260, damping: 11 }) });
  },

  slideUp(el) { if (reduce || !el) return; animate(el, { opacity: [0, 1], translateY: [18, 0], duration: 480, ease: 'outExpo', onComplete: () => clean(el, 'transform') }); },

  dialogIn(el) { if (reduce || !el) return; animate(el, { opacity: [0, 1], scale: [0.92, 1], translateY: [18, 0], duration: 480, ease: 'outBack', onComplete: () => clean(el, 'transform') }); },

  /* ปุ่มสลับโหมดเด้ง + แสงวาบแผ่จากปุ่ม (อบอุ่นตอนเช้า / น้ำเงินตอนกลางคืน) */
  themeBurst(btn, toDark) {
    if (reduce || !btn) return;
    animate(btn, { scale: [0.7, 1], rotate: [-45, 0], duration: 650, ease: 'outElastic(1, .6)', onComplete: () => clean(btn, 'transform') });
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const f = document.createElement('div');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = `position:fixed;inset:0;z-index:70;pointer-events:none;background:radial-gradient(circle at ${x}px ${y}px, ${toDark ? 'rgba(110,140,255,.38)' : 'rgba(255,214,150,.5)'} 0, transparent 55%)`;
    document.body.appendChild(f);
    animate(f, { opacity: [1, 0], scale: [0.4, 1.6], duration: 900, ease: 'outCubic', onComplete: () => f.remove() });
  },

  /* เปลี่ยนภาษา: เฟดออก → เปลี่ยนข้อความ → เฟดเข้า */
  swap(container, change) {
    if (reduce || !container) { change(); return; }
    animate(container, {
      opacity: [1, 0], duration: 170, ease: 'inQuad',
      onComplete: () => { change(); animate(container, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: 'outQuad', onComplete: () => clean(container, 'opacity', 'transform') }); }
    });
  },

  /* แท่งบาร์โค้ดตั้งขึ้นทีละแท่ง */
  barcode(svg) {
    if (!svg) return;
    const bars = svg.querySelectorAll('rect'); if (reduce || !bars.length) return;
    const o = new IntersectionObserver((es) => {
      if (!es.some(e => e.isIntersecting)) return; o.disconnect();
      animate(bars, { scaleY: [0, 1], duration: 520, delay: stagger(12), ease: 'outCubic' });
    }, { threshold: 0.5 }); o.observe(svg);
  },

  /* รายการที่เพิ่มใหม่ (เช่น ข้อความสมุดเยี่ยม) */
  enter(el) { if (reduce || !el) return; animate(el, { opacity: [0, 1], translateX: [-24, 0], duration: 600, ease: 'outExpo', onComplete: () => clean(el, 'transform') }); }
};


/* ============================================================
   เคอร์เซอร์และลูกเล่นเมาส์ (anime.js) — เปิดเฉพาะอุปกรณ์ที่มีเมาส์ (hover: hover + pointer: fine)
   และปิดเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว (prefers-reduced-motion)
   - จุด + วงแหวนเคอร์เซอร์ที่ลื่นไหล (createAnimatable) เปลี่ยนรูปตามสิ่งที่ชี้: ลิงก์/ปุ่ม, โมเดล 3 มิติ (ขึ้นคำว่า "ลาก")
   - ประกายทองตามรอยเมาส์ + ระเบิดประกายเมื่อคลิกปุ่ม
   - ปุ่มถูกดึงเข้าหาเคอร์เซอร์ (magnetic) และแสงสปอตไลต์บนการ์ด
   ============================================================ */
const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const rand = (a, b) => a + Math.random() * (b - a);
const INTERACTIVE = 'a[href],button,[role="button"],[role="option"],[role="tab"],summary,label[for],.chip,[data-mvsel],[data-ar],[data-sec]';
const DRAGGABLE = '.model,#heroModel,#mapViewer';
const MAGNETIC = '.btn-terra,.btn-soft,.btn-dark,#themeBtn,#langBtn,.rail-btn,#arClose';

Motion.cursor = function () {
  if (reduce || !FINE.matches) return false;
  const root = document.documentElement;
  const mk = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); e.innerHTML = html; document.body.appendChild(e); return e; };
  const dot = mk('cur-dot'), ringWrap = mk('cur-ring', '<i></i>'), ring = ringWrap.firstElementChild;
  const pool = Array.from({ length: 44 }, (_, i) => { const s = mk('sparkle'); s.dataset.k = i % 3; s.style.opacity = 0; return s; });
  root.classList.add('has-cursor');
  // วงแหวนตามเคอร์เซอร์แบบนุ่ม (anime.js animatable)
  const follow = createAnimatable(ringWrap, { x: 430, y: 430, ease: 'out(3)' });
  let mx = -100, my = -100, lx = -100, ly = -100, shown = false, hidden = false, idx = 0, last = 0, down = false;
  let state = 'idle';

  const place = () => { dot.style.transform = `translate3d(${mx}px,${my}px,0)`; };
  const show = (v) => { if (hidden === !v) return; hidden = !v; dot.classList.toggle('cur-hide', !v); ringWrap.classList.toggle('cur-hide', !v); };
  const setRing = (scale, label) => {
    animate(ring, { scale, duration: 320, ease: 'outBack' });
    ring.classList.toggle('is-link', state === 'link');
    ring.classList.toggle('is-label', !!label);
    ring.textContent = label || '';
    animate(dot, { opacity: label ? 0 : 1, duration: 200, ease: 'outQuad' });
  };
  const apply = (target) => {
    if (target.closest('input,textarea,select,option')) { state = 'field'; show(false); return; }
    if (document.querySelector('dialog:modal')) { root.classList.add('cursor-native'); show(false); return; }
    root.classList.remove('cursor-native'); show(true);
    const drag = target.closest(DRAGGABLE), hov = target.closest(INTERACTIVE);
    const next = drag && !hov ? 'drag' : hov ? 'link' : 'idle';
    if (next === state) return; state = next;
    if (next === 'drag') setRing(1.9, (window.T ? window.T('ลาก') : 'ลาก'));
    else if (next === 'link') setRing(1.55);
    else setRing(1);
  };

  // ประกายทอง
  const spawn = (x, y, burst = false, ang = 0) => {
    const el = pool[idx++ % pool.length]; if (document.hidden) return;
    const dx = burst ? Math.cos(ang) * rand(28, 64) : rand(-16, 16), dy = burst ? Math.sin(ang) * rand(28, 64) : rand(10, 42);
    const s = burst ? rand(0.7, 1.25) : rand(0.5, 1);
    animate(el, { translateX: [x, x + dx], translateY: [y, y + dy], scale: [s, 0], rotate: [0, rand(-140, 140)], opacity: [1, 0], duration: burst ? rand(650, 950) : rand(750, 1150), ease: burst ? 'outCubic' : 'outQuad' });
  };

  let raf = 0;
  const loop = () => { raf = 0; lx = mx; ly = my; place(); follow.x(mx).y(my); };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    if (!shown) { shown = true; show(true); follow.x(mx, 0).y(my, 0); } // ครั้งแรกวางทันที ไม่ให้วงแหวนวิ่งมาจากมุมจอ
    if (!raf) raf = requestAnimationFrame(loop);
    const now = performance.now();
    if (state !== 'field' && !root.classList.contains('cursor-native') && now - last > 18 && Math.hypot(mx - lx, my - ly) > 0 && (idx === 0 || now - last > 40)) { last = now; if (Math.random() < 0.55) spawn(mx, my); }
    magnet(e); spotlight(e);
  }, { passive: true });
  addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') apply(e.target); }, { passive: true });
  document.addEventListener('pointerleave', () => show(false));
  document.addEventListener('mouseleave', () => show(false));
  document.addEventListener('mouseenter', () => { if (state !== 'field') show(true); });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return; down = true;
    animate(ring, { scale: (state === 'link' ? 1.55 : state === 'drag' ? 1.9 : 1) * 0.78, duration: 160, ease: 'outQuad' });
    if (e.target.closest(INTERACTIVE) && !e.target.closest('input,textarea,select')) for (let i = 0; i < 9; i++) spawn(e.clientX, e.clientY, true, (i / 9) * Math.PI * 2 + rand(-0.2, 0.2));
  }, { passive: true });
  addEventListener('pointerup', () => { if (!down) return; down = false; animate(ring, { scale: state === 'link' ? 1.55 : state === 'drag' ? 1.9 : 1, duration: 320, ease: 'outBack' }); }, { passive: true });

  // ปุ่มถูกดึงเข้าหาเคอร์เซอร์
  const mags = new WeakMap(); let curMag = null, magTimer = 0;
  const magOf = (el) => { let a = mags.get(el); if (!a) { a = createAnimatable(el, { x: 380, y: 380, ease: 'out(4)' }); mags.set(el, a); } return a; };
  function release(el) { magOf(el).x(0).y(0); clearTimeout(magTimer); magTimer = setTimeout(() => { if (curMag !== el) el.style.removeProperty('transform'); }, 520); }
  function magnet(e) {
    const el = e.target.closest ? e.target.closest(MAGNETIC) : null;
    if (curMag && curMag !== el) { release(curMag); curMag = null; }
    if (!el) return;
    curMag = el; const r = el.getBoundingClientRect();
    const cl = (v, m) => Math.max(-m, Math.min(m, v));
    magOf(el).x(cl((e.clientX - (r.left + r.width / 2)) * 0.28, 9)).y(cl((e.clientY - (r.top + r.height / 2)) * 0.28, 7));
  }
  // แสงสปอตไลต์บนการ์ด + เอียงเล็กน้อยบนการ์ดที่ติด data-tilt
  let spotEl = null;
  function spotlight(e) {
    const c = e.target.closest ? e.target.closest('.card,.card-dark') : null;
    if (spotEl && spotEl !== c) { spotEl.classList.remove('tilt-on'); spotEl.style.removeProperty('--rx'); spotEl.style.removeProperty('--ry'); }
    spotEl = c; if (!c) return;
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    c.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); c.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    if (c.hasAttribute('data-tilt') && c.classList.contains('in')) { c.classList.add('tilt-on'); c.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg'); }
  }
  // เปิด/ปิด dialog ระหว่างที่เมาส์อยู่นิ่ง
  document.addEventListener('close', () => { root.classList.remove('cursor-native'); }, true);
  return true;
};

/* ระลอกคลื่นตอนแตะ/คลิก (ใช้ได้ทุกอุปกรณ์ รวมมือถือ) */
Motion.ripples = function () {
  if (reduce) return;
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('input,textarea,select,model-viewer')) return;
    const r = document.createElement('div'); r.className = 'tap-ripple'; r.setAttribute('aria-hidden', 'true');
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r);
    animate(r, { scale: [0.1, 1], opacity: [0.55, 0], duration: 750, ease: 'outCubic', onComplete: () => r.remove() });
  }, { passive: true });
};

window.Motion = Motion;
