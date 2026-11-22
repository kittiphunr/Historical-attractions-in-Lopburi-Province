<?php
/* ระบบจัดการเนื้อหาสถานที่ (PHP 7.4+ / PDO MySQL / ส่วนขยาย dom) — ใช้โดย place.php และ admin/places.php, admin/upload.php
 * - ข้อความที่แก้ด้วย CKEditor 5 เก็บเป็น HTML ที่ผ่านตัวกรอง lop_rt_clean() แล้วเท่านั้น (กรองตอนบันทึก และกรองซ้ำตอนแสดง)
 * - ไม่แก้ไฟล์ HTML ที่สร้างไว้ตอน build: place.php อ่านหน้าสำเร็จรูปแล้วแทนที่เฉพาะช่วงระหว่างเครื่องหมาย <!--lop:ฟิลด์--> ... <!--/lop:ฟิลด์-->
 * ห้ามเปิดจากเว็บโดยตรง (api/.htaccess บล็อกไว้) */
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'content.php') { http_response_code(403); exit; }

/** ฟิลด์ที่แก้ได้ และภาษาของหน้า (th = หน้าไทยที่ราก, อื่น ๆ = โฟลเดอร์ en/ zh/ ja/) */
const LOP_CMS_FIELDS = ['history' => 'ประวัติศาสตร์', 'architecture' => 'สถาปัตยกรรม', 'highlights' => 'ไฮไลต์', 'visit' => 'เตรียมตัวไป'];
const LOP_CMS_LANGS = ['th' => 'ไทย', 'en' => 'English', 'zh' => '中文', 'ja' => '日本語'];
const LOP_CMS_MAX_BYTES = 200000;   // HTML ต่อฟิลด์
const LOP_CMS_KEEP_REVISIONS = 15;  // เก็บประวัติย้อนหลังต่อ (สถานที่, ภาษา, ฟิลด์)
const LOP_UPLOAD_DIR = 'uploads/places';

/* ---------- ตัวกรอง HTML (รายการที่อนุญาตเท่านั้น) ---------- */
const LOP_RT_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup', 'blockquote', 'ul', 'ol', 'li', 'h3', 'h4', 'a', 'figure', 'figcaption', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr'];
const LOP_RT_RENAME = ['b' => 'strong', 'i' => 'em', 'strike' => 's', 'del' => 's', 'h1' => 'h3', 'h2' => 'h3', 'h5' => 'h4', 'h6' => 'h4'];
/** แท็กที่ลบทั้งก้อน (รวมเนื้อใน) — แท็กอื่นที่ไม่อยู่ในรายการจะเหลือแต่ข้อความข้างใน */
const LOP_RT_DROP = ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'option',
    'svg', 'math', 'link', 'meta', 'base', 'template', 'noscript', 'audio', 'video', 'source', 'track', 'canvas', 'head', 'title'];
const LOP_RT_FIGURE_CLASSES = ['image', 'table', 'media'];
const LOP_RT_IMG_RE = '~^(?:\.\./)?(uploads/places/[a-z0-9]+(?:-[a-z0-9]+)*/[A-Za-z0-9_-]{4,64}\.(?:webp|jpe?g|png))$~';

/**
 * กรอง HTML จากตัวแก้ไขให้เหลือเฉพาะแท็ก/แอตทริบิวต์ที่อนุญาต
 * $mode = 'store' (เก็บลงฐานข้อมูล: รูปเป็น uploads/places/…) | 'edit' (ส่งให้ตัวแก้ไขในหน้า /admin/: รูปเป็น ../uploads/places/…)
 */
