<?php
/* จัดการเนื้อหาสถานที่ด้วยตัวแก้ไข CKEditor 5 — เข้าที่ /admin/places.php (ล็อกอินเดียวกับหน้าสมุดเยี่ยม)
 * แก้ 4 ส่วนของแต่ละหน้าสถานที่ต่อภาษา: ประวัติศาสตร์ · สถาปัตยกรรม · ไฮไลต์ · เตรียมตัวไป
 * ส่วนที่ไม่เคยแก้ใช้ข้อความตั้งต้นจากตอนสร้างเว็บ (จึงตามการสร้างเว็บใหม่ได้) ส่วนที่แก้แล้วเก็บในฐานข้อมูลและมีประวัติย้อนหลัง */
declare(strict_types=1);
require __DIR__ . '/common.php';
require __DIR__ . '/../api/content.php';
admin_headers("'self'", "img-src 'self' data: blob:; connect-src 'self'");   // CKEditor ใช้ภาพ blob: ตอนอัปโหลด และสไตล์ inline

$places = lop_places();
$place = (string)($_REQUEST['place'] ?? '');
if ($place !== '' && !isset($places[$place])) $place = '';
$lang = (string)($_REQUEST['lang'] ?? 'th');
if (!isset(LOP_CMS_LANGS[$lang])) $lang = 'th';
$self = $_SERVER['SCRIPT_NAME'];
$url = fn(array $q = []) => $self . ($q ? '?' . http_build_query($q) : '');

$flash = function (string $msg, string $kind = 'ok'): void { $_SESSION['flash'] = [$msg, $kind]; };
try {
    $db = lop_pdo();
    lop_cms_ensure($db);
} catch (Throwable $e) {
    error_log('lopburi cms: ' . $e->getMessage());
    page('ผิดพลาด', admin_nav('places', 'เนื้อหาสถานที่') . '<div class="card"><p class="warn">เชื่อมต่อฐานข้อมูลไม่ได้ หรือผู้ใช้ฐานข้อมูลไม่มีสิทธิ์สร้างตาราง (CREATE) — ตรวจ <code>config.php</code> และนำเข้า <code>schema.sql</code> ผ่าน phpMyAdmin (รายละเอียดอยู่ใน error log ของโฮสต์)</p></div>');
}

