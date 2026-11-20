/* ============================================================
   Three.js renderer — ใช้ MODEL_BUILDERS ชุดเดียวกับ CSS 3D (assets/js/models.js)
   สถาปัตยกรรม: WebGL renderer ตัวเดียว + canvas fixed เต็มจอ (pointer-events: none)
   แล้ววาดแต่ละโมเดลลงใน viewport/scissor ที่ตรงกับตำแหน่ง element ของมัน
   -> ไม่ต้องสร้าง WebGL context ต่อโมเดล (เบราว์เซอร์จำกัดราว 16 context)
   ============================================================ */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, ConeGeometry, CylinderGeometry, TorusGeometry,
  BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, CanvasTexture, SRGBColorSpace, RepeatWrapping,
  HemisphereLight, DirectionalLight, PointLight, Box3, Sphere, Vector3, PCFShadowMap, ACESFilmicToneMapping,
  PMREMGenerator, Shape, ExtrudeGeometry, ShadowMaterial, PlaneGeometry, InstancedMesh, Object3D, Color, Points, PointsMaterial, AdditiveBlending, MathUtils
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const L = () => window.Lopburi3D;
const CAP = 512;
const texCache = new Map();
const matCache = new Map();

/* ---------- พื้นผิว (วาดด้วย canvas) ---------- */
function drawPattern(ctx, kind, W, H, color, s) {
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  ctx.lineWidth = Math.max(0.8, s * 0.6);
  if (kind === 'brick') {
    ctx.strokeStyle = 'rgba(0,0,0,.30)';
    const row = 8 * s;
    for (let y = 0, i = 0; y < H; y += row, i++) { line(0, y, W, y); for (let x = i % 2 ? 8 * s : 0; x < W; x += 16 * s) line(x, y, x, y + row); }
  } else if (kind === 'stone') {
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    const row = 14 * s;
    for (let y = 0, i = 0; y < H; y += row, i++) { line(0, y, W, y); for (let x = i % 2 ? 20 * s : 0; x < W; x += 40 * s) line(x, y, x, y + row); }
  } else if (kind === 'tile') {
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    for (let y = 0; y < H; y += 7 * s) line(0, y, W, y);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    for (let x = 0; x < W; x += 9 * s) line(x, 0, x, H);
  }
  // เกรนละเอียดให้ผิวดูไม่เรียบเกินไป
  for (let i = 0; i < (W * H) / 260; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 * s, 2 * s);
  }
}
function drawWindows(ctx, wins, W, s) {
  wins.forEach(w => {
    for (let i = 0; i < w.n; i++) {
      const x = ((i + 0.5) / w.n) * W, y = w.top * s, ww = w.w * s, hh = w.h * s;
      if (w.k === 'arched') {
        ctx.fillStyle = w.c || 'rgba(30,20,14,.85)';
        ctx.beginPath(); ctx.moveTo(x - ww / 2, y + hh); ctx.lineTo(x - ww / 2, y + ww / 2); ctx.arc(x, y + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(x + ww / 2, y + hh); ctx.fill();
      } else if (w.k === 'pointed') {
        const g = ctx.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, '#7fb6dc'); g.addColorStop(1, '#2d4f6b');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ww / 2, y + hh * 0.28); ctx.lineTo(x + ww / 2, y + hh); ctx.lineTo(x - ww / 2, y + hh); ctx.lineTo(x - ww / 2, y + hh * 0.28); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,15,10,.7)'; ctx.lineWidth = s; ctx.stroke();
      } else { ctx.fillStyle = 'rgba(40,28,20,.8)'; ctx.fillRect(x - ww / 2, y, ww, hh); }
    }
  });
}
function faceTex(kind, color, W, H, wins) {
  const key = [kind, color, Math.round(W), Math.round(H), JSON.stringify(wins || '')].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const s = Math.min(2, CAP / Math.max(W, H));
  const c = document.createElement('canvas'); c.width = Math.max(4, Math.ceil(W * s)); c.height = Math.max(4, Math.ceil(H * s));
  const ctx = c.getContext('2d');
  drawPattern(ctx, kind, c.width, c.height, color, s);
  if (wins && wins.length) drawWindows(ctx, wins, c.width, s);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
const isGold = (pal) => pal.f === '#f0cd77';
function stdMat(pal, which, W, H, wins) {
  const key = [pal.f, which, Math.round(W), Math.round(H), JSON.stringify(wins || '')].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const gold = isGold(pal);
  const m = new MeshStandardMaterial({
    map: gold ? null : faceTex(pal.tex, which === 't' ? pal.t : pal.f, W, H, wins),
    color: gold ? '#f0cd77' : '#ffffff', roughness: gold ? 0.32 : 0.88, metalness: gold ? 0.65 : 0.0,
    emissive: gold ? '#4a3208' : '#000000'
  });
  matCache.set(key, m); return m;
}
function repeatMat(pal, W, H, repX) {
  const key = ['rep', pal.f, Math.round(W), Math.round(H), repX].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const t = faceTex(pal.tex, pal.f, W, H).clone(); t.wrapS = RepeatWrapping; t.repeat.set(repX, 1); t.needsUpdate = true; t.colorSpace = SRGBColorSpace;
  const m = new MeshStandardMaterial({ map: t, roughness: 0.88 });
  matCache.set(key, m); return m;
}
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/* ---------- primitives (ใช้พิกัดเดียวกับ CSS: y ลง -> y ขึ้น) ---------- */
const THREEP = {
  group: (x, y, z) => { const g = new Group(); g.position.set(x, -y, z); return g; },
  add: (g, n) => g.add(n),
  box(w, h, d, pal, cx = 0, by = 0, cz = 0, opt = {}) {
    const wins = opt.win || [];
    const wf = wins.filter(x => x.f === 'front'), wr = wins.filter(x => x.f === 'right');
    const mats = [
      stdMat(pal, 'f', d, h, wr), stdMat(pal, 'f', d, h), stdMat(pal, 't', w, d),
      stdMat(pal, 'f', w, d), stdMat(pal, 'f', w, h, wf), stdMat(pal, 'f', w, h)
    ];
    const m = new Mesh(new BoxGeometry(w, h, d), mats);
    m.position.set(cx, -by + h / 2, cz);
    return shadowed(m);
  },
  pyramid(w, h, pal, cx = 0, by = 0, cz = 0, opt = {}) {
    if (opt.organic) return mountain(w, h, pal, cx, by, cz, opt);
    const geo = new ConeGeometry(w / Math.SQRT2, h, 4, 1); geo.rotateY(Math.PI / 4);
    const slant = Math.hypot(h, w / 2);
    const mat = isGold(pal) ? stdMat(pal, 'f', w, slant) : repeatMat(pal, w, slant, 4);
    const m = new Mesh(geo, mat); m.position.set(cx, -by + h / 2, cz);
    return shadowed(m);
  },
  gable(w, d, h, pal, cx = 0, by = 0, cz = 0) {
    const W = w + 8, D = d + 12, hw = W / 2, hd = D / 2, slant = Math.hypot(h, hd);
    const P = {
      A: [-hw, h, 0], B: [hw, h, 0], C: [-hw, 0, hd], Dd: [hw, 0, hd], E: [-hw, 0, -hd], F: [hw, 0, -hd]
    };
    const v = [], uv = [];
    const tri = (a, b, c, ua, ub, uc) => { v.push(...P[a], ...P[b], ...P[c]); uv.push(...ua, ...ub, ...uc); };
    // ลาดหน้า / ลาดหลัง (กลุ่ม 0) , หน้าจั่วซ้าย-ขวา (กลุ่ม 1)
    tri('C', 'Dd', 'B', [0, 0], [1, 0], [1, 1]); tri('C', 'B', 'A', [0, 0], [1, 1], [0, 1]);
    tri('F', 'E', 'A', [0, 0], [1, 0], [1, 1]); tri('F', 'A', 'B', [0, 0], [1, 1], [0, 1]);
    tri('Dd', 'F', 'B', [0, 0], [1, 0], [0.5, 1]); tri('E', 'C', 'A', [0, 0], [1, 0], [0.5, 1]);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geo.addGroup(0, 12, 0); geo.addGroup(12, 6, 1); geo.computeVertexNormals();
    const m = new Mesh(geo, [stdMat(pal, 'f', W, slant), stdMat(L().PAL.wall, 'f', D, h)]);
    m.position.set(cx, -by, cz);
    return shadowed(m);
  }
};

/* ภูเขาแบบ low-poly + บันไดคดเคี้ยว */
function mountain(w, h, pal, cx, by, cz, opt) {
  const R = w * 0.62, g = new Group(); g.position.set(cx, -by, cz);
  const geo = new ConeGeometry(R, h, 40, 16, true);
  const pos = geo.attributes.position, cols = [];
  const base = new Color('#3e6b38'), low = new Color('#2c5028'), rock = new Color('#8f7e5c'), top = new Color('#6f9d5e'), c = new Color();
  const noise = (x, z) => Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.045) + 0.5 * Math.sin(x * 0.11 + z * 0.09 + 2.1) + 0.25 * Math.sin(z * 0.23 - x * 0.17);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (y + h / 2) / h; // 0 ฐาน -> 1 ยอด
    const n = noise(x, z), k = (1 - t) * (1 - t * 0.6);
    pos.setX(i, x * (1 + n * 0.09 * k)); pos.setZ(i, z * (1 + n * 0.09 * k)); if (t < 0.97) pos.setY(i, y + n * 5 * k);
    c.copy(low).lerp(base, Math.min(1, t * 1.6)).lerp(top, Math.max(0, t - 0.55)); if (n > 0.9 && t > 0.15) c.lerp(rock, 0.55);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const body = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  body.position.y = h / 2; shadowed(body); g.add(body);
  if (opt.stairs) {
    const N = 70, steps = new InstancedMesh(new BoxGeometry(14, 2.4, 7), new MeshStandardMaterial({ color: '#efe4c8', roughness: 0.8 }), N);
    const o = new Object3D();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1) * 0.94, a = 0.75 * Math.sin(t * 6.6), r = R * (1 - t) + 3;
      o.position.set(r * Math.sin(a), t * h + 1.5, r * Math.cos(a)); o.rotation.set(0, a, 0); o.scale.setScalar(1 - t * 0.45); o.updateMatrix(); steps.setMatrixAt(i, o.matrix);
    }
    steps.castShadow = steps.receiveShadow = true; g.add(steps);
  }
  return g;
}

