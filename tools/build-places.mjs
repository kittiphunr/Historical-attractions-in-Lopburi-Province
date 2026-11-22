/* สร้างหน้าแยกของแต่ละสถานที่: places/<id>.html (+ sitemap.xml)
   ข้อมูลหลักมาจาก assets/js/data.js ; เนื้อหาเพิ่มเติม (รูปภาพ หัวข้อ ข้อมูล) ใส่ในไฟล์ content/places/<id>.json
   (ดูวิธีใน content/places/README.md) แล้วรัน:  npm run build:places   (npm run build รันให้อยู่แล้ว)
   หน้าที่สร้างเป็น HTML จริง (ไม่ต้องรอ JavaScript เพื่ออ่านเนื้อหา) จึงเหมาะกับ SEO และการแชร์ลิงก์ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join, dirname, resolve } from 'node:path';
import { loadDict, makeTranslator } from './lib/i18n-node.mjs';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ที่อยู่หลักของเว็บ (canonical/hreflang/og:url/JSON-LD/sitemap) และที่อยู่ของภาพแชร์ลิงก์ ตั้งใน site.config.json
const cfg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'site.config.json'), 'utf8'));
const SITE = cfg.canonicalUrl, IMG = cfg.previewUrl;
const read = (p) => readFileSync(join(root, p), 'utf8');

/* ---------- หน้าแยกตามภาษา: th = ราก, en/zh/ja = โฟลเดอร์ en/ zh/ ja/ (สร้างจากหน้าไทยด้วยตัวแปลฝั่ง Node) ---------- */
const LANG = {
  th: { html: 'th', hreflang: 'th', og: 'th_TH', prefix: '' },
  en: { html: 'en', hreflang: 'en', og: 'en_US', prefix: 'en/' },
  zh: { html: 'zh-Hans', hreflang: 'zh-Hans', og: 'zh_CN', prefix: 'zh/' },
  ja: { html: 'ja', hreflang: 'ja', og: 'ja_JP', prefix: 'ja/' }
};
const OTHER = Object.keys(LANG).filter(c => c !== 'th');
/** ลิงก์ hreflang ของหน้าหนึ่ง (rel = เส้นทางสัมพัทธ์ เช่น 'places/sam-yot.html', หน้าแรก = '') */
const hreflangLinks = (rel) => Object.entries(LANG).map(([c, l]) => `<link rel="alternate" hreflang="${l.hreflang}" href="${SITE}${l.prefix}${rel}">`)
  .concat(`<link rel="alternate" hreflang="x-default" href="${SITE}${rel}">`).join('\n  ');

/* ---------- โหลดข้อมูลจาก data.js ---------- */
const ctx = { window: {} };
runInNewContext(read('assets/js/data.js'), ctx);
const A = ctx.window.ATTRACTIONS, S = ctx.window.SOURCES, SRC = Object.fromEntries(S.map(s => [s.id, s]));

const ogExtra = ['<meta property="og:site_name" content="ลพบุรี เมืองสามยุค">', '<meta property="og:locale" content="th_TH">', '<meta property="og:locale:alternate" content="en_US">', '<meta property="og:locale:alternate" content="zh_CN">', '<meta property="og:locale:alternate" content="ja_JP">'].join('\n  ');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ERA_COLOR = { dvaravati: 'bg-sky-500/15 text-sky-700', khmer: 'bg-terra-500/10 text-terra-600', ayutthaya: 'bg-amber-500/15 text-amber-700', faith: 'bg-emerald-600/15 text-emerald-700', nature: 'bg-teal-600/15 text-teal-700' };
const GRAD = 'background:linear-gradient(145deg,#dc6f45,#a8431f)';
const icon = (name, cls = '') => `<i data-i="${name}" class="${cls}"></i>`;

