<?php
/* ออกโจทย์ยืนยันตัวตนก่อนส่งข้อความ (CAPTCHA):
 *   GET captcha.php -> {mode:'pow', salt, exp, bits, sig}   โหมดค่าเริ่มต้น: ให้เบราว์เซอร์คำนวณ proof-of-work เล็กน้อย (ผู้ใช้ไม่ต้องทำอะไร)
 *                      {mode:'turnstile', sitekey}           ใช้ Cloudflare Turnstile (ตั้ง captcha=turnstile ใน config)
 *                      {mode:'off'}                          ปิด
 * การตรวจคำตอบทำใน guestbook.php / reviews.php ก่อนบันทึกข้อความ (lop_captcha_verify ใน lib.php)
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

lop_handle_preflight();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') lop_json(['error' => 'method not allowed'], 405, ['Allow' => 'GET, OPTIONS']);
try {
    $mode = lop_captcha_mode();
    $h = lop_cors_headers() + ['Cache-Control' => 'no-store'];
    if ($mode === 'off') lop_json(['mode' => 'off'], 200, $h);
    if ($mode === 'turnstile') lop_json(['mode' => 'turnstile', 'sitekey' => (string)(lop_config()['turnstile_site_key'] ?? '')], 200, $h);
    $salt = bin2hex(random_bytes(12));
    $exp = time() + LOP_POW_TTL;
    lop_json(['mode' => 'pow', 'salt' => $salt, 'exp' => $exp, 'bits' => lop_pow_bits(), 'sig' => lop_pow_sign($salt, $exp)], 200, $h);
} catch (Throwable $e) {
    error_log('lopburi captcha: ' . $e->getMessage());
    lop_fail('server', 500);
}
