<?php
/* ตัวช่วยติดตั้งสมุดเยี่ยมและรีวิว (แบบเดียวกับตัวช่วยติดตั้งของระบบเงินเดือน):
 *   1 ตรวจความพร้อม → 2 ฐานข้อมูล (ทดสอบการเชื่อมต่อ) → 3 รหัสผู้ดูแล → 4 ติดตั้ง (สร้างตาราง + เขียนไฟล์ตั้งค่า)
 * ติดตั้งเสร็จแล้ว (พบไฟล์ตั้งค่า) ตัวช่วยนี้ใช้งานไม่ได้อีก และมีปุ่มลบตัวเองออกจากเซิร์ฟเวอร์
 * ป้องกันเพิ่มได้ด้วยตัวแปรสภาพแวดล้อม LOPBURI_INSTALL_KEY (ต้องกรอกรหัสก่อนใช้ตัวช่วย) — ไม่บังคับ
 * ไม่ใช้ lib.php (ยังไม่มีไฟล์ตั้งค่า) · อัปโหลดไฟล์นี้ไว้ที่รากเว็บ (public_html/install.php)
 */
declare(strict_types=1);

const INST_TABLE = 'lop_reviews';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');
session_name('LOPINST');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'path' => '/']);
session_start();

function h($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function csrf_input(): string { return '<input type="hidden" name="csrf" value="' . h(csrf()) . '">'; }
function go(int|string $step): never { header('Location: install.php?step=' . $step); exit; }
function notice(?string $msg = null, string $type = 'err'): ?array
{
    if ($msg !== null) { $_SESSION['notice'] = [$type, $msg]; return null; }
    $n = $_SESSION['notice'] ?? null; unset($_SESSION['notice']); return $n;
}
function field(string $label, string $name, string $value = '', string $type = 'text', string $attrs = '', string $hint = ''): string
{
    return '<label class="f"><span>' . h($label) . '</span><input type="' . h($type) . '" name="' . h($name) . '" value="' . h($value) . '" ' . $attrs . '>'
        . ($hint !== '' ? '<small>' . $hint . '</small>' : '') . '</label>';
}

/* ---------- ตำแหน่งไฟล์ตั้งค่า (ตรงกับที่ api/lib.php ค้นหา) ---------- */
function cfg_paths(): array
{
    $paths = [];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) $paths[] = dirname(rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')) . '/lopburi-config.php';
    $paths[] = __DIR__ . '/api/config.php';
    return $paths;
}
function cfg_existing(): ?string { foreach (cfg_paths() as $p) if (is_file($p)) return $p; return null; }
/** เลือกที่เขียนไฟล์ตั้งค่า: นอกโฟลเดอร์เว็บก่อน (ปลอดภัยกว่า) ไม่ได้ก็ api/config.php */
function cfg_target(): ?string
{
    foreach (cfg_paths() as $p) { $d = dirname($p); if (is_dir($d) && is_writable($d)) return $p; }
    return null;
}

function requirements(): array
{
    $ext = fn(string $n) => extension_loaded($n);
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $row = fn(string $l, bool $ok, string $okM, string $badM, bool $req) => [$l, $ok, $ok ? $okM : $badM, $req];
    $t = cfg_target();
    return [
        $row('PHP 7.4 ขึ้นไป (แนะนำ 8.x)', version_compare(PHP_VERSION, '7.4.0', '>='), 'พบ PHP ' . PHP_VERSION, 'พบ PHP ' . PHP_VERSION . ' — ต้องอัปเกรดเป็น 7.4 ขึ้นไป', true),
        $row('ส่วนขยาย pdo_mysql (เชื่อมต่อ MySQL/MariaDB)', $ext('pdo_mysql'), 'พร้อมใช้งาน', 'ไม่พบ — เปิดส่วนขยาย pdo_mysql (cPanel → Select PHP Version → Extensions)', true),
        $row('ส่วนขยาย mbstring (ภาษาไทย)', $ext('mbstring'), 'พร้อมใช้งาน', 'ไม่พบ — เปิดส่วนขยาย mbstring', true),
        $row('โฟลเดอร์ api/ ครบ (lib.php, guestbook.php, reviews.php)', is_file(__DIR__ . '/api/lib.php') && is_file(__DIR__ . '/api/guestbook.php') && is_file(__DIR__ . '/api/reviews.php'), 'พบไฟล์', 'ไม่พบ — อัปโหลดโฟลเดอร์ api/ ให้ครบ', true),
        $row('ไฟล์ตาราง api/schema.sql', is_file(__DIR__ . '/api/schema.sql'), 'พบไฟล์', 'ไม่พบ — อัปโหลดโฟลเดอร์ api/ ให้ครบ', true),
        $row('เขียนไฟล์ตั้งค่าได้', $t !== null, 'จะบันทึกที่ ' . ($t ? (str_contains($t, '/api/') ? 'api/config.php' : 'นอกโฟลเดอร์เว็บ (' . basename($t) . ') — ปลอดภัยที่สุด') : ''), 'เขียนไม่ได้ — ให้สิทธิ์เขียนโฟลเดอร์ api/ แก่เว็บเซิร์ฟเวอร์ชั่วคราว (หรืออัปโหลด config ด้วยตนเองตามคู่มือ)', true),
        $row('ส่วนขยาย openssl / random_bytes', function_exists('random_bytes'), 'พร้อมใช้งาน', 'ไม่พบ', true),
        $row('HTTPS', $https, 'ใช้ HTTPS แล้ว', 'ยังไม่ใช้ HTTPS — ควรเปิด HTTPS ก่อนตั้งรหัสผ่านผู้ดูแล (รหัสผ่านจะถูกส่งแบบไม่เข้ารหัส)', false),
    ];
}

function db_connect(array $db): PDO
{
    return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $db['host'], $db['port'], $db['name']), $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_TIMEOUT => 5,
    ]);
}
function run_schema(PDO $pdo): int
{
    $sql = (string)file_get_contents(__DIR__ . '/api/schema.sql'); $n = 0;
    foreach (explode(';', preg_replace('/--[^\n]*/', '', $sql)) as $stmt) {
        $stmt = trim($stmt);
        if ($stmt === '') continue;
        $pdo->exec($stmt); $n++;
    }
    return $n;
}
function write_config(string $file, array $v): bool
{
    $body = "<?php\n// สร้างโดยตัวช่วยติดตั้ง install.php — มีรหัสผ่านฐานข้อมูล ห้ามเผยแพร่/ห้ามใส่ใน git\nreturn " . var_export($v, true) . ";\n";
    if (@file_put_contents($file, $body, LOCK_EX) === false) return false;
    @chmod($file, 0640);
    return true;
}
function issues(string $pw): array
{
    $i = [];
    if (mb_strlen($pw) < 10) $i[] = 'รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร';
    if (!preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) $i[] = 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข';
    return $i;
}