/* ---------- ส่วนที่ใช้ร่วมกับหน้าแรก: ดึงจาก index.html ให้ตรงกันเสมอ ---------- */
const home = read('index.html');
const slice = (a, b) => { const i = home.indexOf(a), j = home.indexOf(b, i); if (i < 0 || j < 0) throw new Error('index.html เปลี่ยนโครงสร้าง: ไม่พบ ' + a); return home.slice(i, j); };
const toHome = (h) => h.replace(/href="#top"/g, 'href="index.html"').replace(/href="#([a-z0-9-]+)"/g, 'href="index.html#$1"');
const chrome = toHome(slice('<!-- ===== แถบเมนูซ้าย', '<main id="main"'));
const footer = toHome(slice('<footer', '</footer>') + '</footer>');
const creditsDialog = slice('<dialog id="creditsDialog"', '</dialog>') + '</dialog>';
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
  const big = i === 0, alt = p.alt || p.caption || a.name;
  return `<figure class="${big ? 'sm:col-span-2' : ''} overflow-hidden rounded-2xl bg-cream-50 shadow-neu">
    <button type="button" data-lb class="group relative block w-full cursor-zoom-in overflow-hidden outline-offset-[-4px]" aria-haspopup="dialog" aria-label="ขยายรูป: ${esc(p.caption || alt)}">
      <img src="${esc(imgSrc(a.id, p.src))}" alt="${esc(alt)}" loading="${big ? 'eager' : 'lazy'}" decoding="async" class="${big ? 'aspect-[16/10]' : 'aspect-[4/3]'} w-full object-cover transition duration-500 group-hover:scale-[1.03]">
      <span class="pointer-events-none absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-char-900/60 text-snow-50 opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/></svg></span>
    </button>
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
/* ลิงก์ Google Maps: ถ้าใส่ coords: [lat, lng] ใน data.js จะนำทางไปพิกัดนั้น ไม่เช่นนั้นค้นจากชื่อสถานที่ + "ลพบุรี" */
function mapsLinks(a) {
  const q = a.coords ? `${a.coords[0]},${a.coords[1]}` : `${a.name} ลพบุรี`;
  const e = encodeURIComponent(q);
  return { dir: `https://www.google.com/maps/dir/?api=1&destination=${e}`, view: `https://www.google.com/maps/search/?api=1&query=${e}` };
}
function travelBlock(a) {
  const m = mapsLinks(a);
  return `<section class="reveal card p-5"><h2 class="eyebrow">เดินทางไปที่นี่</h2>
    <div class="mt-3 flex flex-wrap gap-3">
      <a class="btn-terra !px-5 !py-2.5 text-sm" target="_blank" rel="noopener noreferrer" href="${esc(m.dir)}">${icon('pin', 'h-4 w-4')}นำทางด้วย Google Maps ↗</a>
      <a class="btn-soft !px-5 !py-2.5 text-sm" target="_blank" rel="noopener noreferrer" href="${esc(m.view)}">ดูบนแผนที่ ↗</a>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-ink-400">ลิงก์เปิด Google Maps ในแท็บใหม่ ตำแหน่งค้นจากชื่อสถานที่ โปรดตรวจสอบเวลาเปิดและการเดินทางก่อนไป</p></section>`;
}

function miniMap(a) {
  if (!a.map) return '';
  return `<section class="reveal"><h2 class="eyebrow">ตำแหน่งบนแผนที่</h2>
    <div class="relative mt-3 overflow-hidden rounded-2xl shadow-neu"><img src="assets/img/lopburi-map-768.webp" alt="แผนที่ท่องเที่ยวลพบุรีแบบภาพ (แผนผัง ไม่ตรงมาตราส่วนจริง)" width="768" height="512" loading="lazy" class="map-img w-full">
      <span class="absolute -translate-x-1/2 -translate-y-1/2" style="left:${a.map[0]}%;top:${a.map[1]}%"><span class="absolute inset-0 -m-2 animate-ping rounded-full bg-terra-400/40"></span><span class="relative grid h-9 w-9 place-items-center rounded-full border-2 border-white ${a.era === 'nature' || a.era === 'faith' ? 'bg-[#1f4f9a]' : 'bg-terra-500'} text-sm font-semibold text-white shadow-dark">${Number(a.no)}</span></span></div>
    <a href="index.html#map" class="mt-3 inline-flex items-center gap-1 text-sm text-terra-600 underline-offset-4 hover:underline">ดูแผนที่ทั้งจังหวัด ${icon('arrow', 'h-4 w-4')}</a></section>`;
}

const lightbox = `<dialog id="lightbox" class="m-auto w-[min(96vw,1280px)] max-h-[96vh] overflow-hidden rounded-[1.5rem] border-0 bg-char-900 p-0 text-snow-50 shadow-dark backdrop:bg-black/80 backdrop:backdrop-blur-sm" aria-label="ภาพขยาย">
    <div class="flex max-h-[96vh] flex-col">
      <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <p id="lbCount" class="text-sm text-snow-200" aria-live="polite"></p>
        <div class="ml-auto flex items-center gap-2">
          <button id="lbZoomOut" type="button" class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-snow-50 transition hover:bg-white/20 disabled:opacity-40" aria-label="ซูมออก"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8 11h6"/></svg></button>
          <button id="lbZoomReset" type="button" class="h-10 min-w-[3.5rem] rounded-full bg-white/10 px-3 text-sm tabular-nums text-snow-50 transition hover:bg-white/20" aria-label="กลับขนาดเดิม">100%</button>
          <button id="lbZoomIn" type="button" class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-snow-50 transition hover:bg-white/20 disabled:opacity-40" aria-label="ซูมเข้า"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/></svg></button>
        </div>
        <button id="lbClose" type="button" class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-snow-50 transition hover:bg-white/20" aria-label="ปิดภาพ"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div id="lbStage" class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-16" style="touch-action:none">
        <button id="lbPrev" type="button" class="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-snow-50 transition hover:bg-white/25 sm:left-4" aria-label="ภาพก่อนหน้า"><svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <img id="lbImg" alt="" draggable="false" class="max-h-[70vh] w-auto max-w-full cursor-zoom-in select-none rounded-lg object-contain opacity-0" style="transition:opacity .2s;will-change:transform">
        <button id="lbNext" type="button" class="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-snow-50 transition hover:bg-white/25 sm:right-4" aria-label="ภาพถัดไป"><svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
      <div id="lbCap" class="max-h-[22vh] overflow-y-auto px-5 pb-5 pt-3 text-center text-sm leading-relaxed text-snow-200 [&_a]:text-snow-50 [&_a]:underline [&_span]:text-snow-50"></div>
    </div>
  </dialog>`;

