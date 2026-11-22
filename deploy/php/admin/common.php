<?php
/* ส่วนกลางของหน้าผู้ดูแล (index.php = สมุดเยี่ยมและรีวิว, places.php = เนื้อหาสถานที่, upload.php = อัปโหลดรูป)
 * ทำ: ส่วนหัวความปลอดภัย · เซสชัน · หน้าตั้งรหัสผ่านครั้งแรก · หน้าเข้าสู่ระบบ — ผู้ที่ยังไม่ล็อกอินจะไม่ผ่านบรรทัดสุดท้ายของไฟล์นี้
 * ตั้งรหัสผ่านครั้งแรก: เปิดหน้าผู้ดูแลขณะ admin_password_hash ใน config.php ยังว่าง จะมีแบบฟอร์มสร้างค่าแฮชให้คัดลอกไปวางใน config.php
 * ห้ามเปิดจากเว็บโดยตรง (admin/.htaccess บล็อกไว้) */
declare(strict_types=1);
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'common.php') { http_response_code(403); exit; }
require __DIR__ . '/../api/lib.php';

/** $script = ค่า script-src ของ CSP (หน้าสมุดเยี่ยมใช้ inline เฉพาะปุ่มยืนยันลบ, หน้าตัวแก้ไขใช้ไฟล์ของตัวเอง + nonce) */
function admin_headers(string $script = "'unsafe-inline'", string $extra = ''): void {
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src $script; form-action 'self'; frame-ancestors 'none'; $extra");
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
}
admin_headers();

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params(['lifetime' => 0, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_name('lopburi_admin');
session_start();

$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$cfg = lop_config();
$self = $_SERVER['SCRIPT_NAME'];

/** $head = แท็กเพิ่มใน <head> (เช่น link/script ของตัวแก้ไข) */
function page(string $title, string $body, string $head = ''): void {
    global $h;
    echo '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . $h($title) . '</title><style>
body{margin:0;font:15px/1.5 system-ui,"Noto Sans Thai","Sarabun",sans-serif;background:#f4ece2;color:#2b2623}
.wrap{max-width:1000px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0 12px} h2{font-size:17px}
.card{background:#fff;border-radius:14px;padding:14px 16px;margin:10px 0;box-shadow:0 1px 6px rgba(0,0,0,.08)}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.msg{white-space:pre-wrap;word-break:break-word;margin:6px 0}
.meta{color:#776b61;font-size:13px}
.pill{display:inline-block;border-radius:999px;padding:1px 10px;font-size:12px;background:#eee}
.pending{background:#fde9c9;color:#8a5200}.approved{background:#d8f1e0;color:#14663a}.hidden{background:#e5e1dd;color:#555}
.stars{color:#e89b1a;letter-spacing:1px}
a.tab,button,input[type=submit]{font:inherit;border-radius:999px;border:0;padding:6px 14px;cursor:pointer}
a.tab{background:#fff;color:#2b2623;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.1)} a.tab.on{background:#c4552f;color:#fff}
.ok{background:#14663a;color:#fff}.no{background:#b3261e;color:#fff}.mid{background:#e5e1dd;color:#2b2623}
input[type=password],input[type=text],select,textarea{font:inherit;padding:8px 10px;border:1px solid #cdbfb2;border-radius:10px;width:100%;box-sizing:border-box}
.warn{background:#fff3cd;border-radius:10px;padding:10px 14px}
table{border-collapse:collapse;width:100%} th,td{padding:8px 12px;border-top:1px solid #eee;text-align:left;vertical-align:middle} thead th{border-top:0;color:#776b61;font-size:13px}
details summary{cursor:pointer;font-weight:600}
code,textarea.hash{font-family:ui-monospace,Menlo,monospace;font-size:13px}
</style>' . $head . '</head><body><div class="wrap">' . $body . '</div></body></html>';
    exit;
}
/** แถบเมนูผู้ดูแล: $active = 'reviews' | 'places' */
function admin_nav(string $active, string $title): string {
    global $h;
    $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/';
    return '<div class="row"><h1 style="margin-right:auto">' . $h($title) . '</h1><a class="tab" href="' . $h($base . '?logout=1') . '">ออกจากระบบ</a></div>'
        . '<nav class="row" aria-label="เมนูผู้ดูแล" style="margin-bottom:8px"><a class="tab' . ($active === 'reviews' ? ' on' : '') . '" href="' . $h($base) . '">สมุดเยี่ยมและรีวิว</a>'
        . '<a class="tab' . ($active === 'places' ? ' on' : '') . '" href="' . $h($base . 'places.php') . '">เนื้อหาสถานที่</a></nav>';
}
function csrf(): string { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16)); return $_SESSION['csrf']; }

/* ---- ตั้งรหัสผ่านครั้งแรก (ยังไม่มีค่าแฮช) ---- */
if (($cfg['admin_password_hash'] ?? '') === '') {
    $hash = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['newpw'])) {
        $pw = (string)$_POST['newpw'];
        if (mb_strlen($pw) >= 10) $hash = password_hash($pw, PASSWORD_DEFAULT);
        else $err = 'รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร';
    }
    $body = '<h1>ตั้งรหัสผ่านผู้ดูแล (ครั้งแรก)</h1><div class="card"><p>ยังไม่ได้ตั้งรหัสผ่านใน <code>config.php</code> พิมพ์รหัสผ่านที่ต้องการ (ยาวอย่างน้อย 10 ตัวอักษร) หน้านี้จะสร้างค่าแฮชให้ คัดลอกไปวางที่บรรทัด <code>admin_password_hash</code> แล้วบันทึกไฟล์ จากนั้นรีเฟรชหน้านี้เพื่อเข้าสู่ระบบ</p>';
    if (!empty($err)) $body .= '<p class="warn">' . $h($err) . '</p>';
    if ($hash) $body .= '<p>คัดลอกบรรทัดนี้ไปแทนที่ <code>admin_password_hash</code> ใน config.php:</p><textarea class="hash" rows="3" readonly onclick="this.select()">\'admin_password_hash\' => \'' . $h($hash) . '\',</textarea>';
    else $body .= '<form method="post"><p><input type="password" name="newpw" autocomplete="new-password" placeholder="รหัสผ่านใหม่" required minlength="10"></p><p><input type="submit" class="ok" value="สร้างค่าแฮช"></p></form>';
    page('ตั้งรหัสผ่านผู้ดูแล', $body . '</div>');
}

/* ---- ออกจากระบบ / เข้าสู่ระบบ ---- */
if (isset($_GET['logout'])) { $_SESSION = []; session_destroy(); header('Location: ' . $self); exit; }
if (empty($_SESSION['ok'])) {
    $err = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pw'])) {
        usleep(700000);
        if (($_SESSION['fails'] ?? 0) >= 8) { $err = 'ลองผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่'; sleep(3); }
        elseif (password_verify((string)$_POST['pw'], (string)$cfg['admin_password_hash'])) { session_regenerate_id(true); $_SESSION['ok'] = true; $_SESSION['fails'] = 0; header('Location: ' . $self); exit; }
        else { $_SESSION['fails'] = ($_SESSION['fails'] ?? 0) + 1; $err = 'รหัสผ่านไม่ถูกต้อง'; }
    }
    page('เข้าสู่ระบบผู้ดูแล', '<h1>ผู้ดูแลสมุดเยี่ยมและรีวิว</h1><div class="card"><form method="post">' . ($err ? '<p class="warn">' . $h($err) . '</p>' : '') . '<p><input type="password" name="pw" autocomplete="current-password" placeholder="รหัสผ่าน" required autofocus></p><p><input type="submit" class="ok" value="เข้าสู่ระบบ"></p></form></div>');
}

