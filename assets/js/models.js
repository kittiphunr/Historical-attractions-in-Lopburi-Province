/* ============================================================
   CSS 3D mini-engine — สร้างอาคารเรียบง่ายจากกล่อง (box) และพีระมิด/หลังคาจั่ว
   พิกัด: x ขวา, y ลง (พื้น y=0 ตัวอาคารยื่นขึ้นไปทาง -y), z เข้าหาผู้ชม
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

  const TEX = {
    brick: 'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 1px, transparent 1px 16px)',
    stone: 'repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 14px)',
    tile:  'repeating-linear-gradient(0deg, rgba(0,0,0,.2) 0 2px, transparent 2px 7px), repeating-linear-gradient(90deg, rgba(255,255,255,.1) 0 2px, transparent 2px 9px)',
    leaf:  'radial-gradient(circle at 20% 30%, rgba(255,255,255,.12) 0 6px, transparent 7px), radial-gradient(circle at 70% 60%, rgba(0,0,0,.18) 0 8px, transparent 9px)'
  };

  const SHADE = { front: 0, right: 0.18, left: 0.34, back: 0.28, top: -0.12 };
  const shade = (k) => {
    const v = SHADE[k];
    if (v === 0) return '';
    return v > 0 ? `linear-gradient(rgba(0,0,0,${v}),rgba(0,0,0,${v}))` : `linear-gradient(rgba(255,255,255,${-v}),rgba(255,255,255,${-v}))`;
  };
  const paint = (el, pal, kind) => {
    const base = kind === 'top' ? pal.t : kind === 'front' || kind === 'back' ? pal.f : pal.s;
    const layers = [shade(kind), pal.tex ? TEX[pal.tex] : ''].filter(Boolean);
    el.style.backgroundColor = base;
    if (layers.length) el.style.backgroundImage = layers.join(',');
  };

  const div = (cls, css) => { const d = document.createElement('div'); if (cls) d.className = cls; if (css) Object.assign(d.style, css); return d; };
  const px = (n) => `${n}px`;

  /** กล่อง: ฐานกลางที่ (cx, by, cz) ขนาด w×h×d */
  function box(w, h, d, pal, cx = 0, by = 0, cz = 0, opt = {}) {
    const g = div('b3d', { transform: `translate3d(${cx}px,${by}px,${cz}px)` });
    const mk = (kind, W, H, left, top, tf) => {
      const f = div('face', { width: px(W), height: px(H), left: px(left), top: px(top), transform: tf });
      paint(f, pal, kind);
      g.appendChild(f);
      return f;
    };
    const front = mk('front', w, h, -w / 2, -h, `translateZ(${d / 2}px)`);
    mk('back', w, h, -w / 2, -h, `rotateY(180deg) translateZ(${d / 2}px)`);
    const right = mk('right', d, h, -d / 2, -h, `rotateY(90deg) translateZ(${w / 2}px)`);
    const left = mk('left', d, h, -d / 2, -h, `rotateY(-90deg) translateZ(${w / 2}px)`);
    if (!opt.noTop) mk('top', w, d, -w / 2, -d / 2, `translateY(${-h}px) rotateX(90deg)`);
    if (opt.decorate) opt.decorate({ front, right, left, w, h, d });
    return g;
  }

  /** พีระมิดฐานสี่เหลี่ยมจัตุรัส ด้าน w สูง h */
  function pyramid(w, h, pal, cx = 0, by = 0, cz = 0, opt = {}) {
    const g = div('b3d', { transform: `translate3d(${cx}px,${by}px,${cz}px)` });
    const s = Math.hypot(h, w / 2);
    const th = (Math.atan2(w / 2, h) * 180) / Math.PI;
    const tf = ['', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)'];
    tf.forEach((r, i) => {
      const f = div('face', {
        width: px(w), height: px(s), left: px(-w / 2), top: px(-s), transformOrigin: '50% 100%',
        transform: `${r} translateZ(${w / 2}px) rotateX(${th}deg)`,
        clipPath: 'polygon(50% 0,0 100%,100% 100%)'
      });
      paint(f, pal, i === 0 ? 'front' : i === 1 ? 'back' : i === 2 ? 'right' : 'left');
      if (i === 0 && opt.decorate) opt.decorate(f);
      g.appendChild(f);
    });
    return g;
  }

  /** หลังคาจั่ว: ยาวตามแกน x (w), กว้าง d, สูง h */
  function gable(w, d, h, pal, cx = 0, by = 0, cz = 0) {
    const g = div('b3d', { transform: `translate3d(${cx}px,${by}px,${cz}px)` });
    const s = Math.hypot(h, d / 2);
    const th = (Math.atan2(d / 2, h) * 180) / Math.PI;
    [['', 'front'], ['rotateY(180deg)', 'back']].forEach(([r, k]) => {
      const f = div('face', {
        width: px(w), height: px(s), left: px(-w / 2), top: px(-s), transformOrigin: '50% 100%',
        transform: `${r} translateZ(${d / 2}px) rotateX(${th}deg)`, backfaceVisibility: 'visible'
      });
      paint(f, pal, k === 'front' ? 'front' : 'left');
      g.appendChild(f);
    });
    [['rotateY(90deg)', 'right'], ['rotateY(-90deg)', 'left']].forEach(([r, k]) => {
      const f = div('face', {
        width: px(d), height: px(h), left: px(-d / 2), top: px(-h),
        transform: `${r} translateZ(${w / 2}px)`, clipPath: 'polygon(50% 0,0 100%,100% 100%)'
      });
      paint(f, PAL.wall, k);
      g.appendChild(f);
    });
    return g;
  }

  /** ปรางค์: ชั้นเรือนซ้อนลดหลั่น + ยอดนภศูล */
  function prang(cx, cz, baseW, tiers, tierH, pal = PAL.laterite, opt = {}) {
    const g = div('b3d', { transform: `translate3d(${cx}px,0,${cz}px)` });
    let y = opt.by || 0;
    let w = baseW;
    const step = (baseW * 0.62) / tiers;
    for (let i = 0; i < tiers; i++) {
      const hh = tierH * (1 - i * 0.045);
      g.appendChild(box(w, hh, w, i % 3 === 2 ? PAL.sand : pal, 0, y, 0));
      // บัวคาดชั้น
      g.appendChild(box(w + 5, 4, w + 5, PAL.sand, 0, y - hh, 0));
      y -= hh + 4;
      w -= step;
    }
    g.appendChild(pyramid(Math.max(w + 6, 8), baseW * 0.42, pal, 0, y, 0));
    g.appendChild(box(3, baseW * 0.2, 3, PAL.gold, 0, y - baseW * 0.42, 0, { noTop: false }));
    return g;
  }

  const arched = (face, n, ww, hh, top, color = 'rgba(30,20,14,.78)') => {
    const gap = face.clientWidth || 0;
    for (let i = 0; i < n; i++) {
      const w = ww, left = `${((i + 0.5) / n) * 100}%`;
      face.appendChild(div('', {
        position: 'absolute', left, top: px(top), width: px(w), height: px(hh), marginLeft: px(-w / 2),
        background: color, borderRadius: `${w / 2}px ${w / 2}px 0 0`, boxShadow: 'inset 0 0 6px rgba(0,0,0,.6)'
      }));
    }
  };
  const pointed = (face, n, ww, hh, top) => {
    for (let i = 0; i < n; i++) {
      face.appendChild(div('', {
        position: 'absolute', left: `${((i + 0.5) / n) * 100}%`, top: px(top), width: px(ww), height: px(hh), marginLeft: px(-ww / 2),
        background: 'linear-gradient(#6aa7d1,#2d4f6b)', clipPath: 'polygon(50% 0,100% 28%,100% 100%,0 100%,0 28%)', boxShadow: 'inset 0 0 6px rgba(0,0,0,.5)'
      }));
    }
  };

  function platform(w, d, h = 14, pal = PAL.stone) {
    return box(w, h, d, pal, 0, 0, 0);
  }

  const MODELS = {
    triprang(g) {
      g.appendChild(platform(330, 150, 16));
      g.appendChild(box(250, 52, 52, PAL.laterite, 0, -16, 0)); // ระเบียงเชื่อม
      g.appendChild(box(250, 5, 58, PAL.sand, 0, -68, 0));
      const mk = (x, scale) => prang(x, 0, 74 * scale, 6, 24 * scale, PAL.laterite, { by: -16 });
      g.appendChild(mk(-100, 0.8)); g.appendChild(mk(100, 0.8)); g.appendChild(mk(0, 1));
      g.appendChild(box(70, 38, 46, PAL.sand, 0, -16, 78)); // มุขหน้า/วิหาร
      g.appendChild(gable(76, 52, 28, PAL.roof, 0, -54, 78));
    },
    bigprang(g) {
      g.appendChild(platform(300, 190, 14));
      g.appendChild(prang(0, 0, 100, 8, 28, PAL.laterite, { by: -14 }));
      g.appendChild(prang(-105, 40, 36, 4, 18, PAL.laterite, { by: -14 }));
      g.appendChild(prang(105, 40, 36, 4, 18, PAL.laterite, { by: -14 }));
      g.appendChild(box(120, 24, 40, PAL.stone, 0, -14, 100)); // ซากวิหารหน้า
      [-50, -20, 20, 50].forEach(x => g.appendChild(box(10, 44, 10, PAL.stone, x, -38, 100)));
    },
    brickprang(g) {
      g.appendChild(platform(200, 200, 10, PAL.sand));
      g.appendChild(prang(0, 0, 70, 7, 26, PAL.brick, { by: -10 }));
      g.appendChild(box(54, 36, 54, PAL.brick, -70, -10, 60));
      g.appendChild(box(54, 28, 54, PAL.brick, 70, -10, 60));
    },
    shrine(g) {
      g.appendChild(platform(220, 190, 12, PAL.stone));
      [1, 2, 3].forEach(i => g.appendChild(box(70, 5, 20, PAL.stone, 0, -12 + 5 * (i - 1) * -1 + 0, 80 - i * 14)));
      g.appendChild(box(130, 72, 100, PAL.wall, 0, -12, -6, { decorate: ({ front }) => arched(front, 3, 22, 40, 26) }));
      g.appendChild(gable(160, 126, 54, PAL.roof, 0, -84, -6));
      g.appendChild(gable(100, 90, 36, PAL.roofGold, 0, -112, -6));
      g.appendChild(pyramid(12, 40, PAL.gold, 0, -146, -6));
      [-52, 52].forEach(x => g.appendChild(box(10, 60, 10, PAL.laterite, x, -12, 56)));
    },
    palace(g) {
      g.appendChild(platform(360, 180, 10, PAL.sand));
      g.appendChild(box(300, 74, 120, PAL.wall, 0, -10, 0, { decorate: ({ front }) => arched(front, 7, 20, 40, 22) }));
      g.appendChild(box(310, 6, 130, PAL.sand, 0, -84, 0));
      g.appendChild(box(80, 100, 90, PAL.wall, 0, -84, 0, { decorate: ({ front }) => arched(front, 2, 22, 48, 26) }));
      g.appendChild(gable(100, 110, 50, PAL.roof, 0, -184, 0));
      g.appendChild(gable(70, 80, 34, PAL.roofGold, 0, -230, 0));
      g.appendChild(pyramid(12, 40, PAL.gold, 0, -264, 0));
      [-130, 130].forEach(x => {
        g.appendChild(box(54, 90, 74, PAL.wall, x, -84, 0, { decorate: ({ front }) => arched(front, 2, 14, 30, 22) }));
        g.appendChild(pyramid(70, 34, PAL.roof, x, -174, 0));
      });
    },
    hall(g) {
      g.appendChild(platform(300, 160, 12, PAL.stone));
      g.appendChild(box(220, 62, 90, PAL.wall, 0, -12, 0, { decorate: ({ front }) => { for (let i = 0; i < 9; i++) front.appendChild(div('', { position: 'absolute', left: `${(i + .5) / 9 * 100}%`, top: '14px', width: '8px', height: '30px', marginLeft: '-4px', background: 'rgba(40,28,20,.7)' })); } }));
      g.appendChild(gable(250, 130, 46, PAL.roofGold, 0, -74, 0));
      g.appendChild(gable(200, 94, 34, PAL.roof, 0, -112, 0));
      for (let i = -1; i <= 1; i++) g.appendChild(pyramid(8, 18, PAL.gold, i * 80, -146, 0));
      g.appendChild(prang(120, 70, 36, 4, 18, PAL.laterite, { by: -12 }));
    },
    colonial(g) {
      g.appendChild(platform(300, 170, 10, PAL.sand));
      g.appendChild(box(230, 90, 100, PAL.brick, 0, -10, 0, { decorate: ({ front }) => { arched(front, 6, 16, 32, 14, 'rgba(250,235,200,.85)'); arched(front, 6, 16, 28, 54, 'rgba(250,235,200,.85)'); } }));
      g.appendChild(gable(240, 110, 34, PAL.roof, 0, -100, 0));
      g.appendChild(box(64, 130, 64, PAL.brick, 120, -10, 40, { decorate: ({ front }) => arched(front, 1, 18, 34, 20, 'rgba(250,235,200,.85)') }));
      g.appendChild(pyramid(74, 38, PAL.roof, 120, -140, 40));
    },
    church(g) {
      g.appendChild(platform(280, 170, 10, PAL.stone));
      g.appendChild(box(190, 66, 100, PAL.wall, 0, -10, 0, { decorate: ({ front, right }) => { pointed(front, 5, 14, 40, 14); pointed(right, 3, 14, 40, 14); } }));
      g.appendChild(gable(200, 112, 50, PAL.roofGold, 0, -76, 0));
      g.appendChild(box(60, 110, 60, PAL.wall, -100, -10, 52, { decorate: ({ front }) => pointed(front, 1, 20, 54, 18) }));
      g.appendChild(pyramid(70, 60, PAL.roof, -100, -120, 52));
      g.appendChild(box(3, 22, 3, PAL.gold, -100, -180, 52));
      g.appendChild(box(14, 3, 3, PAL.gold, -100, -172, 52));
    },
    mountain(g) {
      g.appendChild(pyramid(250, 190, PAL.green, 0, 0, 0, {
        decorate: (f) => {
          f.appendChild(div('', {
            position: 'absolute', left: '50%', bottom: '2%', width: '26px', height: '70%', marginLeft: '-13px',
            background: 'repeating-linear-gradient(0deg,#efe4c8 0 3px,#7d6e50 3px 5px)', clipPath: 'polygon(30% 0,70% 0,100% 100%,0 100%)', opacity: .95
          }));
        }
      }));
      g.appendChild(pyramid(150, 100, PAL.green, -92, 0, -60));
      g.appendChild(box(22, 14, 22, PAL.sand, 0, -190, 0));
      g.appendChild(pyramid(34, 24, PAL.gold, 0, -204, 0));
      g.appendChild(box(3, 20, 3, PAL.gold, 0, -228, 0));
    },
    ruins(g) {
      g.appendChild(platform(300, 210, 8, PAL.sand));
      g.appendChild(box(160, 20, 110, PAL.laterite, 0, -8, 0));
      [[-60, 54, -34], [-20, 36, -34], [30, 62, -34], [64, 28, -34], [-60, 40, 34], [64, 46, 34]].forEach(([x, h, z], i) =>
        g.appendChild(box(20, h, 20, i % 2 ? PAL.laterite : PAL.stone, x, -28, z)));
      g.appendChild(box(110, 18, 12, PAL.laterite, 0, -88, -34));
      g.appendChild(box(30, 12, 30, PAL.stone, -100, -8, 80));
      g.appendChild(box(26, 20, 26, PAL.stone, 96, -8, 76));
    }
  };

  /** สร้างโมเดล คืน {root, stage} — root ใส่ perspective แล้ว */
  function createModel(type, size = 360) {
    const root = div('scene', { width: '100%', height: '100%', position: 'relative' });
    const holder = div('', { position: 'absolute', left: '50%', top: '70%', width: 0, height: 0, transformStyle: 'preserve-3d' });
    const k = { palace: 0.78, bigprang: 0.8, colonial: 0.95, church: 0.95, mountain: 0.85 }[type] || 1;
    const scaleWrap = div('', { transformStyle: 'preserve-3d', transform: `scale(${(size / 360) * k})` });
    const stage = div('stage', { transform: 'rotateX(-16deg) rotateY(-28deg)' });
    // เงา/พื้น
    const ground = div('b3d', { transform: 'translateY(2px) rotateX(90deg)' });
    ground.appendChild(div('face', {
      width: '520px', height: '520px', left: '-260px', top: '-260px', borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(212,165,72,.28) 0%, rgba(212,165,72,.10) 45%, rgba(0,0,0,0) 70%)', backfaceVisibility: 'visible'
    }));
    stage.appendChild(ground);
    const body = div('b3d', {});
    (MODELS[type] || MODELS.bigprang)(body);
    stage.appendChild(body);
    scaleWrap.appendChild(stage);
    holder.appendChild(scaleWrap);
    root.appendChild(holder);
    return { root, stage };
  }

  /** ทำให้หมุนเอง + ลากเมาส์/นิ้วหมุนได้ + เอียงตามเคอร์เซอร์ + หยุดเมื่ออยู่นอกจอ */
  function interactive(host, stage, opts = {}) {
    let ry = opts.ry ?? -28, rx = opts.rx ?? -16, speed = opts.speed ?? 0.12;
    let dragging = false, lx = 0, ly = 0, visible = true, hover = false, raf;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const apply = () => { stage.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; };
    const tick = () => {
      if (visible && !dragging && !reduce) { ry += hover ? speed * 0.25 : speed; apply(); }
      raf = requestAnimationFrame(tick);
    };
    host.style.touchAction = 'pan-y';
    host.style.cursor = 'grab';
    host.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; host.setPointerCapture(e.pointerId); host.style.cursor = 'grabbing'; });
    host.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      ry += (e.clientX - lx) * 0.5; rx = Math.max(-50, Math.min(-2, rx - (e.clientY - ly) * 0.3));
      lx = e.clientX; ly = e.clientY; apply();
    });
    const end = () => { dragging = false; host.style.cursor = 'grab'; };
    host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
    host.addEventListener('pointerenter', () => (hover = true)); host.addEventListener('pointerleave', () => (hover = false));
    new IntersectionObserver((es) => es.forEach(e => (visible = e.isIntersecting)), { rootMargin: '100px' }).observe(host);
    apply(); tick();
    return () => cancelAnimationFrame(raf);
  }

  window.Lopburi3D = { createModel, interactive };
})();