function page(a, idx) {
  const c = loadContent(a.id);
  const prev = A[(idx + A.length - 1) % A.length], next = A[(idx + 1) % A.length];
  const url = `${SITE}places/${a.id}.html`;
  const ogImg = existsSync(join(root, 'assets/og', a.id + '.jpg')) ? `${IMG}assets/og/${a.id}.jpg` : `${IMG}assets/img/og-cover.jpg`;
  const title = `${a.name} — ลพบุรี เมืองสามยุค`;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'TouristAttraction', '@id': url + '#place', name: a.name, alternateName: a.en, description: a.summary, url, image: ogImg, inLanguage: 'th', mainEntityOfPage: url,
      isPartOf: { '@type': 'TouristDestination', name: 'จังหวัดลพบุรี', url: SITE }, address: { '@type': 'PostalAddress', addressRegion: 'ลพบุรี', addressCountry: 'TH' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE },
      { '@type': 'ListItem', position: 2, name: '12 แห่ง', item: SITE + '#places' },
      { '@type': 'ListItem', position: 3, name: a.name, item: url }] }] };
  const extraStart = 5;
  const factsAll = [...a.facts, ...(c.facts || [])];
  const hasGlb = !!a.glb;
  return `<!doctype html>
<html lang="th" data-alts="1" data-rel="places/${a.id}.html" data-prefix="">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <base href="../">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(a.tagline + ' — ' + a.summary)}">
  <meta name="theme-color" content="#f4ece2">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(a.tagline)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${ogImg}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(a.name)} — ${esc(a.en)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ogImg}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  ${ogExtra}
  <link rel="canonical" href="${url}">
  ${hreflangLinks(`places/${a.id}.html`)}
  <link rel="icon" type="image/png" href="assets/img/favicon-64.png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  ${headFonts}<link rel="stylesheet" href="assets/tailwind.css">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  ${themeScript}
</head>
<body class="relative overflow-x-hidden pb-28 lg:pb-10" data-place="${a.id}">
  <a href="places/${a.id}.html#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-terra-500 focus:px-4 focus:py-2 focus:text-white">ข้ามไปยังเนื้อหา</a>

  ${chrome}<main id="main" class="mx-auto max-w-6xl px-4 pt-20 lg:pl-[112px] lg:pr-6">
    <nav aria-label="ตำแหน่งหน้า" class="text-sm text-ink-500"><ol class="flex flex-wrap items-center gap-2">
      <li><a class="hover:text-terra-600" href="index.html">หน้าแรก</a></li><li aria-hidden="true">/</li>
      <li><a class="hover:text-terra-600" href="index.html#places">12 แห่ง</a></li><li aria-hidden="true">/</li>
      <li aria-current="page" class="text-ink-900">${esc(a.name)}</li></ol></nav>

    <div class="mt-6 grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
      <!-- คอลัมน์ซ้าย: 3 มิติ + ภาพ + วิดีโอ -->
      <div class="space-y-6 lg:col-span-5 lg:sticky lg:top-6">
        <div class="card overflow-hidden p-0">
          <div class="stage-bg relative overflow-hidden rounded-[1.75rem]">
            <span class="absolute left-5 top-3 z-10 text-6xl font-semibold text-terra-500/20">${a.no}</span>
            ${hasGlb ? `<div id="placeModel" class="model relative h-[340px] sm:h-[420px]" aria-label="โมเดล 3 มิติจำลอง ${esc(a.name)} ลากเพื่อหมุน"></div>` : `<div class="relative grid h-[340px] place-items-center px-6 text-center sm:h-[420px]" role="img" aria-label="${esc(a.name)} — โมเดล 3 มิติกำลังจัดทำ">${icon('cube', 'mx-auto h-14 w-14 text-terra-500/40')}<p class="mt-3 text-sm text-ink-500">โมเดล 3 มิติกำลังจัดทำ</p></div>`}
            ${hasGlb ? `<p class="relative px-4 pt-1 text-center text-[11px] text-ink-500"><span data-hint class="hidden">↻ ลาก / ปุ่มลูกศร เพื่อหมุน · ดับเบิลคลิกรีเซ็ต</span><span class="block">${esc(a.glb.credit)}</span></p>
            <div class="relative flex justify-center pb-4 pt-2"><button type="button" data-ar="${a.id}" class="btn-soft !px-4 !py-2 text-sm">${icon('cube', 'h-4 w-4 text-terra-500')}ดูแบบ AR</button></div>` : '<div class="pb-4"></div>'}
          </div>
        </div>
        ${travelBlock(a)}
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
          <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">${factsAll.map(([k, v]) => `<div class="neu p-3"><dt class="text-[11px] uppercase tracking-wider text-terra-600">${esc(k)}</dt><dd class="mt-1 text-sm font-medium text-ink-900">${esc(v)}</dd></div>`).join('')}</dl>
        </header>

        <section class="reveal">${h2('ภาพถ่าย', '01')}<div class="mt-4">${gallery(a, c)}</div></section>
        <section class="reveal">${h2('ประวัติศาสตร์', '02')}<div class="mt-4 space-y-4 leading-relaxed text-ink-700">${paras(a.history)}</div></section>
        <section class="reveal">${h2(a.archTitle || 'สถาปัตยกรรม', '03')}<div class="mt-4 space-y-4 leading-relaxed text-ink-700">${paras(a.architecture)}</div></section>
        <section class="reveal">${h2('ไฮไลต์', '04')}<div class="mt-4 leading-relaxed text-ink-700">${bullets(a.highlights)}</div></section>
        <section class="reveal">${h2('เตรียมตัวไป', '05')}<div class="mt-4 leading-relaxed text-ink-700">${bullets(a.visit, 'bg-amber-500')}</div></section>
        ${c.sections.map((s, i) => extraSection(a, s, String(extraStart + 1 + i).padStart(2, '0'))).join('\n        ')}

        <!-- รีวิวจากผู้เข้าชม: ซ่อนไว้จนกว่า assets/js/reviews.js จะโหลดรีวิวได้ (ต้องตั้ง reviewsApi ใน assets/js/config.js) -->
        <section id="reviews" class="card hidden p-6 sm:p-8" aria-label="รีวิวจากผู้เข้าชม">
          ${h2('รีวิวจากผู้เข้าชม', String(extraStart + 1 + c.sections.length).padStart(2, '0'))}
          <div id="rvSummary" class="mt-5 flex flex-wrap items-center gap-4" aria-live="polite"></div>
          <ul id="rvList" class="mt-5 space-y-4"></ul>
          <div class="mt-4 text-center"><button id="rvMore" type="button" class="btn-soft hidden !px-5 !py-2.5 text-sm">ดูรีวิวเพิ่มเติม</button></div>
          <form id="rvForm" class="mt-8 space-y-4 border-t border-cream-200 pt-6" novalidate>
            <h3 class="text-lg font-semibold text-ink-900">เขียนรีวิวสถานที่นี้</h3>
            <div><label for="rvName" class="mb-1 block text-sm text-ink-700">ชื่อที่แสดง</label><input id="rvName" name="name" maxlength="40" autocomplete="nickname" class="field"></div>
            <div><span id="rvStarsLabel" class="mb-1 block text-sm text-ink-700">ให้คะแนน</span><div id="rvStars" role="radiogroup" aria-labelledby="rvStarsLabel" class="flex gap-1 text-3xl"></div></div>
            <div><label for="rvMsg" class="mb-1 block text-sm text-ink-700">รีวิวของคุณ</label><textarea id="rvMsg" name="message" rows="4" maxlength="500" class="field resize-y"></textarea></div>
            <input type="text" name="website" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
            <button type="submit" class="btn-terra">ส่งรีวิว</button>
            <p id="rvStatus" role="status" class="text-sm"></p>
            <p class="text-xs leading-relaxed text-ink-400">ชื่อและข้อความที่ส่งจะแสดงให้ผู้เข้าชมทุกคนเห็นหลังผู้ดูแลตรวจสอบ กรุณาอย่าใส่ข้อมูลส่วนตัว เช่น เบอร์โทรหรืออีเมล <a href="privacy.html" class="underline hover:text-terra-600">นโยบายความเป็นส่วนตัว</a></p>
          </form>
        </section>

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

  ${creditsDialog}

  ${lightbox}

  ${arDialog}

  <script src="assets/js/config.js"></script>
  <script src="assets/js/data.js"></script>
  <script src="assets/js/models.js"></script>
  <script src="assets/js/motion.js"></script>
  <script src="assets/js/i18n.js"></script>
  <script src="assets/js/common.js"></script>
  <script src="assets/js/place.js"></script>
  <script src="assets/js/captcha.js"></script>
  <script src="assets/js/reviews.js"></script>
</body>
</html>
`;
}

