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
if (!extension_loaded('gd') || !function_exists('imagewebp')) up_fail('เซิร์ฟเวอร์นี้ไม่มีส่วนขยาย GD (รองรับ WebP) จึงอัปโหลดรูปไม่ได้ ติดต่อผู้ให้บริการโฮสต์เพื่อเปิดใช้ GD', 501);

$tmp = (string)$f['tmp_name'];
$info = @getimagesize($tmp);
$types = [IMAGETYPE_JPEG => 'jpeg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
if (!$info || !isset($types[$info[2]])) up_fail('รองรับเฉพาะรูป JPEG, PNG หรือ WebP');
[$w, $h] = [(int)$info[0], (int)$info[1]];
if ($w < 1 || $h < 1 || $w > 12000 || $h > 12000 || $w * $h > 60000000) up_fail('ขนาดภาพใหญ่เกินไป (ไม่เกิน 12,000 px ต่อด้าน และ 60 ล้านพิกเซล)');

$kind = $types[$info[2]];
$src = $kind === 'jpeg' ? @imagecreatefromjpeg($tmp) : ($kind === 'png' ? @imagecreatefrompng($tmp) : @imagecreatefromwebp($tmp));
if (!$src) up_fail('อ่านไฟล์ภาพไม่ได้ (ไฟล์อาจเสียหาย)');
if ($kind === 'jpeg' && function_exists('exif_read_data')) {   // หมุนตามทิศที่ถ่าย
    $ex = @exif_read_data($tmp);
    $rot = [3 => 180, 6 => -90, 8 => 90][(int)($ex['Orientation'] ?? 1)] ?? 0;
    if ($rot) { $r = imagerotate($src, $rot, 0); if ($r) { $src = $r; [$w, $h] = [imagesx($src), imagesy($src)]; } }
}
$maxW = 1600;
if ($w > $maxW) {
    $nh = max(1, (int)round($h * $maxW / $w));
    $dst = imagecreatetruecolor($maxW, $nh);
    imagealphablending($dst, false); imagesavealpha($dst, true);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $maxW, $nh, $w, $h);
    $src = $dst; [$w, $h] = [$maxW, $nh];
}
if (!imageistruecolor($src)) imagepalettetotruecolor($src);
imagesavealpha($src, true);

$dir = dirname(__DIR__) . '/' . LOP_UPLOAD_DIR . '/' . $place;
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) { error_log('lopburi upload: สร้างโฟลเดอร์ไม่ได้ ' . $dir); up_fail('สร้างโฟลเดอร์เก็บรูปไม่ได้ (ตรวจสิทธิ์เขียนของโฟลเดอร์ uploads/)', 500); }
if (count(glob($dir . '/*.webp') ?: []) >= 400) up_fail('มีรูปของสถานที่นี้มากเกินไป (400 ไฟล์) ลบรูปที่ไม่ใช้ผ่านโฮสต์ก่อน');
$name = bin2hex(random_bytes(10)) . '.webp';
if (!@imagewebp($src, $dir . '/' . $name, 82) || !is_file($dir . '/' . $name)) { error_log('lopburi upload: เขียนไฟล์ไม่ได้'); up_fail('บันทึกรูปไม่ได้ (ตรวจสิทธิ์เขียนของโฟลเดอร์ uploads/)', 500); }
@chmod($dir . '/' . $name, 0644);
lop_json(['url' => '../' . LOP_UPLOAD_DIR . '/' . $place . '/' . $name]);