/* ---------- สร้างฉากต่อโมเดล ---------- */
const FIT = { palace: 1.0, mountain: 1.0 };
function buildParts(type, opts, shared, custom) {
  const scene = new Scene();
  scene.environment = shared.env; scene.environmentIntensity = 0.32;
  const body = new Group(); scene.add(body);
  if (custom) body.add(custom); else (L().MODEL_BUILDERS[type] || L().MODEL_BUILDERS.bigprang)(body, THREEP);

  const box = new Box3().setFromObject(body), size = box.getSize(new Vector3()), sph = box.getBoundingSphere(new Sphere());
  const r = Math.max(sph.radius * (FIT[type] || 1), Math.hypot(size.x, size.z) * 0.5 * 1.18 + 18), target = sph.center.clone(); target.y = Math.min(target.y, size.y * 0.5);

  // ฐานไดโอรามา: แผ่นดินเผามุมมน + ชั้นทราย
  const SW = size.x * 1.22 + 46, SD = size.z * 1.22 + 46;
  const slab = (w, d, depth, color, y, rad = 26) => {
    const sh = new Shape(), x = -w / 2, z = -d / 2;
    sh.moveTo(x + rad, z); sh.lineTo(x + w - rad, z); sh.quadraticCurveTo(x + w, z, x + w, z + rad); sh.lineTo(x + w, z + d - rad);
    sh.quadraticCurveTo(x + w, z + d, x + w - rad, z + d); sh.lineTo(x + rad, z + d); sh.quadraticCurveTo(x, z + d, x, z + d - rad);
    sh.lineTo(x, z + rad); sh.quadraticCurveTo(x, z, x + rad, z);
    const g = new ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 3, curveSegments: 14 });
    g.rotateX(-Math.PI / 2);
    const m = new Mesh(g, new MeshStandardMaterial({ color, roughness: 0.92 })); m.position.y = y; m.castShadow = m.receiveShadow = true; return m;
  };
  scene.add(slab(SW, SD, 22, '#b9633a', -27));
  scene.add(slab(SW - 8, SD - 8, 5, '#e6bf92', -5.2));
  const ground = new Mesh(new PlaneGeometry(r * 8, r * 8), new ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -29; ground.receiveShadow = true; scene.add(ground);

  // แสง
  scene.add(new HemisphereLight('#fff1dc', '#b98a64', 1.0));
  const sun = new DirectionalLight('#fff0d6', 2.6);
  sun.position.set(target.x + r * 1.3, r * 2.0, target.z + r * 1.1); sun.target.position.copy(target);
  sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.8;
  const sc = sun.shadow.camera; sc.left = -r * 1.6; sc.right = r * 1.6; sc.top = r * 1.6; sc.bottom = -r * 1.6; sc.near = 1; sc.far = r * 7;
  scene.add(sun, sun.target);
  const rim = new DirectionalLight('#ffd2a8', 0.7); rim.position.set(-r * 1.5, r * 0.8, -r * 1.2); scene.add(rim);

  let particles = null;
  if (opts.particles) {
    const N = 320, p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, rr = r * (0.7 + Math.random() * 1.4); p.set([Math.cos(a) * rr, Math.random() * r * 2.2, Math.sin(a) * rr], i * 3); }
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(p, 3));
    particles = new Points(geo, new PointsMaterial({ color: '#f0cd77', size: 3.2, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
    scene.add(particles);
  }

  const camera = new PerspectiveCamera(30, 1, 5, r * 40);
  return {
    scene, camera, r, target, particles, size,
    dispose() { scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); }
  };
}