/* ---------- หน้านโยบายความเป็นส่วนตัว (privacy.html) จาก content/privacy.json ---------- */
function privacyPage() {
  const P = JSON.parse(read('content/privacy.json'));
  const url = SITE + 'privacy.html', title = `${P.title.th} — ลพบุรี เมืองสามยุค`;
  const intro = P.intro.map(x => `<p class="text-lg leading-relaxed text-ink-700">${esc(x.th)}</p>`).join('');
  const sec = P.sections.map((s, i) => `<section class="card p-6 sm:p-8">
        ${h2(s.h.th, String(i + 1).padStart(2, '0'))}
        <div class="mt-4 space-y-4 leading-relaxed text-ink-700">${(s.p || []).map(x => `<p>${esc(x.th)}</p>`).join('')}${s.ul ? bullets(s.ul.map(x => x.th)) : ''}</div>
      </section>`).join('\n      ');
  const C = P.contactBlock;
  const extra = [P.contact && P.contact.email ? `<li><b class="text-ink-900">${esc(C.emailLabel.th)}:</b> <a class="text-terra-600 underline" href="mailto:${esc(P.contact.email)}">${esc(P.contact.email)}</a></li>` : '',
    P.contact && P.contact.other ? `<li><b class="text-ink-900">${esc(C.otherLabel.th)}:</b> ${esc(P.contact.other)}</li>` : ''].filter(Boolean).join('');
  return `<!doctype html>
<html lang="th" data-alts="1" data-rel="privacy.html" data-prefix="">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(P.intro[0].th)}">
  <meta name="theme-color" content="#f4ece2">
  <meta name="robots" content="index,follow">
  ${ogExtra}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${IMG}assets/img/og-cover.jpg">
  <link rel="canonical" href="${url}">
  ${hreflangLinks('privacy.html')}
  <link rel="icon" type="image/png" href="assets/img/favicon-64.png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  ${headFonts}<link rel="stylesheet" href="assets/tailwind.css">
  ${themeScript}
</head>
<body class="relative overflow-x-hidden pb-28 lg:pb-10" data-page="privacy">
  <a href="privacy.html#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-terra-500 focus:px-4 focus:py-2 focus:text-white">ข้ามไปยังเนื้อหา</a>

  ${chrome}<main id="main" class="mx-auto max-w-3xl px-4 pt-20 lg:pl-[112px] lg:pr-6">
    <a href="index.html" class="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-terra-600">${esc(P.back.th)}</a>
    <header class="mt-6">
      <p class="eyebrow">Privacy</p>
      <h1 class="mt-2 text-4xl font-semibold sm:text-5xl">${esc(P.title.th)}</h1>
      <p class="mt-2 text-sm text-ink-400">${esc(P.updated.th)}</p>
      <div class="mt-6 space-y-3">${intro}</div>
    </header>
    <div class="mt-10 space-y-6">
      ${sec}
      <section class="card p-6 sm:p-8">
        <h2 class="text-2xl font-semibold text-ink-900 sm:text-3xl">${esc(C.h.th)}</h2>
        <p class="mt-4 leading-relaxed text-ink-700">${esc(C.p.th)}</p>
        <ul class="mt-4 space-y-2 text-ink-700">${extra}</ul>
        <a class="btn-soft mt-5 !px-5 !py-2.5 text-sm" target="_blank" rel="noopener noreferrer" href="${esc(C.url)}">${esc(C.link.th)}</a>
      </section>
    </div>
  </main>

  ${footer}

  ${creditsDialog}

  ${arDialog}

  <script src="assets/js/config.js"></script>
  <script src="assets/js/data.js"></script>
  <script src="assets/js/motion.js"></script>
  <script src="assets/js/i18n.js"></script>
  <script src="assets/js/common.js"></script>
  <script src="assets/js/place.js"></script>
</body>
</html>
`;
}