function page(string $title, int $step, string $body, int $status = 200): never
{
    http_response_code($status);
    $labels = ['ตรวจความพร้อม', 'ฐานข้อมูล', 'ผู้ดูแล', 'ติดตั้ง'];
    $n = notice();
    ?><!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title><?= h($title) ?> · ตัวช่วยติดตั้ง</title>
<style>
:root{--ink:#1f2937;--mute:#64748b;--line:#e2e8f0;--brand:#8a5a12;--ok:#047857;--bad:#b91c1c;--bg:#faf7f0}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,"Noto Sans Thai",sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}h1{margin:.2em 0 .6em;font-size:1.5rem;color:var(--brand)}h2{margin:.2em 0 .4em;font-size:1.25rem}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
ol.steps{display:flex;gap:6px;list-style:none;padding:0;margin:0 0 16px;font-size:.8rem;text-align:center}ol.steps li{flex:1}
ol.steps b{display:flex;margin:0 auto 2px;width:30px;height:30px;border-radius:50%;align-items:center;justify-content:center;background:#e2e8f0;color:#475569}
ol.steps .on b{background:var(--brand);color:#fff}ol.steps .done b{background:var(--ok);color:#fff}ol.steps .on{font-weight:700;color:var(--brand)}
.f{display:block;margin:0 0 12px}.f span{display:block;font-weight:600;font-size:.9rem}.f small{display:block;color:var(--mute)}
input[type=text],input[type=password],input[type=number]{width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
.btn{display:inline-block;border:0;border-radius:8px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer;background:var(--brand);color:#fff;text-decoration:none}.btn.l{background:#e2e8f0;color:var(--ink)}
.msg{padding:10px 14px;border-radius:8px;margin:0 0 14px}.msg.err{background:#fee2e2;color:#7f1d1d}.msg.ok{background:#d1fae5;color:#064e3b}
table{width:100%;border-collapse:collapse;font-size:.92rem}td{padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.y{color:var(--ok);font-weight:700}.x{color:var(--bad);font-weight:700}.w{color:#b45309;font-weight:700}
code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:.88em}.row{display:flex;gap:8px;flex-wrap:wrap}
</style></head><body><main>
<p style="margin:0;color:var(--mute)">ลพบุรี · เมืองสามยุค</p><h1>ตัวช่วยติดตั้งสมุดเยี่ยมและรีวิวสถานที่</h1>
<?php if ($step >= 1 && $step <= 4): ?><ol class="steps"><?php foreach ($labels as $i => $l): $k = $i + 1; ?>
<li class="<?= $k < $step ? 'done' : ($k === $step ? 'on' : '') ?>"><b><?= $k < $step ? '✓' : $k ?></b><?= h($l) ?></li><?php endforeach; ?></ol><?php endif; ?>
<?php if ($n): ?><div class="msg <?= $n[0] === 'ok' ? 'ok' : 'err' ?>" role="alert"><?= h($n[1]) ?></div><?php endif; ?>
<div class="card"><?= $body ?></div></main></body></html><?php
    exit;
}

/* ---------- ติดตั้งแล้ว: ล็อก ---------- */
if ($existing = cfg_existing()) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'cleanup') {
        if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { http_response_code(400); exit('คำขอไม่ถูกต้อง (CSRF) กรุณากลับไปโหลดหน้าใหม่'); }
        $removed = @unlink(__FILE__);
        if ($removed) { header('Location: admin/'); exit; }
        notice('ลบ install.php ไม่ได้ (สิทธิ์ไม่พอ) — กรุณาลบไฟล์ install.php ด้วยตนเองใน File Manager');
        header('Location: install.php'); exit;
    }
    $done = $_SESSION['done'] ?? null;
    $body = $done
        ? '<h2 style="color:var(--ok)">✓ ติดตั้งเสร็จเรียบร้อย</h2><p>สร้างตาราง <code>' . INST_TABLE . '</code> และบันทึกไฟล์ตั้งค่าที่ <code>' . h($done['where']) . '</code> แล้ว</p>'
          . '<ol><li>เปิด <a href="admin/">หน้าผู้ดูแล</a> แล้วเข้าสู่ระบบด้วยรหัสผ่านที่เพิ่งตั้ง</li>'
          . '<li>เปิดหน้าสถานที่ เช่น <a href="places/sam-yot.html">places/sam-yot.html</a> เลื่อนลงดูส่วน "รีวิวจากผู้เข้าชม" ลองเขียนรีวิวทดสอบแล้วอนุมัติที่หน้าผู้ดูแล</li>'
          . '<li>เปิด <code>api/config.php</code> จากเว็บ ต้องขึ้น <b>403</b> (ถ้าเห็นเนื้อหาไฟล์ ให้ย้ายไฟล์ไปไว้นอกโฟลเดอร์เว็บ)</li></ol>'
        : '<h2>ระบบนี้ติดตั้งเรียบร้อยแล้ว</h2><p>พบไฟล์ตั้งค่าอยู่แล้ว ตัวช่วยติดตั้งถูกล็อกเพื่อความปลอดภัย หากต้องการติดตั้งใหม่ ให้ลบไฟล์ตั้งค่า (<code>' . h(basename($existing)) . '</code>) ก่อน</p>';
    page('ติดตั้งแล้ว', 0, $body . '<p><b>เพื่อความปลอดภัย ลบตัวช่วยติดตั้งออกจากเซิร์ฟเวอร์:</b></p><form method="post">' . csrf_input()
        . '<input type="hidden" name="action" value="cleanup"><button class="btn">ลบ install.php แล้วไปหน้าผู้ดูแล</button></form>');
}

/* ---------- รหัสป้องกันตัวช่วย (ไม่บังคับ) ---------- */
$installKey = (string)getenv('LOPBURI_INSTALL_KEY');
if ($installKey !== '' && empty($_SESSION['auth'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) {
        $_SESSION['kf'] = ($_SESSION['kf'] ?? 0) + 1;
        if ($_SESSION['kf'] <= 5 && hash_equals($installKey, (string)($_POST['key'] ?? ''))) { $_SESSION['auth'] = true; go(1); }
        notice('รหัสติดตั้งไม่ถูกต้อง');
    }
    page('รหัสติดตั้ง', 0, '<h2>ยืนยันว่าคุณเป็นผู้ดูแลเซิร์ฟเวอร์</h2><p style="color:var(--mute)">เซิร์ฟเวอร์ตั้งรหัสป้องกันไว้ (ตัวแปร <code>LOPBURI_INSTALL_KEY</code>) ผิดเกิน 5 ครั้งต้องเปิดเบราว์เซอร์ใหม่</p><form method="post">'
        . csrf_input() . field('รหัสติดตั้ง', 'key', '', 'password', 'required autofocus') . '<button class="btn">ต่อไป</button></form>');
}

/* ---------- ประมวลผลแบบฟอร์ม ---------- */
$S = &$_SESSION['inst'];
$S = $S ?? ['max' => 1, 'db' => null, 'admin' => null];
$step = max(1, min((int)($_GET['step'] ?? $S['max']), (int)$S['max']));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { http_response_code(400); exit('คำขอไม่ถูกต้อง (CSRF) กรุณากลับไปโหลดหน้าใหม่'); }
    $act = $_POST['action'] ?? '';
    if ($act === 'requirements') {
        foreach (requirements() as [$l, $ok, $d, $req]) if ($req && !$ok) { notice('ยังมีรายการจำเป็นที่ไม่ผ่าน: ' . $l); go(1); }
        $S['max'] = max($S['max'], 2); go(2);
    }
    if ($act === 'db') {
        $db = ['host' => trim((string)($_POST['db_host'] ?? '')) ?: 'localhost', 'port' => trim((string)($_POST['db_port'] ?? '3306')) ?: '3306',
               'name' => trim((string)($_POST['db_name'] ?? '')), 'user' => trim((string)($_POST['db_user'] ?? '')), 'pass' => (string)($_POST['db_pass'] ?? '')];
        $S['db_form'] = $db;
        if ($db['name'] === '' || $db['user'] === '') { notice('กรอกชื่อฐานข้อมูลและผู้ใช้ให้ครบ'); go(2); }
        if (!preg_match('/^\d{1,5}$/', $db['port']) || !preg_match('/^[A-Za-z0-9_.\-:]+$/', $db['host']) || !preg_match('/^[A-Za-z0-9_$\-]+$/', $db['name'])) { notice('รูปแบบที่อยู่เซิร์ฟเวอร์/พอร์ต/ชื่อฐานข้อมูลไม่ถูกต้อง'); go(2); }
        try {
            $pdo = db_connect($db);
            $v = (string)$pdo->query('SELECT VERSION()')->fetchColumn();
            $S['db'] = $db; $S['db_version'] = $v; $S['max'] = max($S['max'], 3);
            notice('เชื่อมต่อฐานข้อมูลสำเร็จ (เวอร์ชัน ' . $v . ')', 'ok'); go(3);
        } catch (Throwable $e) {
            $S['db'] = null;
            notice('เชื่อมต่อไม่ได้: ' . (str_contains($e->getMessage(), '1045') ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ใน cPanel ชื่อมีคำนำหน้าบัญชี และต้องเพิ่มผู้ใช้เข้าฐานข้อมูลแล้ว)' : (str_contains($e->getMessage(), '1049') ? 'ไม่พบฐานข้อมูลชื่อนี้' : 'ตรวจที่อยู่เซิร์ฟเวอร์ ชื่อฐานข้อมูล ผู้ใช้ และรหัสผ่านอีกครั้ง'))); go(2);
        }
    }
    if ($act === 'admin') {
        if (!$S['db']) { go(2); }
        $pw = (string)($_POST['admin_pass'] ?? ''); $errs = issues($pw);
        if ($pw !== (string)($_POST['admin_pass2'] ?? '')) $errs[] = 'รหัสผ่านและการยืนยันไม่ตรงกัน';
        if ($errs) { notice(implode(' · ', $errs)); go(3); }
        $notify = trim((string)($_POST['notify_email'] ?? ''));
        if ($notify !== '' && (preg_match('/[\r\n,;<>]/', $notify) || !filter_var($notify, FILTER_VALIDATE_EMAIL))) { notice('อีเมลแจ้งเตือนไม่ถูกต้อง (ใส่ได้อีเมลเดียว) หรือเว้นว่างเพื่อไม่ใช้'); go(3); }
        $cap = in_array($_POST['captcha'] ?? 'pow', ['pow', 'turnstile', 'off'], true) ? (string)$_POST['captcha'] : 'pow';
        $tsKey = trim((string)($_POST['ts_site'] ?? '')); $tsSecret = trim((string)($_POST['ts_secret'] ?? ''));
        if ($cap === 'turnstile' && ($tsKey === '' || $tsSecret === '' || !preg_match('/^[\w\-]{8,100}$/', $tsKey) || !preg_match('/^[\w\-]{8,100}$/', $tsSecret))) { notice('เลือก Turnstile ต้องกรอก Site key และ Secret key ให้ถูกต้อง (จาก dash.cloudflare.com → Turnstile)'); go(3); }
        $S['admin'] = ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'proxy' => isset($_POST['trust_proxy']),
                       'origin' => trim((string)($_POST['origin'] ?? '')), 'notify' => $notify, 'captcha' => $cap, 'ts_site' => $tsKey, 'ts_secret' => $tsSecret];
        if ($S['admin']['origin'] !== '' && !preg_match('#^https?://[A-Za-z0-9.\-]+(:\d+)?$#', $S['admin']['origin'])) { $S['admin'] = null; notice('โดเมนเพิ่มเติมต้องอยู่ในรูป https://www.example.com (ไม่มี / ท้ายและไม่มีเส้นทาง)'); go(3); }
        $S['max'] = max($S['max'], 4); go(4);
    }
    if ($act === 'install') {
        if (!$S['db'] || !$S['admin']) go(2);
        $target = cfg_target();
        if ($target === null) { notice('เขียนไฟล์ตั้งค่าไม่ได้ — ให้สิทธิ์เขียนโฟลเดอร์ api/ ชั่วคราว แล้วลองใหม่'); go(4); }
        try {
            $pdo = db_connect($S['db']);
            run_schema($pdo);
            $pdo->query('SELECT COUNT(*) FROM ' . INST_TABLE)->fetchColumn();
            $cfg = [
                'db_host' => $S['db']['host'], 'db_name' => $S['db']['name'], 'db_user' => $S['db']['user'], 'db_pass' => $S['db']['pass'],
                'table_prefix' => 'lop_', 'admin_password_hash' => $S['admin']['hash'], 'ip_salt' => bin2hex(random_bytes(24)),
                'allowed_origins' => $S['admin']['origin'] !== '' ? [$S['admin']['origin']] : [], 'trust_proxy' => (bool)$S['admin']['proxy'],
                'notify_email' => $S['admin']['notify'], 'notify_from' => '', 'notify_guestbook' => false, 'notify_min_interval' => 300, 'site_url' => '',
                'captcha' => $S['admin']['captcha'], 'captcha_bits' => 16,
                'turnstile_site_key' => $S['admin']['captcha'] === 'turnstile' ? $S['admin']['ts_site'] : '', 'turnstile_secret' => $S['admin']['captcha'] === 'turnstile' ? $S['admin']['ts_secret'] : '',
                'limits' => ['guestbook_per_ip' => [3, 600], 'review_per_ip' => [3, 3600], 'review_per_place' => [1, 86400], 'guestbook_global' => [120, 3600], 'review_global' => [60, 3600]],
            ];
            if ($S['db']['port'] !== '3306') $cfg['db_port'] = $S['db']['port'];
            if (!write_config($target, $cfg)) throw new RuntimeException('เขียนไฟล์ตั้งค่าไม่สำเร็จ');
        } catch (Throwable $e) {
            error_log('lopburi install: ' . $e->getMessage());
            notice('ติดตั้งไม่สำเร็จ: ' . ($e instanceof PDOException ? 'สร้างตารางไม่ได้ (ผู้ใช้ฐานข้อมูลต้องมีสิทธิ์ CREATE/ALTER) ' : '') . $e->getMessage()); go(4);
        }
        $_SESSION['done'] = ['where' => str_contains($target, '/api/') ? 'api/config.php' : $target];
        unset($_SESSION['inst']);
        header('Location: install.php'); exit;
    }
    go($step);
}

/* ---------- แสดงแต่ละขั้น ---------- */
switch ($step) {
    case 1:
        $blocked = false; $rows = '';
        foreach (requirements() as [$label, $ok, $detail, $required]) {
            if ($required && !$ok) $blocked = true;
            $rows .= '<tr><td class="' . ($ok ? 'y' : ($required ? 'x' : 'w')) . '">' . ($ok ? '✓' : ($required ? '✗' : '!')) . '</td><td><b>' . h($label) . '</b><br><small style="color:var(--mute)">' . h($detail) . '</small></td></tr>';
        }
        page('ตรวจความพร้อม', 1, '<h2>ยินดีต้อนรับ — ตรวจความพร้อมของเซิร์ฟเวอร์</h2><p style="color:var(--mute)">ตัวช่วยนี้จะสร้างตารางและไฟล์ตั้งค่าให้ ใช้เวลาประมาณ 2 นาที เตรียมชื่อฐานข้อมูล ผู้ใช้ และรหัสผ่านจาก cPanel ให้พร้อม</p>'
            . '<table>' . $rows . '</table><form method="post" class="row" style="margin-top:14px">' . csrf_input() . '<input type="hidden" name="action" value="requirements">'
            . ($blocked ? '<a class="btn l" href="install.php?step=1">ตรวจอีกครั้ง</a>' : '<button class="btn">เริ่มติดตั้ง →</button>') . '</form>');
    case 2:
        $f = ($S['db_form'] ?? []) + ['host' => 'localhost', 'port' => '3306', 'name' => '', 'user' => '', 'pass' => ''];
        page('ฐานข้อมูล', 2, '<h2>ข้อมูลฐานข้อมูล MySQL / MariaDB</h2><p style="color:var(--mute)">สร้างใน cPanel → MySQL® Databases (สร้างฐานข้อมูล + ผู้ใช้ + เพิ่มผู้ใช้เข้าฐานข้อมูลด้วยสิทธิ์ ALL PRIVILEGES)</p>'
            . '<form method="post">' . csrf_input() . '<input type="hidden" name="action" value="db">'
            . field('ที่อยู่เซิร์ฟเวอร์ฐานข้อมูล', 'db_host', $f['host'], 'text', 'required', 'โฮสต์ส่วนใหญ่ใช้ <code>localhost</code>')
            . field('พอร์ต', 'db_port', $f['port'], 'text', 'inputmode="numeric"')
            . field('ชื่อฐานข้อมูล', 'db_name', $f['name'], 'text', 'required autocomplete="off"', 'ใน cPanel มีคำนำหน้าบัญชี เช่น <code>abc123_lopburi</code>')
            . field('ผู้ใช้ฐานข้อมูล', 'db_user', $f['user'], 'text', 'required autocomplete="off"')
            . field('รหัสผ่านฐานข้อมูล', 'db_pass', '', 'password', 'autocomplete="new-password"')
            . '<div class="row"><a class="btn l" href="install.php?step=1">← กลับ</a><button class="btn">ทดสอบการเชื่อมต่อและต่อไป →</button></div></form>');
    case 3:
        page('ผู้ดูแล', 3, '<h2>ตั้งรหัสผ่านผู้ดูแล</h2><p style="color:var(--mute)">ใช้เข้าหน้า <code>/admin/</code> เพื่ออนุมัติรีวิว ซ่อน หรือลบข้อความ (ยาวอย่างน้อย 10 ตัวอักษร มีทั้งตัวอักษรและตัวเลข)</p>'
            . '<form method="post">' . csrf_input() . '<input type="hidden" name="action" value="admin">'
            . field('รหัสผ่านผู้ดูแล', 'admin_pass', '', 'password', 'required minlength="10" autocomplete="new-password"')
            . field('ยืนยันรหัสผ่าน', 'admin_pass2', '', 'password', 'required minlength="10" autocomplete="new-password"')
            . field('โดเมนเพิ่มเติมที่อนุญาตให้ส่งข้อความ (ไม่บังคับ)', 'origin', '', 'text', 'placeholder="https://www.example.com"', 'ถ้าเว็บเปิดได้ทั้งมี/ไม่มี www ให้ใส่อีกแบบที่นี่ · เว้นว่างถ้าใช้โดเมนเดียว')
            . field('อีเมลแจ้งเตือนเมื่อมีรีวิวใหม่ (ไม่บังคับ)', 'notify_email', '', 'email', 'autocomplete="email" placeholder="you@example.com"', 'เว้นว่างถ้าไม่ต้องการ · ส่งด้วยระบบอีเมลของโฮสต์ แก้ภายหลังได้ที่ <code>notify_email</code> ใน config และกดส่งอีเมลทดสอบได้ที่หน้าผู้ดูแล')
            . '<fieldset class="f" style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><legend style="font-weight:600;font-size:.9rem">CAPTCHA กันสแปม</legend>'
            . '<label style="display:block"><input type="radio" name="captcha" value="pow" checked> <b>ในตัว (แนะนำ)</b> — เบราว์เซอร์คำนวณเงียบ ๆ ราว 1 วินาที ไม่ต้องสมัครบริการ ไม่ส่งข้อมูลออกนอกเว็บ</label>'
            . '<label style="display:block"><input type="radio" name="captcha" value="turnstile"> <b>Cloudflare Turnstile</b> — เข้มกว่า ฟรี ต้องสมัครแล้วใส่คีย์ด้านล่าง</label>'
            . '<label style="display:block"><input type="radio" name="captcha" value="off"> ปิด (พึ่งการจำกัดความถี่และช่องล่อบอตเท่านั้น)</label>'
            . '<div style="margin-top:8px">' . field('Turnstile Site key (เฉพาะถ้าเลือก Turnstile)', 'ts_site', '', 'text', 'autocomplete="off"')
            . field('Turnstile Secret key', 'ts_secret', '', 'password', 'autocomplete="off"') . '</div></fieldset>'
            . '<label class="f"><span><input type="checkbox" name="trust_proxy" value="1"> เว็บอยู่หลัง Cloudflare / CDN</span><small>เลือกเฉพาะเมื่อใช้ CDN เพื่อให้จำกัดความถี่ตาม IP ผู้ใช้จริง</small></label>'
            . '<div class="row"><a class="btn l" href="install.php?step=2">← กลับ</a><button class="btn">ต่อไป →</button></div></form>');
    case 4:
        $t = cfg_target(); $db = $S['db'] ?? ['name' => '', 'user' => '', 'host' => ''];
        page('ติดตั้ง', 4, '<h2>ตรวจสอบก่อนติดตั้ง</h2><table>'
            . '<tr><td><b>ฐานข้อมูล</b></td><td>' . h($db['name']) . ' (ผู้ใช้ ' . h($db['user']) . ' @ ' . h($db['host']) . ')</td></tr>'
            . '<tr><td><b>ตารางที่จะสร้าง</b></td><td><code>' . INST_TABLE . '</code> (ถ้ามีอยู่แล้วจะไม่ถูกแตะต้อง ข้อมูลเดิมปลอดภัย)</td></tr>'
            . '<tr><td><b>ไฟล์ตั้งค่า</b></td><td>' . ($t ? h(str_contains($t, '/api/') ? 'api/config.php' : $t) : '<span class="x">เขียนไม่ได้</span>') . '</td></tr></table>'
            . '<form method="post" class="row" style="margin-top:14px">' . csrf_input() . '<input type="hidden" name="action" value="install">'
            . '<a class="btn l" href="install.php?step=3">← กลับ</a><button class="btn">ติดตั้งเดี๋ยวนี้</button></form>');
}