function lop_rt_clean(string $html, string $mode = 'store'): string {
    if ($html === '' || trim($html) === '') return '';
    if (!preg_match('//u', $html)) $html = (string)@iconv('UTF-8', 'UTF-8//IGNORE', $html);
    $html = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', '', $html) ?? '';
    if (strlen($html) > LOP_CMS_MAX_BYTES) $html = substr($html, 0, LOP_CMS_MAX_BYTES);
    $prev = libxml_use_internal_errors(true);
    $doc = new DOMDocument('1.0', 'UTF-8');
    $doc->loadHTML('<?xml encoding="UTF-8"><body><div id="lop-root">' . $html . '</div></body>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    $root = $doc->getElementById('lop-root');
    if (!$root) return '';
    lop_rt_walk($root, $mode, 0);
    $out = '';
    foreach (iterator_to_array($root->childNodes) as $n) $out .= $doc->saveHTML($n);
    $out = trim($out);
    // ตัวแก้ไขเปล่า ๆ ให้ค่าเป็น <p>&nbsp;</p> หรือ <p></p> — ถือว่าว่าง
    if (preg_match('~^(?:<p>(?:\s|&nbsp;|<br>)*</p>\s*)*$~u', $out)) return '';
    return $out;
}
function lop_rt_walk(DOMNode $node, string $mode, int $depth): void {
    if ($depth > 40) { while ($node->firstChild) $node->removeChild($node->firstChild); return; }
    foreach (iterator_to_array($node->childNodes) as $ch) {
        if ($ch instanceof DOMComment || $ch instanceof DOMProcessingInstruction || $ch instanceof DOMCdataSection) { $node->removeChild($ch); continue; }
        if (!($ch instanceof DOMElement)) continue;   // ข้อความ: ปล่อยไว้ (saveHTML เข้ารหัสให้)
        $tag = strtolower($ch->tagName);
        if (in_array($tag, LOP_RT_DROP, true)) { $node->removeChild($ch); continue; }
        if (isset(LOP_RT_RENAME[$tag])) { $ch = lop_rt_rename($ch, LOP_RT_RENAME[$tag]); $tag = strtolower($ch->tagName); }
        if (!in_array($tag, LOP_RT_TAGS, true)) {          // ไม่อนุญาต: เก็บเนื้อในไว้ ตัวแท็กทิ้ง
            lop_rt_walk($ch, $mode, $depth + 1);
            while ($ch->firstChild) $node->insertBefore($ch->firstChild, $ch);
            $node->removeChild($ch);
            continue;
        }
        if (!lop_rt_attrs($ch, $tag, $mode)) { $node->removeChild($ch); continue; }
        lop_rt_walk($ch, $mode, $depth + 1);
        if ($tag === 'a' && $ch->getAttribute('href') === '') {   // ลิงก์ที่ไม่ปลอดภัย: เหลือแต่ข้อความ
            while ($ch->firstChild) $node->insertBefore($ch->firstChild, $ch);
            $node->removeChild($ch);
        }
    }
}
function lop_rt_rename(DOMElement $el, string $to): DOMElement {
    $new = $el->ownerDocument->createElement($to);
    while ($el->firstChild) $new->appendChild($el->firstChild);
    $el->parentNode->replaceChild($new, $el);
    return $new;
}
/** ปรับแอตทริบิวต์ตามชนิดแท็ก คืน false = ลบแท็กทิ้งทั้งก้อน (เช่น รูปที่ไม่ได้มาจากการอัปโหลดของระบบ) */
function lop_rt_attrs(DOMElement $el, string $tag, string $mode): bool {
    $old = [];
    foreach (iterator_to_array($el->attributes) as $a) $old[strtolower($a->name)] = $a->value;
    foreach (array_keys($old) as $name) $el->removeAttribute($name);
    switch ($tag) {
        case 'a':
            $href = trim(preg_replace('/[\x00-\x20\x7F]+/', '', $old['href'] ?? '') ?? '');
            if (preg_match('~^(https?://[^\s<>"\']+|mailto:[^\s<>"\']+|tel:[+0-9()\-]+|#[A-Za-z0-9_\-]*)$~i', $href)) {
                $el->setAttribute('href', $href);
                if (preg_match('~^https?://~i', $href)) { $el->setAttribute('target', '_blank'); $el->setAttribute('rel', 'noopener noreferrer'); }
            }
            break;
        case 'img':
            if (!preg_match(LOP_RT_IMG_RE, trim($old['src'] ?? ''), $m)) return false;
            $el->setAttribute('src', ($mode === 'edit' ? '../' : '') . $m[1]);
            $el->setAttribute('alt', lop_substr(trim($old['alt'] ?? ''), 300));
            foreach (['width', 'height'] as $d) if (isset($old[$d]) && preg_match('/^\d{1,5}$/', $old[$d])) $el->setAttribute($d, $old[$d]);
            $el->setAttribute('loading', 'lazy');
            break;
        case 'figure':
            $keep = array_values(array_intersect(preg_split('/\s+/', trim($old['class'] ?? '')) ?: [], LOP_RT_FIGURE_CLASSES));
            if ($keep) $el->setAttribute('class', implode(' ', $keep));
            break;
        case 'td': case 'th':
            foreach (['colspan', 'rowspan'] as $d) if (isset($old[$d]) && preg_match('/^[1-9]\d?$/', $old[$d])) $el->setAttribute($d, $old[$d]);
            break;
        case 'ol':
            if (isset($old['start']) && preg_match('/^\d{1,4}$/', $old['start'])) $el->setAttribute('start', $old['start']);
            break;
    }
    return true;
}

/* ---------- ฐานข้อมูล ---------- */
function lop_cms_prefix(): string {
    $c = lop_config_load();
    $p = (string)($c['table_prefix'] ?? 'lop_');
    if (!preg_match('/^[A-Za-z0-9_]{0,20}$/', $p)) throw new RuntimeException('table_prefix ไม่ถูกต้อง');
    return $p;
}
function lop_cms_t(string $name): string { return '`' . lop_cms_prefix() . $name . '`'; }

/** สร้างตารางถ้ายังไม่มี (ผู้ติดตั้งเก่าที่นำเข้า schema.sql เวอร์ชันก่อนหน้าไม่ต้องทำอะไร) */
function lop_cms_ensure(PDO $db): void {
    $c = lop_cms_t('place_content'); $r = lop_cms_t('place_revisions');
    $db->exec("CREATE TABLE IF NOT EXISTS $c (
      `place` VARCHAR(40) NOT NULL, `lang` VARCHAR(8) NOT NULL, `field` VARCHAR(20) NOT NULL,
      `html` MEDIUMTEXT NOT NULL, `updated_at` DATETIME NOT NULL,
      PRIMARY KEY (`place`, `lang`, `field`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS $r (
      `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `place` VARCHAR(40) NOT NULL, `lang` VARCHAR(8) NOT NULL, `field` VARCHAR(20) NOT NULL,
      `html` MEDIUMTEXT NOT NULL, `created_at` DATETIME NOT NULL,
      PRIMARY KEY (`id`), KEY `idx_key` (`place`, `lang`, `field`, `id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function lop_cms_valid(string $place, string $lang, string $field = 'history'): bool {
    return preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $place) === 1 && isset(LOP_CMS_LANGS[$lang]) && isset(LOP_CMS_FIELDS[$field]);
}

/** ข้อความที่แก้ไว้ของสถานที่หนึ่งในภาษาหนึ่ง: [field => [html, updated_at]] (เฉพาะฟิลด์ที่แก้) */
function lop_cms_load(PDO $db, string $place, string $lang): array {
    $st = $db->prepare('SELECT `field`, `html`, `updated_at` FROM ' . lop_cms_t('place_content') . ' WHERE `place` = ? AND `lang` = ?');
    $st->execute([$place, $lang]);
    $out = [];
    foreach ($st->fetchAll() as $r) if (isset(LOP_CMS_FIELDS[$r['field']])) $out[$r['field']] = ['html' => $r['html'], 'updated_at' => $r['updated_at']];
    return $out;
}
/** บันทึกฟิลด์ (กรองแล้ว) พร้อมเก็บประวัติ; $html ว่าง = ลบข้อความที่แก้ (กลับไปใช้ข้อความตั้งต้น) */
function lop_cms_save(PDO $db, string $place, string $lang, string $field, string $html): void {
    if (!lop_cms_valid($place, $lang, $field)) throw new InvalidArgumentException('ฟิลด์ไม่ถูกต้อง');
    $c = lop_cms_t('place_content'); $r = lop_cms_t('place_revisions');
    $now = gmdate('Y-m-d H:i:s');
    $db->beginTransaction();
    try {
        if ($html === '') {
            $db->prepare("DELETE FROM $c WHERE `place` = ? AND `lang` = ? AND `field` = ?")->execute([$place, $lang, $field]);
        } else {
            $db->prepare("INSERT INTO $c (`place`, `lang`, `field`, `html`, `updated_at`) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `html` = VALUES(`html`), `updated_at` = VALUES(`updated_at`)")->execute([$place, $lang, $field, $html, $now]);
            $db->prepare("INSERT INTO $r (`place`, `lang`, `field`, `html`, `created_at`) VALUES (?, ?, ?, ?, ?)")->execute([$place, $lang, $field, $html, $now]);
            $keep = (int)LOP_CMS_KEEP_REVISIONS;
            $ids = $db->prepare("SELECT `id` FROM $r WHERE `place` = ? AND `lang` = ? AND `field` = ? ORDER BY `id` DESC LIMIT $keep");
            $ids->execute([$place, $lang, $field]);
            $keepIds = array_map('intval', $ids->fetchAll(PDO::FETCH_COLUMN));
            if (count($keepIds) >= $keep) {
                $db->prepare("DELETE FROM $r WHERE `place` = ? AND `lang` = ? AND `field` = ? AND `id` < ?")->execute([$place, $lang, $field, min($keepIds)]);
            }
        }
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}
function lop_cms_revisions(PDO $db, string $place, string $lang, string $field): array {
    $st = $db->prepare('SELECT `id`, `html`, `created_at` FROM ' . lop_cms_t('place_revisions') . ' WHERE `place` = ? AND `lang` = ? AND `field` = ? ORDER BY `id` DESC LIMIT ' . (int)LOP_CMS_KEEP_REVISIONS);
    $st->execute([$place, $lang, $field]);
    return $st->fetchAll();
}
function lop_cms_revision(PDO $db, int $id): ?array {
    $st = $db->prepare('SELECT `id`, `place`, `lang`, `field`, `html`, `created_at` FROM ' . lop_cms_t('place_revisions') . ' WHERE `id` = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}
/** จำนวนฟิลด์ที่แก้ไว้ ต่อสถานที่ ต่อภาษา: [place => [lang => n]] */
function lop_cms_counts(PDO $db): array {
    $out = [];
    foreach ($db->query('SELECT `place`, `lang`, COUNT(*) c FROM ' . lop_cms_t('place_content') . ' GROUP BY `place`, `lang`') as $r) $out[$r['place']][$r['lang']] = (int)$r['c'];
    return $out;
}

/* ---------- หน้าสำเร็จรูป ---------- */
function lop_cms_page_path(string $place, string $lang): string {
    return dirname(__DIR__) . '/' . ($lang === 'th' ? '' : $lang . '/') . 'places/' . $place . '.html';
}
/** ข้อความตั้งต้นของฟิลด์ (ช่วงระหว่างเครื่องหมายในหน้าสำเร็จรูป) หรือ null ถ้าไม่พบ (ยังไม่ได้ build ด้วยเวอร์ชันที่มีเครื่องหมาย) */
function lop_cms_base(string $pageHtml, string $field): ?string {
    return preg_match('~<!--lop:' . $field . '-->(.*?)<!--/lop:' . $field . '-->~s', $pageHtml, $m) ? $m[1] : null;
}
/** แทนที่ช่วงของแต่ละฟิลด์ด้วยข้อความที่แก้ไว้ (กรองซ้ำก่อนใช้) */
function lop_cms_apply(string $pageHtml, array $overrides): string {
    foreach ($overrides as $field => $o) {
        if (!isset(LOP_CMS_FIELDS[$field])) continue;
        $clean = lop_rt_clean((string)$o['html'], 'store');
        if ($clean === '') continue;
        $block = '<div class="rt">' . $clean . '</div>';
        $pageHtml = preg_replace_callback('~(<!--lop:' . $field . '-->).*?(<!--/lop:' . $field . '-->)~s', fn($m) => $m[1] . $block . $m[2], $pageHtml, 1) ?? $pageHtml;
    }
    return $pageHtml;
}