/* ---------- หน้า 404 (404.html): GitHub Pages ใช้ไฟล์นี้กับทุกที่อยู่ที่ไม่มีอยู่ ---------- */
function notFoundPage() {
  const N = JSON.parse(read('content/404.json'));
  const list = A.map(a => `<li><a href="places/${a.id}.html" class="neu flex items-center gap-3 p-3 text-left hover:-translate-y-0.5"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white" style="${GRAD}">${a.no}</span><span class="min-w-0"><b class="block truncate text-sm font-medium text-ink-900">${esc(a.name)}</b><span class="block truncate text-xs text-ink-500">${esc(a.eraLabel)}</span></span></a></li>`).join('');
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <script>
    // หน้านี้ถูกเสิร์ฟที่ที่อยู่ใดก็ได้ จึงกำหนด base ให้ลิงก์/ไฟล์แบบสัมพัทธ์ชี้ที่รากของเว็บเสมอ (GitHub Pages โปรเจกต์: /ชื่อโปรเจกต์/)
    (function () { var p = location.pathname.split('/'); var base = /\\.github\\.io$/i.test(location.hostname) && p[1] ? '/' + p[1] + '/' : '/'; document.write('<base href="' + base + '">'); })();
  </script>
  <title>${esc(N.title.th)} — ลพบุรี เมืองสามยุค</title>
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#f4ece2">
  <link rel="icon" type="image/png" href="assets/img/favicon-64.png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  ${headFonts}<link rel="stylesheet" href="assets/tailwind.css">
  ${themeScript}
</head>
<body class="relative overflow-x-hidden pb-28 lg:pb-10" data-page="404">
  ${chrome}<main id="main" class="mx-auto max-w-3xl px-4 pt-24 text-center lg:pl-[112px] lg:pr-6">
    <img src="assets/img/seal-384.png" alt="ตราประจำจังหวัดลพบุรี" width="384" height="373" class="mx-auto h-28 w-auto drop-shadow-lg">
    <p class="mt-6 bg-gradient-to-b from-terra-400 to-terra-700 bg-clip-text text-8xl font-semibold leading-none text-transparent sm:text-9xl" aria-hidden="true">404</p>
    <h1 class="mt-4 text-3xl font-semibold sm:text-4xl">${esc(N.title.th)}</h1>
    <p class="mx-auto mt-4 max-w-xl leading-relaxed text-ink-500">${esc(N.lead.th)}</p>
    <div id="nfSuggest" class="card mx-auto mt-6 hidden max-w-md p-4 text-sm"><p class="text-ink-500">${esc(N.didYouMean.th)}</p><a id="nfSuggestLink" class="mt-1 inline-block text-lg font-medium text-terra-600 underline-offset-4 hover:underline" href="index.html"></a></div>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <a href="index.html" class="btn-terra">${icon('home', 'h-5 w-5')}${esc(N.home.th)}</a>
      <a href="index.html#places" class="btn-soft">${icon('landmark', 'h-5 w-5 text-terra-500')}${esc(N.places.th)}</a>
    </div>
    <h2 class="mt-14 text-sm uppercase tracking-wider text-terra-500">${esc(N.pick.th)}</h2>
    <ul class="mt-4 grid gap-3 sm:grid-cols-2">${list}</ul>
  </main>

  ${footer}

  ${creditsDialog}

  ${arDialog}

  <script src="assets/js/config.js"></script>
  <script src="assets/js/data.js"></script>
  <script src="assets/js/motion.js"></script>
  <script src="assets/js/i18n.js"></script>
  <script src="assets/js/common.js"></script>
  <script src="assets/js/place.js"></script>
</body>
</html>
`;
}

/* ---------- ส่วนที่สร้างลงใน index.html: ข้อมูลโครงสร้าง (JSON-LD), hreflang และรายการสถานที่สำหรับผู้ที่ปิด JavaScript ---------- */
function injectBlock(html, name, content) {
  const a = `<!--${name}:start-->`, z = `<!--${name}:end-->`, i = html.indexOf(a), j = html.indexOf(z);
  if (i < 0 || j < 0) throw new Error(`index.html ไม่มีเครื่องหมาย ${a} ... ${z}`);
  return html.slice(0, i + a.length) + content + html.slice(j);
}
function homeBlocks() {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'ลพบุรี เมืองสามยุค', url: SITE, inLanguage: ['th', 'en', 'zh-Hans', 'ja'] },
    { '@context': 'https://schema.org', '@type': 'TouristDestination', name: 'จังหวัดลพบุรี', alternateName: 'Lopburi Province', description: 'สำรวจ 10 แหล่งประวัติศาสตร์เมืองสามยุคของลพบุรี: ทวารวดี ขอม อยุธยา', url: SITE, image: IMG + 'assets/img/og-cover.jpg', inLanguage: 'th',
      containsPlace: A.map(a => ({ '@type': 'TouristAttraction', name: a.name, alternateName: a.en, url: `${SITE}places/${a.id}.html` })) }
  ];
  const nolist = `<noscript><nav aria-label="สถานที่ทั้ง 12 แห่ง" class="mt-6"><ul class="grid gap-2 sm:grid-cols-2">${A.map(a => `<li><a class="underline" href="places/${a.id}.html">${esc(a.no)} ${esc(a.name)} — ${esc(a.tagline)}</a></li>`).join('')}</ul></nav></noscript>`;
  return { jsonld: `\n  <script type="application/ld+json">${JSON.stringify(ld)}</script>\n  `, nolist, hreflang: '\n  ' + hreflangLinks('') + '\n  ' };
}
let homeThai;
{
  const f = join(root, 'index.html'), cur = readFileSync(f, 'utf8'), hb = homeBlocks();
  homeThai = injectBlock(injectBlock(injectBlock(cur, 'jsonld', hb.jsonld), 'nolist', hb.nolist), 'hreflang', hb.hreflang);
  if (homeThai !== cur) writeFileSync(f, homeThai);
}

/* ---------- หน้าคำถามที่พบบ่อย (faq.html) จาก content/faq.json ---------- */
function faqPage() {
  const F = JSON.parse(read('content/faq.json'));
  const url = SITE + 'faq.html', title = `${F.title.th} — ลพบุรี เมืองสามยุค`;
  const intro = F.intro.map(x => `<p class="text-lg leading-relaxed text-ink-700">${esc(x.th)}</p>`).join('');
  let n = 0;
  const groups = F.groups.map(g => `<section aria-labelledby="faq-g${++n}">
        <h2 id="faq-g${n}" class="text-2xl font-semibold text-ink-900 sm:text-3xl">${esc(g.h.th)}</h2>
        <div class="mt-4 space-y-3">${g.items.map(it => `
          <details class="card faq-item group p-0">
            <summary class="flex cursor-pointer items-start justify-between gap-4 px-5 py-4 text-left text-lg font-medium text-ink-900 outline-offset-[-4px] sm:px-6"><span>${esc(it.q.th)}</span><svg viewBox="0 0 24 24" class="faq-chev mt-1 h-5 w-5 shrink-0 text-terra-500 transition-transform" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
            <div class="space-y-3 px-5 pb-5 leading-relaxed text-ink-700 sm:px-6">${it.a.map(x => `<p>${esc(x.th)}</p>`).join('')}${it.link ? `<a class="btn-soft !px-5 !py-2.5 text-sm" href="${esc(it.link.href)}"${it.link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(it.link.label.th)}</a>` : ''}</div>
          </details>`).join('')}
        </div>
      </section>`).join('\n      ');
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'FAQPage', '@id': url + '#faq', url, inLanguage: 'th', name: F.title.th,
      mainEntity: F.groups.flatMap(g => g.items).map(it => ({ '@type': 'Question', name: it.q.th, acceptedAnswer: { '@type': 'Answer', text: it.a.map(x => x.th).join(' ') } })) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE },
      { '@type': 'ListItem', position: 2, name: F.title.th, item: url }] }] };
  return `<!doctype html>
<html lang="th" data-alts="1" data-rel="faq.html" data-prefix="">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(F.intro[0].th)}">
  <meta name="theme-color" content="#f4ece2">
  <meta name="robots" content="index,follow">
  ${ogExtra}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${IMG}assets/img/og-cover.jpg">
  <link rel="canonical" href="${url}">
  ${hreflangLinks('faq.html')}
  <link rel="icon" type="image/png" href="assets/img/favicon-64.png">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  ${headFonts}<link rel="stylesheet" href="assets/tailwind.css">
  ${themeScript}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="relative overflow-x-hidden pb-28 lg:pb-10" data-page="faq">
  <a href="faq.html#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-terra-500 focus:px-4 focus:py-2 focus:text-white">ข้ามไปยังเนื้อหา</a>

  ${chrome}<main id="main" class="mx-auto max-w-3xl px-4 pt-20 lg:pl-[112px] lg:pr-6">
    <a href="index.html" class="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-terra-600">${esc(F.back.th)}</a>
    <header class="mt-6">
      <p class="eyebrow">FAQ</p>
      <h1 class="mt-2 text-4xl font-semibold sm:text-5xl">${esc(F.title.th)}</h1>
      <p class="mt-2 text-sm text-ink-400">${esc(F.updated.th)}</p>
      <div class="mt-6 space-y-3">${intro}</div>
    </header>
    <div class="mt-10 space-y-10">
      ${groups}
    </div>
  </main>

  ${footer}

  ${creditsDialog}

  ${arDialog}

  <script src="assets/js/config.js"></script>
  <script src="assets/js/data.js"></script>

  <script src="assets/js/motion.js"></script>
  <script src="assets/js/i18n.js"></script>
  <script src="assets/js/common.js"></script>
  <script src="assets/js/place.js"></script>
