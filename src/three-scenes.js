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
  PMREMGenerator, Raycaster, Vector2, Shape, ExtrudeGeometry, ShadowMaterial, PlaneGeometry, InstancedMesh, Object3D, Color, Points, PointsMaterial, AdditiveBlending, MathUtils
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const L = () => window.Lopburi3D;
const CAP = 512;
let EXPORTING = false; // true ระหว่างส่งออก GLB: เลี่ยง InstancedMesh เพื่อให้เปิดใน Quick Look/Scene Viewer ได้
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

/* แผ่นฐานไดโอรามา (ใช้ทั้งในฉากเว็บและตอนส่งออกไป AR) */
function makeSlab(w, d, depth, color, y, rad = 26) {
  const sh = new Shape(), x = -w / 2, z = -d / 2;
  sh.moveTo(x + rad, z); sh.lineTo(x + w - rad, z); sh.quadraticCurveTo(x + w, z, x + w, z + rad); sh.lineTo(x + w, z + d - rad);
  sh.quadraticCurveTo(x + w, z + d, x + w - rad, z + d); sh.lineTo(x + rad, z + d); sh.quadraticCurveTo(x, z + d, x, z + d - rad);
  sh.lineTo(x, z + rad); sh.quadraticCurveTo(x, z, x + rad, z);
  const g = new ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 3, curveSegments: 14 });
  g.rotateX(-Math.PI / 2);
  const m = new Mesh(g, new MeshStandardMaterial({ color, roughness: 0.92 })); m.position.y = y; m.castShadow = m.receiveShadow = true; return m;
}

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
    const N = 70, stepGeo = new BoxGeometry(14, 2.4, 7), stepMat = new MeshStandardMaterial({ color: '#efe4c8', roughness: 0.8 });
    const steps = EXPORTING ? new Group() : new InstancedMesh(stepGeo, stepMat, N);
    const o = new Object3D();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1) * 0.94, a = 0.75 * Math.sin(t * 6.6), r = R * (1 - t) + 3;
      o.position.set(r * Math.sin(a), t * h + 1.5, r * Math.cos(a)); o.rotation.set(0, a, 0); o.scale.setScalar(1 - t * 0.45); o.updateMatrix();
      if (EXPORTING) { const m = new Mesh(stepGeo, stepMat); m.applyMatrix4(o.matrix); steps.add(m); } else steps.setMatrixAt(i, o.matrix);
    }
    if (!EXPORTING) steps.castShadow = steps.receiveShadow = true;
    g.add(steps);
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
  scene.add(makeSlab(SW, SD, 22, '#b9633a', -27));
  scene.add(makeSlab(SW - 8, SD - 8, 5, '#e6bf92', -5.2));
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


/* ---------- ตัวโหลด .glb กลาง: http(s) ใช้ fetch ปกติ, file:// ใช้ไฟล์สำรอง base64 ที่โหลดผ่าน <script> ---------- */
const OFFLINE = location.protocol === 'file:';
function loadScriptOnce(src) {
  return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('ไม่พบไฟล์สำรอง ' + src)); document.head.appendChild(el); });
}
async function loadGLTF(url, onProgress) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  if (OFFLINE) {
    if (!(window.__GLB && window.__GLB[url])) await loadScriptOnce('assets/model/offline/' + url.split('/').pop() + '.js');
    const bin = atob(window.__GLB[url]), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    if (onProgress) onProgress({ loaded: 1, total: 1 });
    return new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej));
  }
  return new Promise((res, rej) => loader.load(url, res, onProgress, rej));
}

/* ---------- โหลดโมเดล .glb (เช่น ที่ปั้นเอง) ---------- */
const glbCache = new Map();
function loadGlb(url) {
  if (glbCache.has(url)) return glbCache.get(url);
  const pr = loadGLTF(url).then((g) => {
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
    return outer;
  });
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


/* ---------- ส่งออกโมเดลที่สร้างด้วยโค้ดเป็น .glb สำหรับ AR (ขนาดจริงบนโต๊ะ ~ 40 ซม.) ---------- */
async function exportGLB(type, meters = 0.4) {
  EXPORTING = true;
  try {
    const body = new Group();
    (L().MODEL_BUILDERS[type] || L().MODEL_BUILDERS.bigprang)(body, THREEP);
    const size = new Box3().setFromObject(body).getSize(new Vector3());
    const SW = size.x * 1.22 + 46, SD = size.z * 1.22 + 46;
    const inner = new Group(); inner.add(body, makeSlab(SW, SD, 22, '#b9633a', -27), makeSlab(SW - 8, SD - 8, 5, '#e6bf92', -5.2));
    const k = meters / Math.max(SW, SD);
    inner.scale.setScalar(k); inner.position.y = 29.5 * k; // ให้ก้นแผ่นฐานแตะพื้น y=0
    const root = new Group(); root.name = type; root.add(inner);
    const buf = await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 1024 });
    return new Blob([buf], { type: 'model/gltf-binary' });
  } finally { EXPORTING = false; }
}


