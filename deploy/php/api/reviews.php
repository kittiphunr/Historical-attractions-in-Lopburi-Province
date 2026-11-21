<?php
/* API รีวิวสถานที่:
 *   GET  reviews.php?place=sam-yot[&limit=10&offset=0] -> {place, count, avg, items:[{id,name,message,rating,place,at}]}
 *        (เฉพาะรีวิวที่ผู้ดูแลอนุมัติแล้ว ใหม่สุดก่อน; avg = คะแนนเฉลี่ย 1 ตำแหน่งทศนิยม หรือ null ถ้ายังไม่มี)
 *   POST reviews.php {place, name, rating(1-5), message} -> 202 {ok:true, status:"pending"}  (รีวิวใหม่รอผู้ดูแลตรวจที่ /admin/ ก่อนแสดง)
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

lop_handle_preflight();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    if ($method === 'GET' || $method === 'HEAD') {
        $place = (string)($_GET['place'] ?? '');
        if (!lop_valid_place($place)) lop_fail('bad');
        $limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));
        $offset = max(0, min(5000, (int)($_GET['offset'] ?? 0)));
        $db = lop_db(); $t = lop_table();
        $st = $db->prepare("SELECT COUNT(*) AS c, AVG(rating) AS a FROM $t WHERE kind = 'review' AND place = ? AND status = 'approved'");
        $st->execute([$place]); $sum = $st->fetch();
        $st = $db->prepare("SELECT id, name, message, rating, place, created_at FROM $t WHERE kind = 'review' AND place = ? AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT $limit OFFSET $offset");
        $st->execute([$place]);
        lop_json(['place' => $place, 'count' => (int)$sum['c'], 'avg' => $sum['a'] === null ? null : round((float)$sum['a'], 1), 'items' => array_map('lop_public_row', $st->fetchAll())],
            200, lop_cors_headers() + ['Cache-Control' => 'public, max-age=15']);
    }
    if ($method !== 'POST') lop_json(['error' => 'method not allowed'], 405, ['Allow' => 'GET, POST, OPTIONS']);

    $b = lop_input();
    $place = (string)($b['place'] ?? '');
    if (!lop_valid_place($place)) lop_fail('bad');
    if (!empty($b['website'])) lop_json(['ok' => true, 'status' => 'pending'], 202);   // ช่องล่อบอต
    $name = lop_clean($b['name'] ?? '', 40);
    $message = lop_clean($b['message'] ?? '', 500);
    $rating = (int)($b['rating'] ?? 0);
    lop_captcha_verify($b);
    if ($name === '') lop_fail('name');
    if ($rating < 1 || $rating > 5) lop_fail('rating');
    if (lop_len($message) < 5) lop_fail('short');
    if (lop_has_link($name) || lop_has_link($message)) lop_fail('links');
    lop_rate_check('review', $place);

    $row = lop_insert('review', $place, $name, $message, $rating, 'pending', (string)($b['lang'] ?? ''));
    lop_notify_new('review', $row['id'], $place, $name, $rating, $message);
    lop_json(['ok' => true, 'status' => 'pending'], 202, lop_cors_headers());
} catch (Throwable $e) {
    error_log('lopburi reviews: ' . $e->getMessage());
    lop_fail('server', 500);
}
