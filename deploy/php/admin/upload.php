<?php
/* อัปโหลดรูปจากตัวแก้ไขข้อความ (CKEditor ส่งมาที่นี่) — ต้องล็อกอินผู้ดูแล + โทเคน CSRF ในหัว X-CSRF-Token
 * รูปถูกถอดรหัสแล้วเข้ารหัสใหม่เป็น WebP ด้วย GD (ลบข้อมูล EXIF/ตำแหน่ง และตัดไฟล์ที่ไม่ใช่รูปจริงทิ้ง) ย่อให้กว้างไม่เกิน 1600 px
 * ตอบ JSON { "url": "../uploads/places/<สถานที่>/<ชื่อสุ่ม>.webp" } หรือ { "error": { "message": "…" } } */
declare(strict_types=1);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); header('Allow: POST'); exit; }
// ไม่ใช้ common.php เพราะต้องตอบเป็น JSON (ไม่ใช่หน้าเข้าสู่ระบบ) — ใช้เซสชันเดียวกัน
require __DIR__ . '/../api/lib.php';
require __DIR__ . '/../api/content.php';
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params(['lifetime' => 0, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_name('lopburi_admin');
session_start();
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function up_fail(string $msg, int $code = 400): void { lop_json(['error' => ['message' => $msg]], $code); }

if (empty($_SESSION['ok'])) up_fail('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่', 401);
if (empty($_SESSION['csrf']) || !hash_equals((string)$_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) up_fail('คำขอไม่ถูกต้อง โหลดหน้านี้ใหม่แล้วลองอีกครั้ง', 403);

$place = (string)($_GET['place'] ?? '');
if (!preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $place) || !lop_valid_place($place)) up_fail('ไม่พบสถานที่');
$f = $_FILES['upload'] ?? null;
if (!is_array($f) || !isset($f['error']) || is_array($f['error'])) up_fail('ไม่พบไฟล์ที่อัปโหลด');
if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) up_fail('ไฟล์ใหญ่เกินที่เซิร์ฟเวอร์ยอมรับ (ลดขนาดภาพหรือเพิ่ม upload_max_filesize)', 413);
if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) up_fail('อัปโหลดไม่สำเร็จ ลองอีกครั้ง');
$max = 8 * 1024 * 1024;
if ((int)$f['size'] <= 0 || (int)$f['size'] > $max) up_fail('ไฟล์ต้องไม่เกิน 8 MB', 413);
$tmpPath = (string)$f['tmp_name'];
$dir = dirname(__DIR__) . '/' . LOP_UPLOAD_DIR . '/' . $place;
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) { error_log('lopburi upload: สร้างโฟลเดอร์ไม่ได้ ' . $dir); up_fail('สร้างโฟลเดอร์เก็บรูปไม่ได้ (ตรวจสิทธิ์เขียนของโฟลเดอร์ uploads/)', 500); }
if (count(glob($dir . '/*.webp') ?: []) >= 400) up_fail('มีรูปของสถานที่นี้มากเกินไป (400 ไฟล์) ลบรูปที่ไม่ใช้ผ่านโฮสต์ก่อน');
$name = bin2hex(random_bytes(10)) . '.webp';
$err = lop_img_to_webp($tmpPath, $dir . '/' . $name, 1600);
if ($err !== null) up_fail($err, 400);
lop_json(['url' => '../' . LOP_UPLOAD_DIR . '/' . $place . '/' . $name]);