/* ---------- บันทึก / คืนค่าตั้งต้น / ย้อนเวอร์ชัน (POST + CSRF) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $act = (string)($_POST['act'] ?? '');
    $back = function () use ($url, &$place, &$lang): void { header('Location: ' . $url(['place' => $place, 'lang' => $lang])); exit; };
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { $flash('หมดเวลาหรือคำขอไม่ถูกต้อง ลองใหม่อีกครั้ง', 'warn'); $back(); }
    if ($place === '') { $flash('ไม่พบสถานที่', 'warn'); header('Location: ' . $url()); exit; }
    try {
        $pagePath = lop_cms_page_path($place, $lang);
        $pageHtml = is_file($pagePath) ? (string)file_get_contents($pagePath) : '';
        $cur = lop_cms_load($db, $place, $lang);
        if ($act === 'save') {
            $saved = []; $reset = []; $conflict = [];
            foreach (LOP_CMS_FIELDS as $f => $label) {
                if (!isset($_POST['f_' . $f])) continue;
                if ((string)($_POST['v_' . $f] ?? '') !== ($cur[$f]['updated_at'] ?? '')) { $conflict[] = $label; continue; }   // มีคนแก้ระหว่างที่เปิดอยู่ — ไม่ทับ
                $html = lop_rt_clean((string)$_POST['f_' . $f], 'store');
                $base = lop_cms_base($pageHtml, $f);
                $same = $base !== null && $html === lop_rt_clean($base, 'store');
                if ($html === '' || $same) {                 // ว่าง หรือเท่ากับข้อความตั้งต้น = ไม่ต้องเก็บ ใช้ข้อความตั้งต้น
                    if (isset($cur[$f])) { lop_cms_save($db, $place, $lang, $f, ''); $reset[] = $label; }
                } elseif (($cur[$f]['html'] ?? null) !== $html) { lop_cms_save($db, $place, $lang, $f, $html); $saved[] = $label; }
            }
            $parts = [];
            if ($saved) $parts[] = 'บันทึกแล้ว: ' . implode(', ', $saved);
            if ($reset) $parts[] = 'กลับไปใช้ข้อความตั้งต้น: ' . implode(', ', $reset);
            if ($conflict) $parts[] = 'ไม่ได้บันทึก (มีการแก้ไขจากที่อื่นระหว่างที่คุณเปิดหน้านี้ โหลดหน้าใหม่แล้วแก้อีกครั้ง): ' . implode(', ', $conflict);
            $flash($parts ? implode(' · ', $parts) : 'ไม่มีการเปลี่ยนแปลง', $conflict ? 'warn' : 'ok');
        } elseif ($act === 'reset') {
            $f = (string)($_POST['field'] ?? '');
            if (!isset(LOP_CMS_FIELDS[$f])) throw new InvalidArgumentException('ฟิลด์ไม่ถูกต้อง');
            lop_cms_save($db, $place, $lang, $f, '');
            $flash('กลับไปใช้ข้อความตั้งต้นของส่วน "' . LOP_CMS_FIELDS[$f] . '" แล้ว');
        } elseif ($act === 'restore') {
            $rev = lop_cms_revision($db, (int)($_POST['rev'] ?? 0));
            if (!$rev || $rev['place'] !== $place || $rev['lang'] !== $lang) throw new InvalidArgumentException('ไม่พบเวอร์ชันที่เลือก');
            lop_cms_save($db, $place, $lang, $rev['field'], lop_rt_clean((string)$rev['html'], 'store'));
            $flash('ใช้เวอร์ชันเมื่อ ' . $rev['created_at'] . ' UTC ของส่วน "' . LOP_CMS_FIELDS[$rev['field']] . '" แล้ว');
        }
    } catch (Throwable $e) {
        error_log('lopburi cms save: ' . $e->getMessage());
        $flash('บันทึกไม่สำเร็จ ลองอีกครั้ง (รายละเอียดอยู่ใน error log ของโฮสต์)', 'warn');
    }
    $back();
}

$fl = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);
$body = admin_nav('places', 'เนื้อหาสถานที่');
if ($fl) $body .= '<p class="card ' . ($fl[1] === 'warn' ? 'warn' : '') . '" role="status">' . $h($fl[0]) . '</p>';

/* ---------- รายการสถานที่ ---------- */
if ($place === '') {
    $counts = lop_cms_counts($db);
    $body .= '<p class="meta">เลือกสถานที่และภาษาที่ต้องการแก้ ข้อความที่ไม่เคยแก้จะใช้ข้อความตั้งต้นของเว็บ (หน้าแรกและการ์ดสถานที่ยังใช้ข้อความตั้งต้นเสมอ)</p>';
    if (!$places) $body .= '<p class="card warn">ไม่พบ <code>api/places.json</code> — อัปโหลดโฟลเดอร์ api/ ให้ครบ</p>';
    $body .= '<div class="card" style="padding:0;overflow:auto"><table><thead><tr><th scope="col">สถานที่</th>';
    foreach (LOP_CMS_LANGS as $lc => $ln) $body .= '<th scope="col">' . $h($ln) . '</th>';
    $body .= '</tr></thead><tbody>';
    foreach ($places as $id => $name) {
        $body .= '<tr><th scope="row" style="text-align:left">' . $h($name) . '</th>';
        foreach (LOP_CMS_LANGS as $lc => $ln) {
            $n = $counts[$id][$lc] ?? 0;
            $body .= '<td><a class="tab" href="' . $h($url(['place' => $id, 'lang' => $lc])) . '" aria-label="แก้ไข ' . $h($name) . ' ภาษา' . $h($ln) . '">แก้ไข</a> ' . ($n ? '<span class="pill approved">แก้แล้ว ' . $n . '/' . count(LOP_CMS_FIELDS) . '</span>' : '<span class="meta">ตั้งต้น</span>') . '</td>';
        }
        $body .= '</tr>';
    }
    $body .= '</tbody></table></div>';
    page('เนื้อหาสถานที่', $body);
}

/* ---------- หน้าแก้ไขสถานที่หนึ่งแห่ง ---------- */
$pagePath = lop_cms_page_path($place, $lang);
$pageHtml = is_file($pagePath) ? (string)file_get_contents($pagePath) : '';
$cur = lop_cms_load($db, $place, $lang);
$body .= '<p class="meta"><a href="' . $h($url()) . '">‹ ทุกสถานที่</a> · <b>' . $h($places[$place]) . '</b></p><nav class="row" aria-label="ภาษา">';
foreach (LOP_CMS_LANGS as $lc => $ln) $body .= '<a class="tab' . ($lc === $lang ? ' on' : '') . '" href="' . $h($url(['place' => $place, 'lang' => $lc])) . '"' . ($lc === $lang ? ' aria-current="page"' : '') . '>' . $h($ln) . '</a>';
$body .= '</nav>';
if ($pageHtml === '') $body .= '<p class="card warn">ไม่พบหน้าสำเร็จรูปของภาษานี้ (' . $h(($lang === 'th' ? '' : $lang . '/') . 'places/' . $place . '.html') . ') จึงแสดงข้อความตั้งต้นไม่ได้</p>';
elseif (strpos($pageHtml, '<!--lop:history-->') === false) $body .= '<p class="card warn">หน้าสำเร็จรูปนี้สร้างด้วยเวอร์ชันเก่าที่ยังไม่มีเครื่องหมายสำหรับระบบแก้ข้อความ — อัปโหลดเว็บเวอร์ชันใหม่ (แล้วค่อยแก้) มิฉะนั้นข้อความที่แก้จะไม่แสดง</p>';
$body .= '<p class="meta">รูปที่เพิ่มต้องมีเครดิตผู้ถ่าย: คลิกรูปแล้วกดปุ่ม "คำบรรยายภาพ" พิมพ์เช่น <code>ภาพ: ชื่อผู้ถ่าย · สัญญาอนุญาต · ลิงก์ต้นทาง</code> และใส่ข้อความทางเลือก (alt) ให้ทุกรูป · ไม่ใช้ภาพที่ไม่ได้รับอนุญาต</p>';

