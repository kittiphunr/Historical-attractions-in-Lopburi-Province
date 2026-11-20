/* สร้างหน้าแยกของแต่ละสถานที่: places/<id>.html (+ sitemap.xml)
   ข้อมูลหลักมาจาก assets/js/data.js ; เนื้อหาเพิ่มเติม (รูปภาพ หัวข้อ ข้อมูล) ใส่ในไฟล์ content/places/<id>.json
   (ดูวิธีใน content/places/README.md) แล้วรัน:  npm run build:places   (npm run build รันให้อยู่แล้ว)
   หน้าที่สร้างเป็น HTML จริง (ไม่ต้องรอ JavaScript เพื่ออ่านเนื้อหา) จึงเหมาะกับ SEO และการแชร์ลิงก์ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://kittiphunr.github.io/Historical-attractions-in-Lopburi-Province/';
const read = (p) => readFileSync(join(root, p), 'utf8');

/* ---------- โหลดข้อมูลจาก data.js ---------- */
const ctx = { window: {} };
runInNewContext(read('assets/js/data.js'), ctx);
const A = ctx.window.ATTRACTIONS, S = ctx.window.SOURCES, SRC = Object.fromEntries(S.map(s => [s.id, s]));

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ERA_COLOR = { dvaravati: 'bg-sky-500/15 text-sky-700', khmer: 'bg-terra-500/10 text-terra-600', ayutthaya: 'bg-amber-500/15 text-amber-700', faith: 'bg-emerald-600/15 text-emerald-700' };
const GRAD = 'background:linear-gradient(145deg,#dc6f45,#a8431f)';
const icon = (name, cls = '') => `<i data-i="${name}" class="${cls}"></i>`;

/* ---------- ส่วนที่ใช้ร่วมกับหน้าแรก: ดึงจาก index.html ให้ตรงกันเสมอ ---------- */
const home = read('index.html');
const slice = (a, b) => { const i = home.indexOf(a), j = home.indexOf(b, i); if (i < 0 || j < 0) throw new Error('index.html เปลี่ยนโครงสร้าง: ไม่พบ ' + a); return home.slice(i, j); };
const toHome = (h) => h.replace(/href="#top"/g, 'href="index.html"').replace(/href="#([a-z0-9-]+)"/g, 'href="index.html#$1"');
const chrome = toHome(slice('<!-- ===== แถบเมนูซ้าย', '<main id="main"'));
const footer = slice('<footer', '</footer>') + '</footer>';
const arDialog = slice('<dialog id="arDialog"', '</dialog>') + '</dialog>';
const headFonts = slice('<link rel="preconnect" href="https://fonts.googleapis.com">', '<link rel="stylesheet" href="assets/tailwind.css">');
const themeScript = slice('<script>\n    (function () { var m;', '</head>');

/* ---------- เนื้อหาเพิ่มเติมของแต่ละสถานที่ ---------- */
function loadContent(id) {
  const f = join(root, 'content/places', id + '.json');
  if (!existsSync(f)) return { gallery: [], sections: [] };
  try { const c = JSON.parse(readFileSync(f, 'utf8')); return { hero: c.hero, gallery: c.gallery || [], sections: c.sections || [], facts: c.facts || [] }; }
  catch (e) { throw new Error(`content/places/${id}.json อ่านไม่ได้: ${e.message}`); }
}
const imgSrc = (id, src) => (/^(https?:)?\/\//.test(src) || src.startsWith('assets/')) ? src : `assets/places/${id}/${src}`;

const paras = (arr) => arr.map(t => `<p>${esc(t)}</p>`).join('');
const bullets = (arr, dot = 'bg-terra-400') => `<ul class="space-y-3">${arr.map(t => `<li class="flex gap-3"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}"></span><span>${esc(t)}</span></li>`).join('')}</ul>`;
const h2 = (t, n) => `<h2 class="flex items-center gap-3 text-2xl font-semibold text-ink-900 sm:text-3xl"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm text-white" style="${GRAD}">${n}</span>${esc(t)}</h2>`;
const credit = (p) => [p.author ? `ภาพ: ${esc(p.author)}` : 'ภาพ: เจ้าของโปรเจกต์',
  p.license ? (p.licenseUrl ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(p.licenseUrl)}">${esc(p.license)}</a>` : esc(p.license)) : '',
  p.sourceUrl ? `<a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(p.sourceUrl)}">ต้นฉบับ ↗</a>` : ''].filter(Boolean).join(' · ');

