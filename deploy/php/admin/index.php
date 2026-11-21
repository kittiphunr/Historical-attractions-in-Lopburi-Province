<?php
/* หน้าผู้ดูแลสมุดเยี่ยมและรีวิว: ดู อนุมัติ ซ่อน ลบ — เข้าที่ /admin/ (ต้องล็อกอินด้วยรหัสผ่านที่ตั้งใน config.php)
 * ตั้งรหัสผ่านครั้งแรก: เปิดหน้านี้ขณะ admin_password_hash ใน config.php ยังว่าง จะมีแบบฟอร์มสร้างค่าแฮชให้คัดลอกไปวางใน config.php */
declare(strict_types=1);
require __DIR__ . '/../api/lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"); // script-src เฉพาะปุ่มยืนยันการลบ (หน้านี้ไม่แสดง HTML ที่ผู้ใช้เขียน)
header('Referrer-Policy: no-referrer');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params(['lifetime' => 0, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_name('lopburi_admin');
session_start();

const STATUS_TH = ['pending' => 'รอตรวจ', 'approved' => 'แสดงแล้ว', 'hidden' => 'ซ่อน'];
const KIND_TH = ['review' => 'รีวิว', 'guestbook' => 'สมุดเยี่ยม'];
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$cfg = lop_config();
$self = $_SERVER['SCRIPT_NAME'];

function page(string $title, string $body): void {
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
code,textarea.hash{font-family:ui-monospace,Menlo,monospace;font-size:13px}
</style></head><body><div class="wrap">' . $body . '</div></body></html>';
    exit;
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

/* ---- เปลี่ยนสถานะ / ลบ (POST + CSRF) ---- */
$status = $_REQUEST['status'] ?? 'pending'; if (!isset(STATUS_TH[$status])) $status = 'pending';
$kind = $_REQUEST['kind'] ?? ''; if (!isset(KIND_TH[$kind])) $kind = '';
$pageNo = max(1, (int)($_REQUEST['p'] ?? 1));
$db = lop_db(); $t = lop_table();
$notice = '';
try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['act'])) {
        if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { $notice = 'หมดเวลาหรือคำขอไม่ถูกต้อง ลองใหม่อีกครั้ง'; }
        else {
            $id = (string)($_POST['id'] ?? ''); $act = (string)$_POST['act'];
            if (!preg_match('/^[0-9a-f]{12}$/', $id)) $notice = 'รหัสรายการไม่ถูกต้อง';
            elseif ($act === 'delete') { $db->prepare("DELETE FROM $t WHERE id = ?")->execute([$id]); $notice = 'ลบแล้ว'; }
            elseif ($act === 'approve' || $act === 'hide') { $db->prepare("UPDATE $t SET status = ? WHERE id = ?")->execute([$act === 'approve' ? 'approved' : 'hidden', $id]); $notice = $act === 'approve' ? 'อนุมัติแล้ว (แสดงบนเว็บ)' : 'ซ่อนแล้ว'; }
            header('Location: ' . $self . '?' . http_build_query(['status' => $status, 'kind' => $kind, 'p' => $pageNo, 'n' => $notice])); exit;
        }
    }
    $notice = $notice ?: (string)($_GET['n'] ?? '');

    $counts = ['pending' => 0, 'approved' => 0, 'hidden' => 0];
    foreach ($db->query("SELECT status, COUNT(*) c FROM $t GROUP BY status") as $r) $counts[$r['status']] = (int)$r['c'];
    $where = 'status = ?'; $args = [$status]; if ($kind !== '') { $where .= ' AND kind = ?'; $args[] = $kind; }
    $st = $db->prepare("SELECT COUNT(*) FROM $t WHERE $where"); $st->execute($args); $total = (int)$st->fetchColumn();
    $per = 30; $pages = max(1, (int)ceil($total / $per)); $pageNo = min($pageNo, $pages);
    $st = $db->prepare("SELECT * FROM $t WHERE $where ORDER BY created_at DESC, id DESC LIMIT $per OFFSET " . (($pageNo - 1) * $per)); $st->execute($args); $rows = $st->fetchAll();
} catch (Throwable $e) {
    error_log('lopburi admin: ' . $e->getMessage());
    page('ผิดพลาด', '<h1>เชื่อมต่อฐานข้อมูลไม่ได้ หรือยังไม่ได้สร้างตาราง</h1><div class="card"><p>ตรวจว่านำเข้า <code>schema.sql</code> ผ่าน phpMyAdmin แล้ว และข้อมูลฐานข้อมูลใน <code>config.php</code> ถูกต้อง (รายละเอียดข้อผิดพลาดอยู่ใน error log ของโฮสต์)</p></div>');
}