$body .= '<form id="cmsForm" method="post" action="' . $h($url()) . '" data-upload="' . $h('upload.php?place=' . rawurlencode($place)) . '" data-csrf="' . $h(csrf()) . '">'
    . '<input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="save"><input type="hidden" name="place" value="' . $h($place) . '"><input type="hidden" name="lang" value="' . $h($lang) . '">';
$resetForms = ''; $revHtml = '';
foreach (LOP_CMS_FIELDS as $f => $label) {
    $over = $cur[$f] ?? null;
    $base = lop_cms_base($pageHtml, $f);
    $init = $over ? (string)$over['html'] : (string)$base;
    $body .= '<section class="card" aria-labelledby="h-' . $f . '"><div class="row"><h2 id="h-' . $f . '" style="margin:0;margin-right:auto">' . $h($label) . '</h2>'
        . ($over ? '<span class="pill approved">แก้แล้ว · ' . $h($over['updated_at']) . ' UTC</span><button type="submit" form="reset-' . $f . '" class="mid" data-confirm="กลับไปใช้ข้อความตั้งต้น? ข้อความที่แก้ไว้จะหายจากหน้าเว็บ (ยังย้อนกลับได้จากประวัติ)">ใช้ข้อความตั้งต้น</button>' : '<span class="pill">ข้อความตั้งต้น</span>')
        . '</div><textarea class="lop-rt" name="f_' . $f . '" id="f-' . $f . '" aria-label="' . $h($label) . '" data-ph="พิมพ์ข้อความ…" rows="8">' . $h(lop_rt_clean($init, 'edit')) . '</textarea>'
        . '<input type="hidden" name="v_' . $f . '" value="' . $h($over['updated_at'] ?? '') . '"></section>';
    $resetForms .= '<form id="reset-' . $f . '" method="post" action="' . $h($url()) . '"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="reset"><input type="hidden" name="place" value="' . $h($place) . '"><input type="hidden" name="lang" value="' . $h($lang) . '"><input type="hidden" name="field" value="' . $f . '"></form>';
    $revs = lop_cms_revisions($db, $place, $lang, $f);
    if ($revs) {
        $revHtml .= '<h3 style="font-size:15px;margin:12px 0 4px">' . $h($label) . '</h3><ul style="list-style:none;padding:0;margin:0">';
        foreach ($revs as $r) {
            $snip = lop_substr(trim((string)preg_replace('/\s+/u', ' ', strip_tags(str_replace('<', ' <', lop_rt_clean((string)$r['html']))))), 70);
            $revHtml .= '<li class="row" style="padding:4px 0;border-top:1px solid #eee"><span class="meta" style="min-width:150px">' . $h($r['created_at']) . ' UTC</span><span style="flex:1;min-width:160px">' . $h($snip) . '…</span>'
                . '<button type="submit" form="rev-' . (int)$r['id'] . '" class="mid" data-confirm="ใช้เวอร์ชันนี้แทนข้อความปัจจุบันของส่วนนี้?">ใช้เวอร์ชันนี้</button></li>';
            $resetForms .= '<form id="rev-' . (int)$r['id'] . '" method="post" action="' . $h($url()) . '"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="restore"><input type="hidden" name="place" value="' . $h($place) . '"><input type="hidden" name="lang" value="' . $h($lang) . '"><input type="hidden" name="rev" value="' . (int)$r['id'] . '"></form>';
        }
        $revHtml .= '</ul>';
    }
}
$pubUrl = '../' . ($lang === 'th' ? '' : $lang . '/') . 'places/' . $place . '.html';
$body .= '<div class="row card"><input type="submit" class="ok" value="บันทึกทุกส่วน"><a class="tab" href="' . $h($pubUrl) . '" target="_blank" rel="noopener">ดูหน้าจริง ↗</a><span class="meta">ส่วนที่ไม่แตะต้องหรือเท่ากับข้อความตั้งต้นจะไม่ถูกเก็บ</span></div></form>' . $resetForms;
if ($revHtml) $body .= '<details class="card"><summary>ประวัติการแก้ไข (ย้อนหลัง ' . LOP_CMS_KEEP_REVISIONS . ' ครั้งล่าสุดต่อส่วน)</summary>' . $revHtml . '</details>';

$head = '<link rel="stylesheet" href="assets/editor.css"><link rel="stylesheet" href="assets/places.css"><script src="assets/editor.js" defer></script><script src="assets/places.js" defer></script>';
page('แก้ไข ' . $places[$place], $body, $head);