</body>
</html>
`;
}

/* ---------- สร้างหน้าภาษาอื่นจากหน้าไทย ---------- */
const translators = Object.fromEntries(OTHER.map(c => [c, makeTranslator(loadDict(root, c))]));
function mapHref(h, prefix, isHome) {
  if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(h)) return h;
  if (h.startsWith('#')) return isHome ? prefix + h : h;                       // ลิงก์ในหน้าแรก: ชี้กลับหน้าแรกของภาษานั้น (base อยู่ที่ราก)
  if (h === 'index.html') return prefix;
  if (h.startsWith('index.html#')) return prefix + h.slice('index.html'.length);
  if (h.startsWith('places/') || h.startsWith('privacy.html') || h.startsWith('faq.html')) return prefix + h;
  return h;                                                                    // assets/, 404.html, sitemap ฯลฯ อยู่ที่รากร่วมกัน
}
function localizeLd(json, code, prefix, relInSite) {
  const tr = translators[code];
  const urlKeys = new Set(['@id', 'url', 'item', 'mainEntityOfPage']);
  const walk = (o, key) => {
    if (Array.isArray(o)) return o.map(x => walk(x, key));
    if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v, k)]));
    if (typeof o !== 'string') return o;
    if (urlKeys.has(key) && o.startsWith(SITE) && !o.startsWith(SITE + 'assets/')) return SITE + prefix + o.slice(SITE.length);
    if (key === 'name' || key === 'description' || key === 'text') { const t = tr.lookupTitle(o); return t != null ? t : o; }
    if (key === 'inLanguage' && o === 'th') return LANG[code].html;
    return o;
  };
  return JSON.stringify(walk(json, ''));
}
function localize(html, code, relFile, rel) {
  const l = LANG[code], prefix = l.prefix, isHome = relFile === 'index.html';
  const depth = relFile.split('/').length - 1, baseHref = '../'.repeat(depth + 1);
  let out = translators[code].translateHtml(html);
  out = out.replace(/[ \t]*<link rel="preload" href="assets\/font\/js-saowapark-normal\.woff2"[^>]*>\n?/, '');   // ฟอนต์ภาษาไทยใช้เฉพาะหน้าไทย
  out = out.replace(/<html lang="th"[^>]*>/, `<html lang="${l.html}" data-alts="1" data-rel="${rel}" data-prefix="${prefix}" data-lang-code="${code}" data-prerendered="1">`);
  out = /<base href="[^"]*">/.test(out) ? out.replace(/<base href="[^"]*">/, `<base href="${baseHref}">`) : out.replace(/(<meta name="viewport"[^>]*>)/, `$1\n  <base href="${baseHref}">`);
  out = out.replace(/(\shref=")([^"]*)(")/g, (m, a, h, z) => a + mapHref(h, prefix, isHome) + z);
  const siteRe = SITE.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  out = out.replace(new RegExp(`(<link rel="canonical" href=")${siteRe}([^"]*)(")`), `$1${SITE}${prefix}$2$3`);
  out = out.replace(new RegExp(`(<meta property="og:url" content=")${siteRe}([^"]*)(")`), `$1${SITE}${prefix}$2$3`);
  out = out.replace(/<meta property="og:locale" content="[^"]*">\n?\s*/, '').replace(/<meta property="og:locale:alternate" content="[^"]*">\n?\s*/g, '');
  const locales = `<meta property="og:locale" content="${l.og}">\n  ` + Object.entries(LANG).filter(([c]) => c !== code).map(([, x]) => `<meta property="og:locale:alternate" content="${x.og}">`).join('\n  ') + '\n  ';
  out = out.replace(/(<meta property="og:site_name"[^>]*>\n\s*)?(?=<link rel="canonical")/, (m) => (m || '') + locales);
  out = out.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, a, j, z) => a + localizeLd(JSON.parse(j), code, prefix) + z);
  return out;
}
function emit(relFile, rel, thai) {
  const f = join(root, relFile); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, thai);
  for (const c of OTHER) { const g = join(root, LANG[c].prefix, relFile); mkdirSync(dirname(g), { recursive: true }); writeFileSync(g, localize(thai, c, relFile, rel)); }
}