$q = fn(array $o) => $self . '?' . http_build_query(array_filter($o + ['status' => $status, 'kind' => $kind], fn($v) => $v !== '' && $v !== null));
$places = lop_places();
$body = '<div class="row"><h1 style="margin-right:auto">ผู้ดูแลสมุดเยี่ยมและรีวิว</h1><a class="tab" href="' . $h($self . '?logout=1') . '">ออกจากระบบ</a></div>';
if ($notice) $body .= '<p class="card" role="status">' . $h($notice) . '</p>';
$body .= '<div class="row">';
foreach (STATUS_TH as $k => $lbl) $body .= '<a class="tab' . ($k === $status ? ' on' : '') . '" href="' . $h($q(['status' => $k, 'p' => 1])) . '">' . $h($lbl) . ' (' . $counts[$k] . ')</a>';
$body .= '<span class="meta" style="margin-left:12px">ชนิด:</span><a class="tab' . ($kind === '' ? ' on' : '') . '" href="' . $h($q(['kind' => '', 'p' => 1])) . '">ทั้งหมด</a>';
foreach (KIND_TH as $k => $lbl) $body .= '<a class="tab' . ($kind === $k ? ' on' : '') . '" href="' . $h($q(['kind' => $k, 'p' => 1])) . '">' . $h($lbl) . '</a>';
$body .= '</div>';
if (!$rows) $body .= '<div class="card meta">ไม่มีรายการในหมวดนี้</div>';
foreach ($rows as $r) {
    $pl = $r['place'] !== '' ? ($places[$r['place']] ?? $r['place']) : '—';
    $btn = fn($act, $cls, $label) => '<form method="post" style="display:inline"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="id" value="' . $h($r['id']) . '"><input type="hidden" name="act" value="' . $act . '"><input type="hidden" name="status" value="' . $h($status) . '"><input type="hidden" name="kind" value="' . $h($kind) . '"><input type="hidden" name="p" value="' . $pageNo . '"><input type="submit" class="' . $cls . '" value="' . $label . '"' . ($act === 'delete' ? ' onclick="return confirm(\'ลบรายการนี้ถาวร?\')"' : '') . '></form> ';
    $body .= '<div class="card"><div class="row"><span class="pill ' . $h($r['status']) . '">' . $h(STATUS_TH[$r['status']]) . '</span><span class="pill">' . $h(KIND_TH[$r['kind']]) . '</span><b>' . $h($r['name']) . '</b>'
        . ($r['rating'] ? '<span class="stars" aria-label="' . (int)$r['rating'] . ' ดาว">' . str_repeat('★', (int)$r['rating']) . str_repeat('☆', 5 - (int)$r['rating']) . '</span>' : '')
        . '<span class="meta">' . $h($pl) . ' · ' . $h($r['created_at']) . ' UTC' . ($r['lang'] ? ' · ' . $h($r['lang']) : '') . '</span></div><div class="msg">' . $h($r['message']) . '</div><div>'
        . ($r['status'] !== 'approved' ? $btn('approve', 'ok', 'อนุมัติ/แสดง') : '') . ($r['status'] !== 'hidden' ? $btn('hide', 'mid', 'ซ่อน') : '') . $btn('delete', 'no', 'ลบ') . '</div></div>';
}
if ($pages > 1) {
    $body .= '<div class="row">';
    if ($pageNo > 1) $body .= '<a class="tab" href="' . $h($q(['p' => $pageNo - 1])) . '">‹ ก่อนหน้า</a>';
    $body .= '<span class="meta">หน้า ' . $pageNo . ' / ' . $pages . ' (' . $total . ' รายการ)</span>';
    if ($pageNo < $pages) $body .= '<a class="tab" href="' . $h($q(['p' => $pageNo + 1])) . '">ถัดไป ›</a>';
    $body .= '</div>';
}
page('ผู้ดูแลสมุดเยี่ยมและรีวิว', $body);
