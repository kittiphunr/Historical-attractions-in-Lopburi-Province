<?php
/* ส่ง assets/js/data.js พร้อมต่อท้ายโมเดล 3 มิติและพิกัดหมุดที่ผู้ดูแลตั้งไว้ใน /admin/models.php
 * .htaccess ส่งคำขอ assets/js/data.js มาที่ไฟล์นี้ — ถ้าไม่มีการตั้งค่า ฐานข้อมูลใช้ไม่ได้ หรือเกิดข้อผิดพลาดใด ๆ จะส่ง data.js เดิมทุกไบต์ (เว็บไม่ล่ม) */
declare(strict_types=1);
ini_set('display_errors', '0');

$file = __DIR__ . '/assets/js/data.js';
$js = is_file($file) ? file_get_contents($file) : false;
if ($js === false) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo 'Not found'; exit; }

$stamp = (string)filemtime($file);
try {
    require __DIR__ . '/api/lib.php';
    require __DIR__ . '/api/content.php';
    require __DIR__ . '/api/modelstore.php';
    if (lop_config_load() !== null) {
        $extra = lop_models_js(lop_pdo());
        if ($extra !== '') { $js .= $extra; $stamp .= '-' . md5($extra); }
    }
} catch (Throwable $e) {
    error_log('lopburi data: ' . $e->getMessage());   // ตารางยังไม่มี/ฐานข้อมูลใช้ไม่ได้: ใช้ data.js เดิม
}

$etag = '"' . md5($stamp . '|' . strlen($js)) . '"';
header('Content-Type: text/javascript; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');   // ตรวจกับเซิร์ฟเวอร์ทุกครั้ง (ได้ 304 ถ้าไม่เปลี่ยน) เพื่อให้โมเดลใหม่ขึ้นทันทีหลังอัปโหลด
header('ETag: ' . $etag);
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
echo $js;