function makeView(host, type, opts, shared) {
  const v = { host, az: opts.az ?? 0.62, el: opts.el ?? 0.34, speed: opts.speed ?? 0.0035, mx: 0, hover: false, dragging: false, ...buildParts(type, opts, shared, null) };
  bindInput(v, opts);
  return v;
}

/* ---------- โหลดโมเดล .glb (เช่น ที่ปั้นเอง) ---------- */
const glbCache = new Map();
function loadGlb(url) {
  if (glbCache.has(url)) return glbCache.get(url);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const pr = new Promise((res, rej) => loader.load(url, (g) => {
    const root = g.scene;
    // ปรับขนาด/ตำแหน่ง: กว้างใกล้เคียงโมเดลจำลอง (~370 หน่วย) วางฐานบนพื้น y=0 กึ่งกลางที่ x,z=0
    const b = new Box3().setFromObject(root), sz = b.getSize(new Vector3()), c = b.getCenter(new Vector3());
    const k = 370 / Math.max(sz.x, sz.z);
    const holder = new Group(); holder.add(root);
    root.position.set(-c.x, -b.min.y, -c.z); holder.scale.setScalar(k);
    const outer = new Group(); outer.add(holder);
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true; o.userData.keep = true;
        const m = o.material; if (m) { m.metalness = Math.min(m.metalness ?? 0, 0.15); m.envMapIntensity = 0.6; m.needsUpdate = true; }
      }
    });
    res(outer);
  }, undefined, rej));
  glbCache.set(url, pr); return pr;
}