/* ---------- ตัวดูแผนที่ทั้งจังหวัดแบบ 3 มิติ (แตะได้) ----------
   ใช้ renderer/canvas ของตัวเองอยู่ใน host เพื่อให้หมุดและการ์ดข้อมูล (DOM) วางซ้อนบนภาพได้
   cfg = { url, hotspots: [{ id, x, z, el }] }  x,z = พิกัดในหน่วยของไฟล์โมเดลต้นฉบับ (กึ่งกลาง ~0,0)
   คืนค่า controller { ready, select(id), reset(), zoom(f), onSelect(cb) } หรือ null ถ้าไม่มี WebGL */
function createMapViewer(host, cfg) {
  const canvas = document.createElement('canvas');
  canvas.className = 'absolute inset-0 h-full w-full'; canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) throw new Error('no ctx');
  } catch (e) { console.warn('WebGL ไม่พร้อมสำหรับแผนที่ 3 มิติ', e); return null; }
  host.prepend(canvas);
  renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = SRGBColorSpace;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new Scene(), camera = new PerspectiveCamera(34, 1, 10, 8000);
  const pm = new PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35; pm.dispose();
  scene.add(new HemisphereLight('#fff1dc', '#b98a64', 1.0));
  const sun = new DirectionalLight('#fff0d6', 2.6); sun.position.set(520, 900, 560); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 1.2;
  Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 520, bottom: -520, near: 10, far: 2600 }); scene.add(sun, sun.target);
  const rim = new DirectionalLight('#ffd2a8', 0.6); rim.position.set(-500, 300, -600); scene.add(rim);

  const S = { az: 0.55, el: 0.9, dist: 1400, target: new Vector3(0, 10, 0), fit: 1400, auto: !reduce, userTouched: false };
  const goal = { az: S.az, el: S.el, dist: S.dist, target: S.target.clone() };
  const model = new Group(); scene.add(model);
  const hs = cfg.hotspots.map(h => ({ ...h, pos: new Vector3() }));
  let selected = null, onSel = () => {}, ready = false, visible = true, dragging = false;
  const ray = new Raycaster(), ndc = new Vector2();

  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fitDist(); };
  const fitDist = () => { const vf = MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect); S.fit = (S.radius || 450) / Math.sin(Math.min(vf, hf) / 2) * 0.74; if (!S.userTouched && !selected) { goal.dist = S.fit; if (!ready) S.dist = S.fit; } };
  new ResizeObserver(size).observe(host); new IntersectionObserver(es => es.forEach(e => (visible = e.isIntersecting)), { rootMargin: '120px' }).observe(host);

  const readyP = loadGLTF(cfg.url, (e) => { if (e.total) api.onProgress && api.onProgress(e.loaded / e.total); }).then((g) => {
    const root = g.scene; const b = new Box3().setFromObject(root), sz = b.getSize(new Vector3()), c = b.getCenter(new Vector3());
    const k = 600 / Math.max(sz.x, sz.z);
    root.position.set(-c.x, -b.min.y, -c.z); const holder = new Group(); holder.add(root); holder.scale.setScalar(k); model.add(holder);
    root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; const m = o.material; if (m) { m.metalness = Math.min(m.metalness ?? 0, 0.1); m.envMapIntensity = 0.6; m.needsUpdate = true; } } });
    model.updateMatrixWorld(true);
    const nb = new Box3().setFromObject(model); S.radius = nb.getBoundingSphere(new Sphere()).radius; S.height = nb.max.y;
    const ground = new Mesh(new PlaneGeometry(2600, 2600), new ShadowMaterial({ opacity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1; ground.receiveShadow = true; scene.add(ground);
    // วางหมุดบนผิวโมเดล: ยิงรังสีลงจากด้านบนที่ (x,z) ของแต่ละสถานที่
    const rc = new Raycaster();
    hs.forEach(h => {
      const x = (h.x - c.x) * k, z = (h.z - c.z) * k; rc.set(new Vector3(x, 2000, z), new Vector3(0, -1, 0));
      const hit = rc.intersectObject(model, true)[0]; h.pos.set(x, (hit ? hit.point.y : 20) + 6, z);
    });
    ready = true; fitDist(); S.dist = goal.dist = S.fit;
  });

  const api = { ready: readyP, onProgress: null, onSelect(cb) { onSel = cb; },
    select(id) {
      selected = id; S.auto = false;
      const h = hs.find(x => x.id === id);
      if (h) { goal.target.copy(h.pos); goal.dist = Math.max(S.fit * 0.38, 260); goal.el = Math.max(goal.el, 0.85); }
      onSel(id);
    },
    reset() { selected = null; S.userTouched = false; goal.target.set(0, 10, 0); goal.dist = S.fit; goal.el = 0.9; goal.az = 0.55; onSel(null); },
    zoom(f) { S.userTouched = true; S.auto = false; goal.dist = MathUtils.clamp(goal.dist / f, 220, S.fit * 1.5); },
    rotate(da, de) { S.userTouched = true; S.auto = false; goal.az -= da; goal.el = MathUtils.clamp(goal.el + de, 0.12, 1.5); S.az = goal.az; S.el = goal.el; } };

  // ---- การควบคุม ----
  const ptrs = new Map(); let down = null;
  host.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-map-ui]')) return;
    host.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; else down = null;
    dragging = true;
  });
  host.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY; const [c, d] = [...ptrs.values()]; const d1 = Math.hypot(c.x - d.x, c.y - d.y);
      if (d0 > 0) api.zoom(d1 / d0); return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (down) down.moved += Math.abs(dx) + Math.abs(dy);
    api.rotate(dx * 0.008, dy * 0.006);
  });
  const up = (e) => {
    const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if (!ptrs.size) dragging = false;
    if (was && down && down.moved < 8 && performance.now() - down.t < 600 && e.type === 'pointerup') pick(e.clientX, e.clientY);
    if (!ptrs.size) down = null;
  };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); api.zoom(Math.exp(-e.deltaY * 0.01)); }, { passive: false });
  host.addEventListener('keydown', (e) => {
    const m = { ArrowLeft: () => api.rotate(-0.15, 0), ArrowRight: () => api.rotate(0.15, 0), ArrowUp: () => api.rotate(0, -0.08), ArrowDown: () => api.rotate(0, 0.08), '+': () => api.zoom(1.25), '=': () => api.zoom(1.25), '-': () => api.zoom(0.8), Escape: () => api.reset() }[e.key];
    if (m) { e.preventDefault(); m(); }
  });
  function pick(cx, cy) {
    if (!ready) return; const r = host.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(model, true)[0]; if (!hit) { selected = null; onSel(null); return; }
    let best = null, bd = 70; hs.forEach(h => { const d = Math.hypot(h.pos.x - hit.point.x, h.pos.z - hit.point.z); if (d < bd) { bd = d; best = h; } });
    if (best) api.select(best.id); else { selected = null; onSel(null); }
  }

  // ---- วนเรนเดอร์ ----
  const v3 = new Vector3(); let last = performance.now();
  function frame(t) {
    requestAnimationFrame(frame); const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!visible || !ready) return;
    if (S.auto && !dragging) { goal.az += dt * 0.12; S.az = goal.az; }
    const f = 1 - Math.exp(-dt * 7);
    S.az += (goal.az - S.az) * f; S.el += (goal.el - S.el) * f; S.dist += (goal.dist - S.dist) * f; S.target.lerp(goal.target, f);
    // ตอนเลือกสถานที่: เลื่อนภาพขึ้นเล็กน้อยให้อาคารพ้นการ์ดข้อมูลด้านล่าง
    S.vo = (S.vo || 0) + ((selected ? 1 : 0) - (S.vo || 0)) * f;
    const W = host.clientWidth, H = host.clientHeight;
    if (S.vo > 0.002) camera.setViewOffset(W, H, 0, Math.round(H * 0.16 * S.vo), W, H); else if (camera.view) camera.clearViewOffset();
    camera.position.set(S.target.x + S.dist * Math.cos(S.el) * Math.sin(S.az), S.target.y + S.dist * Math.sin(S.el), S.target.z + S.dist * Math.cos(S.el) * Math.cos(S.az)); camera.lookAt(S.target);
    renderer.render(scene, camera);
    const w = host.clientWidth, h = host.clientHeight;
    hs.forEach(o => { if (!o.el) return; v3.copy(o.pos).project(camera); const on = v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15; o.el.style.visibility = on ? 'visible' : 'hidden'; if (on) o.el.style.transform = `translate(${((v3.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-v3.y * 0.5 + 0.5) * h).toFixed(1)}px)`; });
  }
  host.style.touchAction = 'none'; host.tabIndex = 0; host.style.cursor = 'grab';
  size(); requestAnimationFrame(frame);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; api.onLost && api.onLost(); });
  return api;
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
    exportGLB,
    createMapViewer,
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
        }).catch(e => { host.dataset.glb = 'failed'; console.warn('โหลด .glb ไม่สำเร็จ ใช้โมเดลจำลองแทน', e); host.dispatchEvent(new CustomEvent('glbfail')); });
      }
      if (!running) { running = true; requestAnimationFrame(frame); }
      return true;
    }
  };
})();

window.LopburiGL = GL;