emit('index.html', '', homeThai);
A.forEach((a, i) => emit(`places/${a.id}.html`, `places/${a.id}.html`, page(a, i)));
emit('privacy.html', 'privacy.html', privacyPage());
emit('faq.html', 'faq.html', faqPage());
// หน้า 404 มีภาษาเดียว (เสิร์ฟที่ที่อยู่ใดก็ได้) และใช้ตัวแปลในเบราว์เซอร์
writeFileSync(join(root, '404.html'), notFoundPage());
// เตือนถ้ามีหน้าสถานที่ที่ไม่มีใน data.js แล้ว (เช่น เปลี่ยน id)
for (const dir of ['places', ...OTHER.map(c => c + '/places')]) { if (!existsSync(join(root, dir))) continue; for (const f of readdirSync(join(root, dir))) if (f.endsWith('.html') && !A.some(a => a.id + '.html' === f)) console.warn(`หมายเหตุ: ${dir}/${f} ไม่มีใน data.js แล้ว (ลบเองได้)`); }

/* sitemap: ทุกหน้าในทุกภาษา พร้อมลิงก์ภาษาอื่น (xhtml:link) */
const pages = [['', ''], ...A.map(a => [`places/${a.id}.html`, `places/${a.id}.html`]), ['privacy.html', 'privacy.html'], ['faq.html', 'faq.html']];
const sitemapUrl = (rel) => Object.values(LANG).map(l => {
  const loc = SITE + l.prefix + rel;
  return `  <url>\n    <loc>${loc}</loc>\n${Object.values(LANG).map(x => `    <xhtml:link rel="alternate" hreflang="${x.hreflang}" href="${SITE}${x.prefix}${rel}"/>`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${rel}"/>\n  </url>`;
}).join('\n');
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.map(([rel]) => sitemapUrl(rel)).join('\n')}\n</urlset>\n`);
writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`หน้า: ${A.length} สถานที่ + หน้าแรก + นโยบายความเป็นส่วนตัว × 4 ภาษา (th, ${OTHER.join(', ')}) + 404.html, sitemap.xml, robots.txt`);