function bindInput(v, opts) {
  const h = v.host; let lx = 0, ly = 0;
  h.style.touchAction = 'pan-y'; h.style.cursor = 'grab'; h.tabIndex = 0; h.style.outlineOffset = '-4px';
  h.addEventListener('pointerdown', (e) => { v.dragging = true; lx = e.clientX; ly = e.clientY; h.setPointerCapture(e.pointerId); h.style.cursor = 'grabbing'; });
  h.addEventListener('pointermove', (e) => {
    if (opts.hero) v.mx = (e.clientX - h.getBoundingClientRect().left) / h.clientWidth - 0.5;
    if (!v.dragging) return;
    v.az -= (e.clientX - lx) * 0.009; v.el = MathUtils.clamp(v.el + (e.clientY - ly) * 0.006, 0.04, 1.25); lx = e.clientX; ly = e.clientY;
  });
  const end = () => { v.dragging = false; h.style.cursor = 'grab'; };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('pointerenter', () => (v.hover = true)); h.addEventListener('pointerleave', () => { v.hover = false; v.mx = 0; });
  h.addEventListener('dblclick', () => { v.az = opts.az ?? 0.62; v.el = opts.el ?? 0.34; });
  h.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [0.15, 0], ArrowRight: [-0.15, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (k) { e.preventDefault(); v.az += k[0]; v.el = MathUtils.clamp(v.el + k[1], 0.04, 1.25); }
  });
}

