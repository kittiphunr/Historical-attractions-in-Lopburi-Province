<?php
/* ส่วนกลางของ API สมุดเยี่ยมและรีวิว (PHP 7.4+ / PDO MySQL) — ไฟล์นี้ถูกเรียกจาก guestbook.php, reviews.php และ admin/index.php
 * ห้ามเปิดจากเว็บโดยตรง (api/.htaccess บล็อกไว้) */
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'lib.php') { http_response_code(403); exit; }

const LOP_MSG = [
    'name'   => 'กรุณาใส่ชื่อ',
    'short'  => 'ข้อความสั้นเกินไป',
    'bad'    => 'ข้อมูลไม่ถูกต้อง',
    'links'  => 'ห้ามใส่ลิงก์ในข้อความ',
    'rate'   => 'ส่งถี่เกินไป รอสักครู่',
    'busy'   => 'ระบบรับข้อความหนาแน่น ลองใหม่ภายหลัง',
    'dup'    => 'คุณเพิ่งรีวิวสถานที่นี้ไปแล้ว',
    'rating' => 'กรุณาให้คะแนนดาว',
    'server' => 'ระบบขัดข้อง ลองใหม่ภายหลัง',
];

ini_set('display_errors', '0');
mb_internal_encoding('UTF-8');

function lop_json($data, int $code = 200, array $headers = []): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $k => $v) header("$k: $v");
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function lop_fail(string $key, int $code = 400, array $headers = []): void { lop_json(['error' => LOP_MSG[$key] ?? LOP_MSG['bad']], $code, $headers); }

function lop_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $paths = [];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) $paths[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')) . '/lopburi-config.php';
    $paths[] = __DIR__ . '/config.php';
    foreach ($paths as $p) {
        if (is_file($p)) { $c = require $p; if (is_array($c)) { return $cfg = $c + ['table_prefix' => 'lop_', 'allowed_origins' => [], 'trust_proxy' => false, 'limits' => [], 'ip_salt' => '', 'admin_password_hash' => '']; } }
    }
    error_log('lopburi: ไม่พบ config.php');
    lop_fail('server', 500);
}
function lop_limit(string $key): array {
    $d = ['guestbook_per_ip' => [3, 600], 'review_per_ip' => [3, 3600], 'review_per_place' => [1, 86400], 'guestbook_global' => [120, 3600], 'review_global' => [60, 3600]];
    $l = lop_config()['limits'][$key] ?? null;
    return (is_array($l) && count($l) === 2) ? [(int)$l[0], (int)$l[1]] : $d[$key];
}

function lop_table(): string {
    $p = lop_config()['table_prefix'];
    if (!preg_match('/^[A-Za-z0-9_]{0,20}$/', $p)) { error_log('lopburi: table_prefix ไม่ถูกต้อง'); lop_fail('server', 500); }
    return '`' . $p . 'reviews`';
}
function lop_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = lop_config();
    try {
        $pdo = new PDO('mysql:host=' . ($c['db_host'] ?? 'localhost') . ';dbname=' . ($c['db_name'] ?? '') . ';charset=utf8mb4', (string)($c['db_user'] ?? ''), (string)($c['db_pass'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
    } catch (Throwable $e) { error_log('lopburi db: ' . $e->getMessage()); lop_fail('server', 500); }
    return $pdo;
}

/** รหัสสถานที่ที่รับได้ (อ่านจาก places.json ที่สร้างตอนทำชุดติดตั้ง: { "sam-yot": "พระปรางค์สามยอด", ... }) */
function lop_places(): array {
    static $places = null;
    if ($places !== null) return $places;
    $f = __DIR__ . '/places.json';
    $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return $places = is_array($j) ? $j : [];
}
function lop_valid_place(string $p): bool { return $p !== '' && isset(lop_places()[$p]); }

function lop_substr(string $s, int $max): string {
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : (preg_match('/^.{0,' . $max . '}/us', $s, $m) ? $m[0] : substr($s, 0, $max));
}
/** ตัดอักขระควบคุมและอักขระกำกับทิศทางข้อความ ตัดช่องว่างหัวท้าย และจำกัดความยาว (นับเป็นตัวอักษร) */
function lop_clean($s, int $max): string {
    $s = (string)$s;
    if (!preg_match('//u', $s)) $s = (string)@iconv('UTF-8', 'UTF-8//IGNORE', $s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $s) ?? '';
    return lop_substr(trim($s), $max);
}
function lop_len(string $s): int { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen(utf8_decode($s)); }
function lop_has_link(string $s): bool {
    return (bool)preg_match('~(https?://|www\.|[a-z0-9-]+\.(com|net|org|info|xyz|top|ru|cn|co|io|me|biz|click|link|th)\b)~i', $s);
}

function lop_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!empty(lop_config()['trust_proxy'])) {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR'] as $h) {
            if (!empty($_SERVER[$h])) { $ip = trim(explode(',', (string)$_SERVER[$h])[0]); break; }
        }
    }
    return $ip;
}
function lop_ip_hash(): string { return substr(hash('sha256', lop_ip() . '|' . lop_config()['ip_salt']), 0, 20); }

