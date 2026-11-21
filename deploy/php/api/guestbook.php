<?php
/* API สมุดเยี่ยม (สัญญาเดียวกับ server.js / Cloudflare Worker ของโปรเจกต์ จึงใช้กับหน้าเว็บเดิมได้โดยไม่ต้องแก้):
 *   GET  guestbook.php  -> [{id,name,message,rating,place,at}] ข้อความที่แสดงแล้ว ใหม่สุดก่อน (สูงสุด 200)
 *   POST guestbook.php  {name,message,rating,place} -> 201 {…รายการที่บันทึก}  (สมุดเยี่ยมแสดงทันที ผู้ดูแลซ่อน/ลบภายหลังได้ที่ /admin/)
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

lop_handle_preflight();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    if ($method === 'GET' || $method === 'HEAD') {
        $st = lop_db()->query('SELECT id, name, message, rating, place, created_at FROM ' . lop_table() . " WHERE kind = 'guestbook' AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 200");
        lop_json(array_map('lop_public_row', $st->fetchAll()), 200, lop_cors_headers() + ['Cache-Control' => 'public, max-age=15']);
    }
    if ($method !== 'POST') lop_json(['error' => 'method not allowed'], 405, ['Allow' => 'GET, POST, OPTIONS']);

    $b = lop_input();
    $name = lop_clean($b['name'] ?? '', 40);
    $message = lop_clean($b['message'] ?? '', 500);
    $rating = max(0, min(5, (int)($b['rating'] ?? 0)));
    $place = (string)($b['place'] ?? '');
    if ($place !== '' && !lop_valid_place($place)) $place = '';
    if (!empty($b['website'])) lop_json(['id' => lop_new_id(), 'name' => $name, 'message' => $message, 'rating' => $rating, 'place' => $place, 'at' => lop_iso(gmdate('Y-m-d H:i:s'))], 201); // ช่องล่อบอต: ทำเป็นสำเร็จแต่ไม่บันทึก
    lop_captcha_verify($b);
    if ($name === '') lop_fail('name');
    if (lop_len($message) < 3) lop_fail('short');
    if (lop_has_link($name) || lop_has_link($message)) lop_fail('links');
    lop_rate_check('guestbook', $place);

    $row = lop_insert('guestbook', $place, $name, $message, $rating, 'approved', (string)($b['lang'] ?? ''));
    lop_notify_new('guestbook', $row['id'], $place, $name, $rating, $message);
    lop_json(['id' => $row['id'], 'name' => $name, 'message' => $message, 'rating' => $rating, 'place' => $place, 'at' => lop_iso($row['created'])], 201, lop_cors_headers());
} catch (Throwable $e) {
    error_log('lopburi guestbook: ' . $e->getMessage());
    lop_fail('server', 500);
}
