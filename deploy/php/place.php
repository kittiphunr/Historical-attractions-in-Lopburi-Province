<?php
/* แสดงหน้าสถานที่ที่สร้างไว้ล่วงหน้า (places/<id>.html และ en|zh|ja/places/<id>.html) โดยแทนที่ข้อความที่ผู้ดูแลแก้ในหน้า /admin/places.php
 * .htaccess ส่งคำขอหน้าสถานที่มาที่ไฟล์นี้ — ถ้าไม่มีข้อความที่แก้ไว้ ฐานข้อมูลใช้ไม่ได้ หรือเกิดข้อผิดพลาดใด ๆ จะส่งหน้าเดิมที่สร้างไว้ตามปกติ (หน้าเว็บไม่ล่ม) */
declare(strict_types=1);
ini_set('display_errors', '0');
mb_internal_encoding('UTF-8');

$lang = (string)($_GET['lang'] ?? '');
$place = (string)($_GET['id'] ?? '');
if ($lang === '') $lang = 'th';
$notFound = function (): void {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    $f = __DIR__ . '/404.html';
    echo is_file($f) ? (string)file_get_contents($f) : 'Not found';
    exit;
};
if (!preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $place) || !in_array($lang, ['th', 'en', 'zh', 'ja'], true)) $notFound();
$file = __DIR__ . '/' . ($lang === 'th' ? '' : $lang . '/') . 'places/' . $place . '.html';
$html = is_file($file) ? file_get_contents($file) : false;
if ($html === false) $notFound();

$stamp = (string)filemtime($file);
try {
    require __DIR__ . '/api/lib.php';
    require __DIR__ . '/api/content.php';
    if (lop_config_load() !== null && function_exists('libxml_use_internal_errors') && class_exists('DOMDocument')) {
        $db = lop_pdo();
        $over = lop_cms_load($db, $place, $lang);
        if ($over) {
            $html = lop_cms_apply($html, $over);
            $stamp .= '-' . md5(implode('|', array_map(fn($o) => $o['updated_at'], $over)));
        }
    }
} catch (Throwable $e) {
    error_log('lopburi place: ' . $e->getMessage());   // ตาราง/ฐานข้อมูลยังไม่พร้อม: ใช้หน้าเดิม
}

$etag = '"' . md5($stamp . '|' . strlen($html)) . '"';
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');   // ตรวจกับเซิร์ฟเวอร์ทุกครั้ง (ได้ 304 ถ้าไม่เปลี่ยน) เพื่อให้ข้อความที่เพิ่งแก้ขึ้นทันที
header('ETag: ' . $etag);
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
echo $html;
