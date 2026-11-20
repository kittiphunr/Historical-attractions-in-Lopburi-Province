/* ชั้นอนิเมชันของเว็บ ใช้ anime.js v4 (MIT) — window.Motion
   ทุกฟังก์ชันเคารพ prefers-reduced-motion (ข้ามอนิเมชันและแสดงผลสุดท้ายทันที)
   ถ้าไฟล์นี้โหลดไม่ได้ app.js จะถอยไปใช้ IntersectionObserver ธรรมดา */
import { animate, stagger, createSpring } from 'animejs';

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

window.Motion = Motion;