/** ตรวจ Origin: ถ้ามี ต้องเป็นโดเมนเดียวกับ API หรืออยู่ในรายการ allowed_origins */
function lop_origin_allowed(): ?string {
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o === '') return null;
    $host = parse_url($o, PHP_URL_HOST);
    $same = $host && strcasecmp($host . (($p = parse_url($o, PHP_URL_PORT)) ? ':' . $p : ''), $_SERVER['HTTP_HOST'] ?? '') === 0;
    foreach (lop_config()['allowed_origins'] as $a) if (strcasecmp(rtrim((string)$a, '/'), $o) === 0) return $o;
    return $same ? $o : null;
}
function lop_cors_headers(): array {
    $o = lop_origin_allowed();
    return $o ? ['Access-Control-Allow-Origin' => $o, 'Vary' => 'Origin'] : ['Vary' => 'Origin'];
}
function lop_handle_preflight(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'OPTIONS') return;
    if (!lop_origin_allowed() && !empty($_SERVER['HTTP_ORIGIN'])) { http_response_code(403); exit; }
    http_response_code(204);
    foreach (lop_cors_headers() + ['Access-Control-Allow-Methods' => 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers' => 'Content-Type', 'Access-Control-Max-Age' => '86400'] as $k => $v) header("$k: $v");
    exit;
}

/** อ่านเนื้อหา JSON ของคำขอ POST (ไม่เกิน 4,000 ไบต์) */
function lop_input(): array {
    if (!empty($_SERVER['HTTP_ORIGIN']) && !lop_origin_allowed()) lop_fail('bad', 403);
    $raw = file_get_contents('php://input', false, null, 0, 4001);
    if ($raw === false || strlen($raw) > 4000) lop_fail('bad', 413);
    $b = json_decode($raw, true, 4);
    if (!is_array($b)) lop_fail('bad');
    return $b;
}

function lop_count_since(string $where, array $args, int $seconds): int {
    $st = lop_db()->prepare('SELECT COUNT(*) FROM ' . lop_table() . ' WHERE ' . $where . ' AND created_at > ?');
    $st->execute(array_merge($args, [gmdate('Y-m-d H:i:s', time() - $seconds)]));
    return (int)$st->fetchColumn();
}
/** ตรวจความถี่ของคำขอส่งข้อความ: ต่อผู้ใช้ (ip_hash) และทั้งระบบ */
function lop_rate_check(string $kind, string $place): void {
    $ip = lop_ip_hash();
    [$n, $s] = lop_limit($kind . '_per_ip');
    if (lop_count_since('kind = ? AND ip_hash = ?', [$kind, $ip], $s) >= $n) lop_fail('rate', 429, ['Retry-After' => (string)$s]);
    if ($kind === 'review') {
        [$n, $s] = lop_limit('review_per_place');
        if (lop_count_since('kind = ? AND ip_hash = ? AND place = ?', [$kind, $ip, $place], $s) >= $n) lop_fail('dup', 429, ['Retry-After' => (string)$s]);
    }
    [$n, $s] = lop_limit($kind . '_global');
    if (lop_count_since('kind = ?', [$kind], $s) >= $n) lop_fail('busy', 429, ['Retry-After' => '900']);
}

function lop_new_id(): string { return bin2hex(random_bytes(6)); }
function lop_iso(string $dt): string { return gmdate('Y-m-d\TH:i:s\Z', (int)strtotime($dt . ' UTC')); }

/** บันทึกข้อความใหม่ (ตรวจข้อมูลแล้ว) แล้วคืนแถวที่บันทึก */
function lop_insert(string $kind, string $place, string $name, string $message, int $rating, string $status, string $lang): array {
    $row = ['id' => lop_new_id(), 'created' => gmdate('Y-m-d H:i:s')];
    $st = lop_db()->prepare('INSERT INTO ' . lop_table() . ' (id, kind, place, name, message, rating, status, lang, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$row['id'], $kind, $place, $name, $message, $rating, $status, lop_substr(preg_replace('/[^A-Za-z0-9-]/', '', $lang) ?? '', 8), lop_ip_hash(), $row['created']]);
    return $row;
}
function lop_public_row(array $r): array {
    return ['id' => $r['id'], 'name' => $r['name'], 'message' => $r['message'], 'rating' => (int)$r['rating'], 'place' => $r['place'], 'at' => lop_iso($r['created_at'])];
}