function figure(a, p, i) {
  const big = i === 0;
  return `<figure class="${big ? 'sm:col-span-2' : ''} overflow-hidden rounded-2xl bg-cream-50 shadow-neu"><img src="${esc(imgSrc(a.id, p.src))}" alt="${esc(p.alt || p.caption || a.name)}" loading="${big ? 'eager' : 'lazy'}" decoding="async" class="${big ? 'aspect-[16/10]' : 'aspect-[4/3]'} w-full object-cover">
    <figcaption class="px-4 py-3 text-xs leading-relaxed text-ink-500">${p.caption ? `<span class="block text-sm text-ink-700">${esc(p.caption)}</span>` : ''}${credit(p)}</figcaption></figure>`;
}
function gallery(a, c) {
  const photos = [...(a.photo ? [{ ...a.photo }] : []), ...c.gallery];
  if (!photos.length) return `<div class="rounded-2xl bg-cream-100 px-4 py-6 text-center text-xs text-ink-500 shadow-press"><p>ช่องภาพถ่ายจริง · ยังไม่ได้ใส่ภาพ</p><p class="mt-1 text-ink-400">ภาพที่ใส่ต้องมีผู้ถ่าย สัญญาอนุญาต และลิงก์ต้นทางใต้ภาพ</p></div>`;
  return `<div class="grid gap-4 sm:grid-cols-2">${photos.map((p, i) => figure(a, p, i)).join('')}</div>`;
}
function video(a) {
  const v = a.video;
  if (v.id) return `<div class="overflow-hidden rounded-2xl bg-cream-50 shadow-neu"><div class="aspect-video"><iframe class="h-full w-full" loading="lazy" src="https://www.youtube-nocookie.com/embed/${esc(v.id)}" title="${esc(v.title || a.name)}" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <p class="px-4 py-2 text-xs text-ink-500">วิดีโอ: ${esc(v.title || '')} · ช่อง ${esc(v.channel || '')} · <a class="underline" target="_blank" rel="noopener noreferrer" href="${esc(v.url)}">ดูบน YouTube ↗</a></p></div>`;
  return `<a class="btn-soft w-full !py-3 text-sm" target="_blank" rel="noopener noreferrer" href="${esc(v.search)}"><svg viewBox="0 0 24 24" class="h-5 w-5 fill-terra-500" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>ค้นวิดีโอแนะนำบน YouTube</a>
    <p class="mt-2 text-center text-[11px] text-ink-400">เปิดผลค้นหา “${esc(v.query)}” — วิดีโอทุกคลิปเป็นสิทธิ์ของเจ้าของช่อง ดูชื่อช่องในหน้าวิดีโอ</p>`;
}
function extraSection(a, s, n) {
  const body = (s.body || s.paragraphs || []);
  return `<section class="reveal">${h2(s.title, n)}<div class="mt-4 space-y-4 leading-relaxed text-ink-700">${paras(body)}${s.bullets && s.bullets.length ? bullets(s.bullets) : ''}</div>
    ${(s.images || []).length ? `<div class="mt-5 grid gap-4 sm:grid-cols-2">${s.images.map((p, i) => figure(a, p, 1 + i)).join('')}</div>` : ''}</section>`;
}
function miniMap(a) {
  if (!a.map) return '';
  return `<section class="reveal"><h2 class="eyebrow">ตำแหน่งในเมืองเก่า</h2>
    <div class="relative mt-3 overflow-hidden rounded-2xl shadow-neu"><img src="assets/img/lopburi-map-768.webp" alt="แผนที่ภาพเมืองเก่าลพบุรี" width="768" height="512" loading="lazy" class="map-img w-full">
      <span class="absolute -translate-x-1/2 -translate-y-1/2" style="left:${a.map[0]}%;top:${a.map[1]}%"><span class="absolute inset-0 -m-2 animate-ping rounded-full bg-terra-400/40"></span><span class="relative grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-terra-500 text-sm font-semibold text-white shadow-dark">${a.no}</span></span></div>
    <a href="index.html#map" class="mt-3 inline-flex items-center gap-1 text-sm text-terra-600 underline-offset-4 hover:underline">ดูแผนที่ทั้งจังหวัด ${icon('arrow', 'h-4 w-4')}</a></section>`;
}

