/* ============================================================
   นิยามอาคารจำลอง 10 แบบ (ไม่ผูกกับตัวเรนเดอร์) + ตัวเรนเดอร์สำรองด้วย CSS 3D
   - Three.js (assets/js/three-scenes.js) ใช้ MODEL_BUILDERS ชุดเดียวกันนี้สร้างฉาก WebGL
   - ถ้าเครื่องไม่รองรับ WebGL เว็บจะใช้ตัวเรนเดอร์ CSS 3D ด้านล่างแทนอัตโนมัติ
   พิกัด: x ขวา, y ลง (พื้น y=0 อาคารยื่นขึ้นไปทาง -y), z เข้าหาผู้ชม
   ============================================================ */
(function () {
  const PAL = {
    laterite: { f: '#b9643c', s: '#9a4d2b', t: '#d08a5e', tex: 'brick' },
    brick:    { f: '#a24d31', s: '#82391f', t: '#bf6a49', tex: 'brick' },
    sand:     { f: '#dcc593', s: '#bda56f', t: '#ecdcb0', tex: 'stone' },
    stone:    { f: '#b8ad98', s: '#968b77', t: '#cfc5af', tex: 'stone' },
    wall:     { f: '#efe6d0', s: '#d2c6aa', t: '#fff8e6', tex: null },
    roof:     { f: '#c4592b', s: '#963f1c', t: '#d9753f', tex: 'tile' },
    roofGold: { f: '#e0a93f', s: '#b57e22', t: '#f3d27a', tex: 'tile' },
    gold:     { f: '#f0cd77', s: '#c9972f', t: '#fff0b8', tex: null },
    green:    { f: '#4d7d45', s: '#37602f', t: '#6c9c5f', tex: 'leaf' },
    dark:     { f: '#2c211a', s: '#1e1611', t: '#3a2c22', tex: null }
  };

  /* ---------- นิยามอาคาร: เรียกผ่าน P (primitives ของแต่ละตัวเรนเดอร์) ---------- */
  function prang(P, cx, cz, baseW, tiers, tierH, pal = PAL.laterite, by0 = 0) {
    const g = P.group(cx, 0, cz);
    let y = by0, w = baseW;
    const step = (baseW * 0.62) / tiers;
    for (let i = 0; i < tiers; i++) {
      const hh = tierH * (1 - i * 0.045);
      P.add(g, P.box(w, hh, w, i % 3 === 2 ? PAL.sand : pal, 0, y, 0));
      P.add(g, P.box(w + 5, 4, w + 5, PAL.sand, 0, y - hh, 0));
      y -= hh + 4; w -= step;
    }
    P.add(g, P.pyramid(Math.max(w + 6, 8), baseW * 0.42, pal, 0, y, 0));
    P.add(g, P.box(3, baseW * 0.2, 3, PAL.gold, 0, y - baseW * 0.42, 0));
    return g;
  }

  const WIN_LIGHT = 'rgba(250,235,200,.85)';
  const MODEL_BUILDERS = {
    triprang(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(330, 16, 150, PAL.stone, 0, 0, 0));
      A(P.box(250, 52, 52, PAL.laterite, 0, -16, 0));
      A(P.box(250, 5, 58, PAL.sand, 0, -68, 0));
      const mk = (x, s) => prang(P, x, 0, 74 * s, 6, 24 * s, PAL.laterite, -16);
      A(mk(-100, 0.8)); A(mk(100, 0.8)); A(mk(0, 1));
      A(P.box(70, 38, 46, PAL.sand, 0, -16, 78));
      A(P.gable(76, 52, 28, PAL.roof, 0, -54, 78));
    },
    bigprang(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(300, 14, 190, PAL.stone, 0, 0, 0));
      A(prang(P, 0, 0, 100, 8, 28, PAL.laterite, -14));
      A(prang(P, -105, 40, 36, 4, 18, PAL.laterite, -14));
      A(prang(P, 105, 40, 36, 4, 18, PAL.laterite, -14));
      A(P.box(120, 24, 40, PAL.stone, 0, -14, 100));
      [-50, -20, 20, 50].forEach(x => A(P.box(10, 44, 10, PAL.stone, x, -38, 100)));
    },
    brickprang(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(200, 10, 200, PAL.sand, 0, 0, 0));
      A(prang(P, 0, 0, 70, 7, 26, PAL.brick, -10));
      A(P.box(54, 36, 54, PAL.brick, -70, -10, 60));
      A(P.box(54, 28, 54, PAL.brick, 70, -10, 60));
    },
    shrine(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(220, 12, 190, PAL.stone, 0, 0, 0));
      [1, 2, 3].forEach(i => A(P.box(70, 5, 20, PAL.stone, 0, -12 - 5 * (i - 1), 80 - i * 14)));
      A(P.box(130, 72, 100, PAL.wall, 0, -12, -6, { win: [{ f: 'front', k: 'arched', n: 3, w: 22, h: 40, top: 26 }] }));
      A(P.gable(160, 126, 54, PAL.roof, 0, -84, -6));
      A(P.gable(100, 90, 36, PAL.roofGold, 0, -112, -6));
      A(P.pyramid(12, 40, PAL.gold, 0, -146, -6));
      [-52, 52].forEach(x => A(P.box(10, 60, 10, PAL.laterite, x, -12, 56)));
    },
    palace(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(360, 10, 180, PAL.sand, 0, 0, 0));
      A(P.box(300, 74, 120, PAL.wall, 0, -10, 0, { win: [{ f: 'front', k: 'arched', n: 7, w: 20, h: 40, top: 22 }] }));
      A(P.box(310, 6, 130, PAL.sand, 0, -84, 0));
      A(P.box(80, 100, 90, PAL.wall, 0, -84, 0, { win: [{ f: 'front', k: 'arched', n: 2, w: 22, h: 48, top: 26 }] }));
      A(P.gable(100, 110, 50, PAL.roof, 0, -184, 0));
      A(P.gable(70, 80, 34, PAL.roofGold, 0, -230, 0));
      A(P.pyramid(12, 40, PAL.gold, 0, -264, 0));
      [-130, 130].forEach(x => {
        A(P.box(54, 90, 74, PAL.wall, x, -84, 0, { win: [{ f: 'front', k: 'arched', n: 2, w: 14, h: 30, top: 22 }] }));
        A(P.pyramid(70, 34, PAL.roof, x, -174, 0));
      });
    },
    hall(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(300, 12, 160, PAL.stone, 0, 0, 0));
      A(P.box(220, 62, 90, PAL.wall, 0, -12, 0, { win: [{ f: 'front', k: 'slit', n: 9, w: 8, h: 30, top: 14 }] }));
      A(P.gable(250, 130, 46, PAL.roofGold, 0, -74, 0));
      A(P.gable(200, 94, 34, PAL.roof, 0, -112, 0));
      for (let i = -1; i <= 1; i++) A(P.pyramid(8, 18, PAL.gold, i * 80, -146, 0));
      A(prang(P, 120, 70, 36, 4, 18, PAL.laterite, -12));
    },
    colonial(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(300, 10, 170, PAL.sand, 0, 0, 0));
      A(P.box(230, 90, 100, PAL.brick, 0, -10, 0, { win: [
        { f: 'front', k: 'arched', n: 6, w: 16, h: 32, top: 14, c: WIN_LIGHT },
        { f: 'front', k: 'arched', n: 6, w: 16, h: 28, top: 54, c: WIN_LIGHT }] }));
      A(P.gable(240, 110, 34, PAL.roof, 0, -100, 0));
      A(P.box(64, 130, 64, PAL.brick, 120, -10, 40, { win: [{ f: 'front', k: 'arched', n: 1, w: 18, h: 34, top: 20, c: WIN_LIGHT }] }));
      A(P.pyramid(74, 38, PAL.roof, 120, -140, 40));
    },
    church(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(280, 10, 170, PAL.stone, 0, 0, 0));
      A(P.box(190, 66, 100, PAL.wall, 0, -10, 0, { win: [{ f: 'front', k: 'pointed', n: 5, w: 14, h: 40, top: 14 }, { f: 'right', k: 'pointed', n: 3, w: 14, h: 40, top: 14 }] }));
      A(P.gable(200, 112, 50, PAL.roofGold, 0, -76, 0));
      A(P.box(60, 110, 60, PAL.wall, -100, -10, 52, { win: [{ f: 'front', k: 'pointed', n: 1, w: 20, h: 54, top: 18 }] }));
      A(P.pyramid(70, 60, PAL.roof, -100, -120, 52));
      A(P.box(3, 22, 3, PAL.gold, -100, -180, 52));
      A(P.box(14, 3, 3, PAL.gold, -100, -172, 52));
    },
    mountain(g, P) {
      const A = (n) => P.add(g, n);
      A(P.pyramid(250, 190, PAL.green, 0, 0, 0, { stairs: true, organic: true }));
      A(P.pyramid(150, 100, PAL.green, -92, 0, -60, { organic: true }));
      A(P.box(22, 14, 22, PAL.sand, 0, -190, 0));
      A(P.pyramid(34, 24, PAL.gold, 0, -204, 0));
      A(P.box(3, 20, 3, PAL.gold, 0, -228, 0));
    },
    ruins(g, P) {
      const A = (n) => P.add(g, n);
      A(P.box(300, 8, 210, PAL.sand, 0, 0, 0));
      A(P.box(160, 20, 110, PAL.laterite, 0, -8, 0));
      [[-60, 54, -34], [-20, 36, -34], [30, 62, -34], [64, 28, -34], [-60, 40, 34], [64, 46, 34]].forEach(([x, h, z], i) =>
        A(P.box(20, h, 20, i % 2 ? PAL.laterite : PAL.stone, x, -28, z)));
      A(P.box(110, 18, 12, PAL.laterite, 0, -88, -34));
      A(P.box(30, 12, 30, PAL.stone, -100, -8, 80));
      A(P.box(26, 20, 26, PAL.stone, 96, -8, 76));
    }
  };

  /* ===================== ตัวเรนเดอร์สำรอง: CSS 3D ===================== */
  const TEX = {
    brick: 'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 1px, transparent 1px 16px)',
    stone: 'repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 14px)',
    tile:  'repeating-linear-gradient(0deg, rgba(0,0,0,.2) 0 2px, transparent 2px 7px), repeating-linear-gradient(90deg, rgba(255,255,255,.1) 0 2px, transparent 2px 9px)',
    leaf:  'radial-gradient(circle at 20% 30%, rgba(255,255,255,.12) 0 6px, transparent 7px), radial-gradient(circle at 70% 60%, rgba(0,0,0,.18) 0 8px, transparent 9px)'
  };
  const SHADE = { front: 0, right: 0.18, left: 0.34, back: 0.28, top: -0.12 };
  const shade = (k) => { const v = SHADE[k]; if (v === 0) return ''; return v > 0 ? `linear-gradient(rgba(0,0,0,${v}),rgba(0,0,0,${v}))` : `linear-gradient(rgba(255,255,255,${-v}),rgba(255,255,255,${-v}))`; };
  const paint = (el, pal, kind) => {
    const base = kind === 'top' ? pal.t : kind === 'front' || kind === 'back' ? pal.f : pal.s;
    const layers = [shade(kind), pal.tex ? TEX[pal.tex] : ''].filter(Boolean);
    el.style.backgroundColor = base; if (layers.length) el.style.backgroundImage = layers.join(',');
  };
  const div = (cls, css) => { const d = document.createElement('div'); if (cls) d.className = cls; if (css) Object.assign(d.style, css); return d; };
  const px = (n) => `${n}px`;

  function winCss(face, s) {
    for (let i = 0; i < s.n; i++) {
      const common = { position: 'absolute', left: `${((i + 0.5) / s.n) * 100}%`, top: px(s.top), width: px(s.w), height: px(s.h), marginLeft: px(-s.w / 2) };
      if (s.k === 'arched') face.appendChild(div('', { ...common, background: s.c || 'rgba(30,20,14,.78)', borderRadius: `${s.w / 2}px ${s.w / 2}px 0 0`, boxShadow: 'inset 0 0 6px rgba(0,0,0,.6)' }));
      else if (s.k === 'pointed') face.appendChild(div('', { ...common, background: 'linear-gradient(#6aa7d1,#2d4f6b)', clipPath: 'polygon(50% 0,100% 28%,100% 100%,0 100%,0 28%)' }));
      else face.appendChild(div('', { ...common, background: 'rgba(40,28,20,.7)' }));
    }
  }

  const CSSP = {
    group: (x, y, z) => div('b3d', { transform: `translate3d(${x}px,${y}px,${z}px)` }),
    add: (g, n) => g.appendChild(n),
    box(w, h, d, pal, cx = 0, by = 0, cz = 0, opt = {}) {
      const g = div('b3d', { transform: `translate3d(${cx}px,${by}px,${cz}px)` });
      const faces = {};
      const mk = (kind, W, H, left, top, tf) => {
        const f = div('face', { width: px(W), height: px(H), left: px(left), top: px(top), transform: tf }); paint(f, pal, kind); g.appendChild(f); return f;
      };
      faces.front = mk('front', w, h, -w / 2, -h, `translateZ(${d / 2}px)`);
      mk('back', w, h, -w / 2, -h, `rotateY(180deg) translateZ(${d / 2}px)`);
      faces.right = mk('right', d, h, -d / 2, -h, `rotateY(90deg) translateZ(${w / 2}px)`);
      faces.left = mk('left', d, h, -d / 2, -h, `rotateY(-90deg) translateZ(${w / 2}px)`);
      mk('top', w, d, -w / 2, -d / 2, `translateY(${-h}px) rotateX(90deg)`);
      (opt.win || []).forEach(s => winCss(faces[s.f], s));
      return g;
    },
    pyramid(w, h, pal, cx = 0, by = 0, cz = 0, opt = {}) {
      const g = div('b3d', { transform: `translate3d(${cx}px,${by}px,${cz}px)` });
      const s = Math.hypot(h, w / 2), th = (Math.atan2(w / 2, h) * 180) / Math.PI;
      ['', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)'].forEach((r, i) => {
        const f = div('face', { width: px(w), height: px(s), left: px(-w / 2), top: px(-s), transformOrigin: '50% 100%', transform: `${r} translateZ(${w / 2}px) rotateX(${th}deg)`, clipPath: 'polygon(50% 0,0 100%,100% 100%)' });
        paint(f, pal, i === 0 ? 'front' : i === 1 ? 'back' : i === 2 ? 'right' : 'left');
        if (i === 0 && opt.stairs) f.appendChild(div('', { position: 'absolute', left: '50%', bottom: '2%', width: '26px', height: '70%', marginLeft: '-13px', background: 'repeating-linear-gradient(0deg,#efe4c8 0 3px,#7d6e50 3px 5px)', clipPath: 'polygon(30% 0,70% 0,100% 100%,0 100%)', opacity: .95 }));
        g.appendChild(f);
      });
      return g;
    },
    gable(w, d, h, pal, cx = 0, by = 0, cz = 0) {
      const g = div('b3d', { transform: `translate3d(${cx}px,${by}px,${cz}px)` });
      const s = Math.hypot(h, d / 2), th = (Math.atan2(d / 2, h) * 180) / Math.PI;
      [['', 'front'], ['rotateY(180deg)', 'left']].forEach(([r, k]) => {
        const f = div('face', { width: px(w), height: px(s), left: px(-w / 2), top: px(-s), transformOrigin: '50% 100%', transform: `${r} translateZ(${d / 2}px) rotateX(${th}deg)`, backfaceVisibility: 'visible' });
        paint(f, pal, k); g.appendChild(f);
      });
      [['rotateY(90deg)', 'right'], ['rotateY(-90deg)', 'left']].forEach(([r, k]) => {
        const f = div('face', { width: px(d), height: px(h), left: px(-d / 2), top: px(-h), transform: `${r} translateZ(${w / 2}px)`, clipPath: 'polygon(50% 0,0 100%,100% 100%)' });
        paint(f, PAL.wall, k); g.appendChild(f);
      });
      return g;
    }
  };

  function createModel(type, size = 360) {
    const root = div('scene', { width: '100%', height: '100%', position: 'relative' });
    const holder = div('', { position: 'absolute', left: '50%', top: '70%', width: 0, height: 0, transformStyle: 'preserve-3d' });
    const k = { palace: 0.78, bigprang: 0.8, colonial: 0.95, church: 0.95, mountain: 0.85 }[type] || 1;
    const scaleWrap = div('', { transformStyle: 'preserve-3d', transform: `scale(${(size / 360) * k})` });
    const stage = div('stage', { transform: 'rotateX(-16deg) rotateY(-28deg)' });
    const ground = div('b3d', { transform: 'translateY(2px) rotateX(90deg)' });
    ground.appendChild(div('face', { width: '520px', height: '520px', left: '-260px', top: '-260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,165,72,.28) 0%, rgba(212,165,72,.10) 45%, rgba(0,0,0,0) 70%)', backfaceVisibility: 'visible' }));
    stage.appendChild(ground);
    const body = div('b3d', {});
    (MODEL_BUILDERS[type] || MODEL_BUILDERS.bigprang)(body, CSSP);
    stage.appendChild(body); scaleWrap.appendChild(stage); holder.appendChild(scaleWrap); root.appendChild(holder);
    return { root, stage };
  }

  function interactive(host, stage, opts = {}) {
    let ry = opts.ry ?? -28, rx = opts.rx ?? -16; const speed = opts.speed ?? 0.12;
    let dragging = false, lx = 0, ly = 0, visible = true, hover = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const apply = () => { stage.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; };
    const tick = () => { if (visible && !dragging && !reduce) { ry += hover ? speed * 0.25 : speed; apply(); } requestAnimationFrame(tick); };
    host.style.touchAction = 'pan-y'; host.style.cursor = 'grab';
    host.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; host.setPointerCapture(e.pointerId); host.style.cursor = 'grabbing'; });
    host.addEventListener('pointermove', (e) => { if (!dragging) return; ry += (e.clientX - lx) * 0.5; rx = Math.max(-50, Math.min(-2, rx - (e.clientY - ly) * 0.3)); lx = e.clientX; ly = e.clientY; apply(); });
    const end = () => { dragging = false; host.style.cursor = 'grab'; };
    host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
    host.addEventListener('pointerenter', () => (hover = true)); host.addEventListener('pointerleave', () => (hover = false));
    new IntersectionObserver((es) => es.forEach(e => (visible = e.isIntersecting)), { rootMargin: '100px' }).observe(host);
    apply(); tick();
  }

  window.Lopburi3D = { PAL, MODEL_BUILDERS, createModel, interactive };
})();