/* ---------- ตัวจัดการกลาง ---------- */
const GL = (() => {
  let renderer, canvas, views = [], shared, running = false, failCb = null, ro, dead = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tv = new Vector3();

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false);
  }
  function frame(t) {
    if (dead) return;
    requestAnimationFrame(frame);
    views = views.filter(v => { if (!v.host.isConnected) { v.dispose(); return false; } return true; });
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, cw, ch); renderer.clear(); renderer.setScissorTest(true);
    for (const v of views) {
      const b = v.host.getBoundingClientRect();
      if (b.width < 4 || b.bottom < 0 || b.top > ch || b.right < 0 || b.left > cw) continue;
      if (!v.dragging && !reduce) v.az += v.hover ? v.speed * 0.25 : v.speed;
      const aspect = b.width / b.height, vf = MathUtils.degToRad(v.camera.fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect), fit = Math.min(vf, hf);
      const dist = (v.r / Math.sin(fit / 2)) * 1.0, az = v.az + v.mx * 0.5;
      v.camera.aspect = aspect; v.camera.updateProjectionMatrix();
      v.camera.position.set(v.target.x + dist * Math.cos(v.el) * Math.sin(az), v.target.y + dist * Math.sin(v.el), v.target.z + dist * Math.cos(v.el) * Math.cos(az));
      v.camera.lookAt(tv.copy(v.target).setY(v.target.y * 0.9));
      if (v.particles) { const p = v.particles.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + 0.25; if (y > v.r * 2.2) y = 0; p.setY(i, y); } p.needsUpdate = true; }
      const x = b.left, y = ch - b.bottom;
      renderer.setViewport(x, y, b.width, b.height); renderer.setScissor(x, y, b.width, b.height);
      renderer.clearDepth(); renderer.render(v.scene, v.camera);
    }
  }

  return {
    init() {
      try {
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:20';
        renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        if (!renderer.getContext()) throw new Error('no ctx');
      } catch (e) { console.warn('WebGL ไม่พร้อมใช้งาน ใช้ CSS 3D แทน', e); return false; }
      document.body.appendChild(canvas);
      renderer.autoClear = false; renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
      renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = SRGBColorSpace;
      size();
      const pm = new PMREMGenerator(renderer); shared = { env: pm.fromScene(new RoomEnvironment(), 0.04).texture }; pm.dispose();
      ro = new ResizeObserver(size); ro.observe(canvas);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; canvas.remove(); failCb && failCb(); });
      return true;
    },
    onFail(cb) { failCb = cb; },
    addView(host, type, opts = {}) {
      if (!renderer || dead) return false;
      let v;
      try { v = makeView(host, type, opts, shared); views.push(v); } catch (e) { console.warn('สร้างฉาก Three.js ไม่สำเร็จ', e); return false; }
      if (opts.glb) {
        // แสดงโมเดลจำลองไปก่อน แล้วสลับเป็นไฟล์ .glb เมื่อโหลดเสร็จ (ล้มเหลว = ใช้โมเดลจำลองต่อ)
        host.dataset.glb = 'loading';
        loadGlb(opts.glb).then(obj => {
          const parts = buildParts(type, opts, shared, obj.clone(true));
          v.dispose(); Object.assign(v, parts); host.dataset.glb = 'ready';
        }).catch(e => { host.dataset.glb = 'failed'; console.warn('โหลด .glb ไม่สำเร็จ ใช้โมเดลจำลองแทน', e); });
      }
      if (!running) { running = true; requestAnimationFrame(frame); }
      return true;
    }
  };
})();

window.LopburiGL = GL;