function page(a, idx) {
  const c = loadContent(a.id);
  const prev = A[(idx + A.length - 1) % A.length], next = A[(idx + 1) % A.length];
  const url = `${SITE}places/${a.id}.html`;
  const title = `${a.name} — ลพบุรี เมืองสามยุค`;
  const ld = { '@context': 'https://schema.org', '@type': 'TouristAttraction', name: a.name, alternateName: a.en, description: a.summary, url, image: SITE + 'assets/img/og-cover.jpg', address: { '@type': 'PostalAddress', addressRegion: 'ลพบุรี', addressCountry: 'TH' } };
  const extraStart = 5;
  const factsAll = [...a.facts, ...(c.facts || [])];
  const hasGlb = !!a.glb;
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <base href="../">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(a.tagline + ' — ' + a.summary).slice(0, 300)}">
  <meta name="theme-color" content="#f4ece2">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(a.tagline)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}assets/img/og-cover.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/png" href="assets/img/favicon-64.png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  ${headFonts}<link rel="stylesheet" href="assets/tailwind.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  ${themeScript}</head>
<body class="relative overflow-x-hidden pb-28 lg:pb-10" data-place="${a.id}">
  <a href="places/${a.id}.html#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-terra-500 focus:px-4 focus:py-2 focus:text-white">ข้ามไปยังเนื้อหา</a>

  ${chrome}<main id="main" class="mx-auto max-w-6xl px-4 pt-20 lg:pl-[112px] lg:pr-6">
    <nav aria-label="ตำแหน่งหน้า" class="text-sm text-ink-500"><ol class="flex flex-wrap items-center gap-2">
      <li><a class="hover:text-terra-600" href="index.html">หน้าแรก</a></li><li aria-hidden="true">/</li>
      <li><a class="hover:text-terra-600" href="index.html#places">10 แห่ง</a></li><li aria-hidden="true">/</li>
      <li aria-current="page" class="text-ink-900">${esc(a.name)}</li></ol></nav>

    <div class="mt-6 grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
      <!-- คอลัมน์ซ้าย: 3 มิติ + ภาพ + วิดีโอ -->
      <div class="space-y-6 lg:col-span-5 lg:sticky lg:top-6">
        <div class="card overflow-hidden p-0">
          <div class="stage-bg relative overflow-hidden rounded-[1.75rem]">
            <span class="absolute left-5 top-3 z-10 text-6xl font-semibold text-terra-500/20">${a.no}</span>
            <div id="placeModel" class="model relative h-[340px] sm:h-[420px]" aria-label="โมเดล 3 มิติจำลอง ${esc(a.name)} ลากเพื่อหมุน"></div>
            <p class="relative px-4 pt-1 text-center text-[11px] text-ink-500"><span data-hint class="hidden">↻ ลาก / ปุ่มลูกศร เพื่อหมุน · ดับเบิลคลิกรีเซ็ต</span>${hasGlb ? `<span class="block">${esc(a.glb.credit)}</span>` : '<span class="block">แบบจำลองเรียบง่าย (สร้างด้วยโค้ด)</span>'}</p>
            <div class="relative flex justify-center pb-4 pt-2"><button type="button" data-ar="${a.id}" class="btn-soft !px-4 !py-2 text-sm">${icon('cube', 'h-4 w-4 text-terra-500')}ดูแบบ AR</button></div>
          </div>
        </div>
        <div class="space-y-4">${video(a)}</div>
        ${miniMap(a)}
      </div>

      <!-- คอลัมน์ขวา: ข้อมูล -->
      <article class="min-w-0 space-y-12 lg:col-span-7">
        <header>
          <span class="inline-block rounded-full px-3 py-1 text-xs font-medium ${ERA_COLOR[a.era]}">${esc(a.eraLabel)}</span>
          <h1 class="mt-4 text-4xl font-semibold sm:text-5xl">${esc(a.name)}</h1>
          <p class="mt-1 text-sm tracking-widest text-terra-500">${esc(a.en)}</p>
          <p class="mt-5 text-xl font-medium leading-snug text-ink-900">${esc(a.tagline)}</p>
          <p class="mt-3 leading-relaxed text-ink-500">${esc(a.summary)}</p>
          <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">${factsAll.map(([k, v]) => `<div class="neu p-3"><dt class="text-[11px] uppercase tracking-wider text-terra-500">${esc(k)}</dt><dd class="mt-1 text-sm font-medium text-ink-900">${esc(v)}</dd></div>`).join('')}</dl>
        </header>

        <section class="reveal">${h2('ภาพถ่าย', '01')}<div class="mt-4">${gallery(a, c)}</div></section>
        <section class="reveal">${h2('ประวัติศาสตร์', '02')}<div class="mt-4 space-y-4 leading-relaxed text-ink-700">${paras(a.history)}</div></section>
        <section class="reveal">${h2('สถาปัตยกรรม', '03')}<div class="mt-4 space-y-4 leading-relaxed text-ink-700">${paras(a.architecture)}</div></section>
        <section class="reveal">${h2('ไฮไลต์', '04')}<div class="mt-4 leading-relaxed text-ink-700">${bullets(a.highlights)}</div></section>
        <section class="reveal">${h2('เตรียมตัวไป', '05')}<div class="mt-4 leading-relaxed text-ink-700">${bullets(a.visit, 'bg-amber-500')}</div></section>
        ${c.sections.map((s, i) => extraSection(a, s, String(extraStart + 1 + i).padStart(2, '0'))).join('\n        ')}

        <section class="reveal border-t border-cream-200 pt-6">
          <p class="mb-3 text-xs uppercase tracking-wider text-terra-500">แหล่งอ้างอิง</p>
          <div class="flex flex-wrap gap-2">${a.sources.map(id => `<a class="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-700 shadow-neu hover:text-terra-600" target="_blank" rel="noopener noreferrer" href="${esc(SRC[id].url)}" title="${esc(SRC[id].name)}">${esc(SRC[id].name.split(' — ')[0])} ↗</a>`).join('')}</div>
        </section>

        <section class="reveal card p-6 text-center sm:p-8">
          <p class="text-lg font-medium text-ink-900">เคยไปที่นี่ไหม?</p>
          <a href="index.html#guestbook" class="btn-terra mt-4">${icon('book', 'h-5 w-5')}เขียนสมุดเยี่ยม</a>
        </section>
      </article>
    </div>

    <nav aria-label="สถานที่ก่อนหน้าและถัดไป" class="mt-16 grid gap-4 sm:grid-cols-2">
      <a href="places/${prev.id}.html" rel="prev" class="neu flex items-center gap-4 p-4 hover:-translate-y-0.5"><span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white" style="${GRAD}">${prev.no}</span><span class="min-w-0"><span class="block text-xs text-ink-500">← สถานที่ก่อนหน้า</span><b class="block truncate font-medium text-ink-900">${esc(prev.name)}</b></span></a>
      <a href="places/${next.id}.html" rel="next" class="neu flex items-center justify-end gap-4 p-4 text-right hover:-translate-y-0.5"><span class="min-w-0"><span class="block text-xs text-ink-500">สถานที่ถัดไป →</span><b class="block truncate font-medium text-ink-900">${esc(next.name)}</b></span><span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white" style="${GRAD}">${next.no}</span></a>
    </nav>
  </main>

  ${footer}

  ${arDialog}

  <script src="assets/js/config.js"></script>
  <script src="assets/js/data.js"></script>
  <script src="assets/js/models.js"></script>
  <script src="assets/js/three-scenes.js"></script>
  <script src="assets/js/motion.js"></script>
  <script src="assets/js/i18n.js"></script>
  <script src="assets/js/common.js"></script>
  <script src="assets/js/place.js"></script>
</body>
</html>
`;
}

mkdirSync(join(root, 'places'), { recursive: true });
A.forEach((a, i) => { writeFileSync(join(root, 'places', a.id + '.html'), page(a, i)); });
// ลบหน้าที่ไม่มีสถานที่แล้ว (เช่น เปลี่ยน id)
for (const f of readdirSync(join(root, 'places'))) if (f.endsWith('.html') && !A.some(a => a.id + '.html' === f)) console.warn('หมายเหตุ: places/' + f + ' ไม่มีใน data.js แล้ว (ลบเองได้)');

const urls = [SITE, ...A.map(a => `${SITE}places/${a.id}.html`)];
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`places: ${A.length} หน้า -> places/*.html, sitemap.xml, robots.txt`);
