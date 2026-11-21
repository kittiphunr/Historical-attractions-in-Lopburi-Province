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
    'captcha' => 'ยืนยันตัวตนไม่สำเร็จ ลองใหม่อีกครั้ง',
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
        $pdo = new PDO('mysql:host=' . ($c['db_host'] ?? 'localhost') . (!empty($c['db_port']) ? ';port=' . (int)$c['db_port'] : '') . ';dbname=' . ($c['db_name'] ?? '') . ';charset=utf8mb4', (string)($c['db_user'] ?? ''), (string)($c['db_pass'] ?? ''), [
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

/* ---------- CAPTCHA ----------
 * pow (ค่าเริ่มต้น): เซิร์ฟเวอร์ออกโจทย์ {salt, exp, sig} เบราว์เซอร์หาเลข n ที่ทำให้ SHA-256(salt + n) ขึ้นต้นด้วยบิต 0 ครบตามที่กำหนด
 *   (ใช้เวลา ~1 วินาทีต่อครั้งในเบราว์เซอร์ ผู้ใช้ไม่ต้องทำอะไร ไม่มีบริการภายนอก) โจทย์ผูกกับ IP (ค่าแฮช) และหมดอายุใน 10 นาที
 * turnstile: ตรวจโทเคนกับ Cloudflare Turnstile (ต้องมี turnstile_site_key และ turnstile_secret ใน config)
 * off: ไม่ตรวจ */
const LOP_POW_TTL = 600;
function lop_captcha_mode(): string {
    $m = lop_config()['captcha'] ?? 'pow';
    return in_array($m, ['pow', 'turnstile', 'off'], true) ? $m : 'pow';
}
function lop_pow_bits(): int { return max(8, min(22, (int)(lop_config()['captcha_bits'] ?? 16))); }
function lop_pow_sign(string $salt, int $exp): string {
    return hash_hmac('sha256', $salt . '|' . $exp . '|' . lop_ip_hash(), (string)lop_config()['ip_salt'] . '|captcha');
}
function lop_zero_bits(string $bin): int {
    $n = 0;
    for ($i = 0, $l = strlen($bin); $i < $l; $i++) {
        $b = ord($bin[$i]);
        if ($b === 0) { $n += 8; continue; }
        while (($b & 0x80) === 0) { $n++; $b = ($b << 1) & 0xFF; }
        break;
    }
    return $n;
}
function lop_turnstile_check(string $token): bool {
    $secret = (string)(lop_config()['turnstile_secret'] ?? '');
    if ($secret === '' || $token === '' || strlen($token) > 2048) return false;
    $data = http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => lop_ip()]);
    $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    $out = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $data, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4]);
        $out = curl_exec($ch); curl_close($ch);
    } elseif (ini_get('allow_url_fopen')) {
        $out = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $data, 'timeout' => 6]]));
    }
    if (!is_string($out)) { error_log('lopburi captcha: เรียก Turnstile ไม่ได้ (ตรวจ curl/allow_url_fopen และการเชื่อมต่อออกนอกเครื่อง)'); return false; }
    $j = json_decode($out, true);
    return is_array($j) && !empty($j['success']);
}
/** ตรวจ CAPTCHA ของคำขอส่งข้อความ (ล้มเหลว = ตอบ 400 และจบ) */
function lop_captcha_verify(array $b): void {
    $mode = lop_captcha_mode();
    if ($mode === 'off') return;
    $c = $b['captcha'] ?? null;
    if (!is_array($c)) lop_fail('captcha');
    if ($mode === 'turnstile') { if (!lop_turnstile_check((string)($c['token'] ?? ''))) lop_fail('captcha'); return; }
    $salt = (string)($c['salt'] ?? ''); $exp = (int)($c['exp'] ?? 0); $n = (string)($c['n'] ?? ''); $sig = (string)($c['sig'] ?? '');
    if (!preg_match('/^[0-9a-f]{24}$/', $salt) || !preg_match('/^\d{1,10}$/', $n)) lop_fail('captcha');
    if ($exp < time() || $exp > time() + LOP_POW_TTL + 30) lop_fail('captcha');
    if (!hash_equals(lop_pow_sign($salt, $exp), $sig)) lop_fail('captcha');
    if (lop_zero_bits(hash('sha256', $salt . $n, true)) < lop_pow_bits()) lop_fail('captcha');
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
