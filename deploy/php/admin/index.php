<?php
/* หน้าผู้ดูแลสมุดเยี่ยมและรีวิว: ดู อนุมัติ ซ่อน ลบ — เข้าที่ /admin/ (ต้องล็อกอินด้วยรหัสผ่านที่ตั้งใน config.php) · เนื้อหาสถานที่อยู่ที่ places.php */
declare(strict_types=1);
require __DIR__ . '/common.php';   // ส่วนหัวความปลอดภัย เซสชัน ตั้งรหัสผ่านครั้งแรก เข้าสู่ระบบ

const STATUS_TH = ['pending' => 'รอตรวจ', 'approved' => 'แสดงแล้ว', 'hidden' => 'ซ่อน'];
const KIND_TH = ['review' => 'รีวิว', 'guestbook' => 'สมุดเยี่ยม'];

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
            if ($act === 'testmail') {
                $to = lop_notify_email();
                $notice = $to === '' ? 'ยังไม่ได้ตั้ง notify_email ใน config (หรืออีเมลไม่ถูกต้อง)'
                    : (lop_mail($to, '[ทดสอบ] อีเมลแจ้งเตือนสมุดเยี่ยมและรีวิว', "ถ้าคุณได้รับอีเมลนี้ แสดงว่าการแจ้งเตือนรีวิวใหม่ใช้งานได้\n\nหน้าผู้ดูแล: " . lop_admin_url() . "\n") ? 'ส่งอีเมลทดสอบแล้ว (ตรวจกล่องจดหมายและโฟลเดอร์สแปมภายใน 1-2 นาที)' : 'ส่งอีเมลไม่สำเร็จ — โฮสต์อาจปิดฟังก์ชัน mail() ดู error log');
            }
            elseif (!preg_match('/^[0-9a-f]{12}$/', $id)) $notice = 'รหัสรายการไม่ถูกต้อง';
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
$body = admin_nav('reviews', 'ผู้ดูแลสมุดเยี่ยมและรีวิว');
if ($notice) $body .= '<p class="card" role="status">' . $h($notice) . '</p>';
$body .= '<div class="row">';
foreach (STATUS_TH as $k => $lbl) $body .= '<a class="tab' . ($k === $status ? ' on' : '') . '" href="' . $h($q(['status' => $k, 'p' => 1])) . '">' . $h($lbl) . ' (' . $counts[$k] . ')</a>';
$body .= '<span class="meta" style="margin-left:12px">ชนิด:</span><a class="tab' . ($kind === '' ? ' on' : '') . '" href="' . $h($q(['kind' => '', 'p' => 1])) . '">ทั้งหมด</a>';
foreach (KIND_TH as $k => $lbl) $body .= '<a class="tab' . ($kind === $k ? ' on' : '') . '" href="' . $h($q(['kind' => $k, 'p' => 1])) . '">' . $h($lbl) . '</a>';
$body .= '</div>';
$ne = lop_notify_email();
$body .= '<div class="card row meta"><span style="margin-right:auto">อีเมลแจ้งเตือนรีวิวใหม่: ' . ($ne !== '' ? '<b>เปิด</b> (ส่งถึง ' . $h(preg_replace('/^(.).*(@.*)$/u', '$1***$2', $ne)) . ')' : '<b>ปิด</b> — ตั้ง <code>notify_email</code> ใน config เพื่อเปิด') . '</span>'
    . ($ne !== '' ? '<form method="post"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="testmail"><input type="hidden" name="status" value="' . $h($status) . '"><input type="submit" class="mid" value="ส่งอีเมลทดสอบ"></form>' : '') . '</div>';
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
