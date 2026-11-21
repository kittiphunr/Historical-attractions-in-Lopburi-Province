/* ตัวแปลฝั่ง Node สำหรับสร้างหน้าแยกตามภาษา (en/zh/ja) ตอน build
   ใช้พจนานุกรมชุดเดียวกับเบราว์เซอร์ (i18n/<code>.json + คำแปลใน content/privacy.json และ content/404.json)
   และกติกาเดียวกับ assets/js/i18n.js: คีย์ = ข้อความไทยต้นฉบับ (ตัดช่องว่างซ้ำ), รองรับ {0} {1}, ข้อความที่ต่อด้วย " — " แปลทีละท่อน */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const walkLeaves = (v, out) => { if (v && typeof v === 'object') { if (typeof v.th === 'string') out.push(v); else Object.values(v).forEach(x => walkLeaves(x, out)); } return out; };

/** พจนานุกรมของภาษา code: i18n/<code>.json รวมกับคำแปลในไฟล์เนื้อหา */
export function loadDict(root, code) {
  const ui = JSON.parse(readFileSync(join(root, 'i18n', code + '.json'), 'utf8'));
  for (const f of ['content/privacy.json', 'content/404.json', 'content/faq.json']) {
    for (const l of walkLeaves(JSON.parse(readFileSync(join(root, f), 'utf8')), [])) if (typeof l[code] === 'string') ui[l.th] = l[code];
  }
  return ui;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const reEsc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }[k]))
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
const enc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encAttr = (s) => enc(s).replace(/"/g, '&quot;');

export function makeTranslator(dict) {
  const patterns = Object.keys(dict).filter(k => /\{\d\}/.test(k)).map(k => ({ re: new RegExp('^' + reEsc(k).replace(/\{(\d)\}/g, '(.+?)') + '$'), val: dict[k] }));
  const has = (k) => Object.prototype.hasOwnProperty.call(dict, k);
  function lookup(key) {
    if (!key) return null;
    if (has(key)) return dict[key];
    for (const p of patterns) {
      const m = key.match(p.re);
      if (m) { let out = p.val; m.slice(1).forEach((g, i) => { const tr = lookup(norm(g)); out = out.replace('{' + i + '}', tr != null ? tr : g); }); return out; }
    }
    return null;
  }
  function lookupTitle(str) {
    const full = lookup(norm(str)); if (full != null) return full;
    if (!str.includes(' — ')) return null;
    let hit = false;
    const out = str.split(' — ').map(p => { const t = lookup(norm(p)); if (t != null) { hit = true; return t; } return p; });
    return hit ? out.join(' — ') : null;
  }

  const ATTRS = ['aria-label', 'alt', 'title', 'placeholder'];
  const META = /^(description|og:title|og:description|og:site_name|twitter:title|twitter:description)$/;

  function translateTag(tag) {
    const metaKey = /^<meta\b/i.test(tag) ? ((/\b(?:name|property)="([^"]*)"/i.exec(tag) || [])[1] || '') : null;
    return tag.replace(/(\s)([a-z-]+)="([^"]*)"/gi, (m, sp, name, val) => {
      const n = name.toLowerCase();
      if (metaKey !== null) {
        if (n !== 'content' || !META.test(metaKey)) return m;
        const tr = lookupTitle(decode(val)); return tr != null ? `${sp}${name}="${encAttr(tr)}"` : m;
      }
      if (!ATTRS.includes(n)) return m;
      const tr = lookup(norm(decode(val))); return tr != null ? `${sp}${name}="${encAttr(tr)}"` : m;
    });
  }

  /** แปลข้อความและแอตทริบิวต์ของ HTML ทั้งหน้า (ไม่แตะ <script>/<style>/ความคิดเห็น) */
  function translateHtml(html) {
    let inTitle = false;
    return html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/gi, (tok) => {
      if (tok[0] !== '<') {
        const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(tok); if (!m[2]) return tok;
        const inner = decode(m[2]);
        const tr = inTitle ? lookupTitle(inner) : lookup(norm(inner));
        return tr != null ? m[1] + enc(tr) + m[3] : tok;
      }
      if (/^<(script|style)\b/i.test(tok) || tok.startsWith('<!--')) return tok;
      if (/^<title\b/i.test(tok)) inTitle = true; else if (/^<\/title/i.test(tok)) inTitle = false;
      return translateTag(tok);
    });
  }
  return { lookup, lookupTitle, translateHtml };
}
