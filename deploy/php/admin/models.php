<?php
/* จัดการไฟล์โมเดล 3 มิติ (.glb) ของแต่ละสถานที่และแผนที่ทั้งจังหวัด — เข้าที่ /admin/models.php (ล็อกอินเดียวกับหน้าอื่น)
 * อัปโหลดแทนโมเดลเดิมได้ (ไฟล์ตั้งต้นของเว็บไม่ถูกลบ กลับไปใช้ได้เสมอ) เก็บประวัติ 5 ครั้งต่อรายการ และตั้งพิกัดหมุดของแผนที่จังหวัดได้ */
declare(strict_types=1);
require __DIR__ . '/common.php';
require __DIR__ . '/../api/content.php';
require __DIR__ . '/../api/modelstore.php';
admin_headers("'self'");   // สคริปต์ของหน้านี้อยู่ในไฟล์ assets/models.js (ไม่ใช้ inline)

$places = lop_places();
$def = lop_models_defaults();
$self = $_SERVER['SCRIPT_NAME'];
$url = fn(array $q = []) => $self . ($q ? '?' . http_build_query($q) : '');
$flash = function (string $msg, string $kind = 'ok'): void { $_SESSION['flash'] = [$msg, $kind]; };
$mb = fn($b) => number_format($b / 1048576, 1) . ' MB';
$iniBytes = function (string $k): int { $v = trim((string)ini_get($k)); if ($v === '') return 0; $n = (int)$v; switch (strtolower(substr($v, -1))) { case 'g': $n *= 1024; case 'm': $n *= 1024; case 'k': $n *= 1024; } return $n; };
$limit = min($iniBytes('upload_max_filesize') ?: PHP_INT_MAX, $iniBytes('post_max_size') ?: PHP_INT_MAX);

try { $db = lop_pdo(); lop_cms_ensure($db); lop_models_ensure($db); }
catch (Throwable $e) {
    error_log('lopburi models: ' . $e->getMessage());
    page('ผิดพลาด', admin_nav('models', 'โมเดล 3 มิติ') . '<div class="card"><p class="warn">เชื่อมต่อฐานข้อมูลไม่ได้ หรือผู้ใช้ฐานข้อมูลไม่มีสิทธิ์สร้างตาราง (CREATE) — ตรวจ <code>config.php</code> และนำเข้า <code>schema.sql</code> (รายละเอียดอยู่ใน error log ของโฮสต์)</p></div>');
}

/** รายการที่จัดการได้: province + สถานที่ที่หน้ามีตัวแสดงโมเดลอยู่แล้ว (id="placeModel") */
$items = ['province' => 'แผนที่ 3 มิติทั้งจังหวัด'];
foreach ($places as $id => $name) {
    $p = dirname(__DIR__) . '/places/' . $id . '.html';
    if (is_file($p) && strpos((string)file_get_contents($p), 'id="placeModel"') !== false) $items[$id] = $name;
}
$key = (string)($_REQUEST['m'] ?? '');
if ($key !== '' && !isset($items[$key])) $key = '';

/** รับไฟล์ที่อัปโหลดหนึ่งช่อง คืน [tmp, ข้อความผิดพลาด|null] ; ไม่ได้เลือกไฟล์ = [null, null] */
$pick = function (string $field) use ($limit): array {
    $f = $_FILES[$field] ?? null;
    if (!is_array($f) || is_array($f['error'] ?? [])) return [null, null];
    if ($f['error'] === UPLOAD_ERR_NO_FILE) return [null, null];
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) return [null, 'ไฟล์ใหญ่เกินที่เซิร์ฟเวอร์ยอมรับ (ขณะนี้ ' . round($limit / 1048576) . ' MB — ขอให้โฮสต์เพิ่ม upload_max_filesize และ post_max_size หรือย่อไฟล์)'];
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) return [null, 'อัปโหลดไม่สำเร็จ ลองอีกครั้ง'];
    return [(string)$f['tmp_name'], null];
};

/* ---------- POST ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $act = (string)($_POST['act'] ?? '');
    $back = function () use ($url, &$key): void { header('Location: ' . $url($key !== '' ? ['m' => $key] : [])); exit; };
    $postedEmpty = empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0;   // เกิน post_max_size PHP จะทิ้งทุกอย่าง
    if ($postedEmpty) { $flash('ไฟล์ใหญ่เกินที่เซิร์ฟเวอร์ยอมรับ (ขณะนี้ ' . round($limit / 1048576) . ' MB) — ขอให้โฮสต์เพิ่ม upload_max_filesize/post_max_size หรือย่อไฟล์', 'warn'); $back(); }
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { $flash('หมดเวลาหรือคำขอไม่ถูกต้อง ลองใหม่อีกครั้ง', 'warn'); $back(); }
    if ($key === '') { $flash('ไม่พบรายการที่เลือก', 'warn'); header('Location: ' . $url()); exit; }
    $made = [];   // ไฟล์ที่สร้างในคำขอนี้ (ลบทิ้งถ้าล้มเหลว)
    try {
        if ($act === 'upload') {
            [$glbTmp, $e1] = $pick('glb'); [$arTmp, $e2] = $pick('ar'); [$posterTmp, $e3] = $pick('poster');
            if ($e1 ?? $e2 ?? $e3) throw new InvalidArgumentException((string)($e1 ?? $e2 ?? $e3));
            $cur = lop_models_all($db)[$key] ?? null;
            if ($glbTmp === null && $arTmp === null && $posterTmp === null && trim((string)($_POST['credit'] ?? '')) === (string)($cur['credit'] ?? '')) throw new InvalidArgumentException('ยังไม่ได้เลือกไฟล์');
            if ($glbTmp === null && !$cur) throw new InvalidArgumentException('ต้องเลือกไฟล์โมเดล (.glb) สำหรับแสดงบนเว็บ');
            $row = $cur ?: ['file' => '', 'ar_file' => '', 'poster' => '', 'size' => 0, 'ar_size' => 0, 'credit' => ''];
            lop_model_dir_ensure();
            $tag = bin2hex(random_bytes(6)); $base = $key . '-' . $tag; $dir = lop_model_dir();
            $warn = [];
            if ($glbTmp !== null) {
                $r = lop_glb_inspect($glbTmp, LOP_GLB_MAX_WEB, false);
                if (!$r['ok']) throw new InvalidArgumentException('ไฟล์โมเดล: ' . $r['error']);
                if (!move_uploaded_file($glbTmp, $dir . '/' . $base . '.glb')) throw new RuntimeException('บันทึกไฟล์ไม่ได้ (ตรวจสิทธิ์เขียนของโฟลเดอร์ uploads/)');
                $made[] = $dir . '/' . $base . '.glb'; @chmod($dir . '/' . $base . '.glb', 0644);
                $row['file'] = $base . '.glb'; $row['size'] = $r['info']['size'];
                if ($r['info']['compressed'] && $arTmp === null && (string)$row['ar_file'] === '') $warn[] = 'ไฟล์นี้ใช้การบีบอัด (meshopt/WebP) — ปุ่ม AR จะใช้ไม่ได้จนกว่าจะอัปโหลดไฟล์ AR แบบไม่บีบอัด';
                if ($arTmp === null) { $row['ar_file'] = ''; $row['ar_size'] = 0; }   // เปลี่ยนโมเดลหลัก: ไฟล์ AR เดิมไม่ตรงกับโมเดลใหม่แล้ว
                if ($posterTmp === null) $row['poster'] = '';                          // ภาพปกเดิมไม่ตรงกับโมเดลใหม่แล้ว
            }
            if ($arTmp !== null) {
                $r = lop_glb_inspect($arTmp, LOP_GLB_MAX_AR, true);
                if (!$r['ok']) throw new InvalidArgumentException('ไฟล์ AR: ' . $r['error']);
                if (!move_uploaded_file($arTmp, $dir . '/' . $base . '.ar.glb')) throw new RuntimeException('บันทึกไฟล์ไม่ได้');
                $made[] = $dir . '/' . $base . '.ar.glb'; @chmod($dir . '/' . $base . '.ar.glb', 0644);
                $row['ar_file'] = $base . '.ar.glb'; $row['ar_size'] = $r['info']['size'];
            }
            if ($posterTmp !== null) {
                $err = lop_img_to_webp($posterTmp, $dir . '/' . $base . '.webp', 1200);
                if ($err !== null) throw new InvalidArgumentException('ภาพปก: ' . $err);
                $made[] = $dir . '/' . $base . '.webp';
                $row['poster'] = $base . '.webp';
            }
            $row['credit'] = lop_clean($_POST['credit'] ?? '', 300);
            if ($row['credit'] === '') $warn[] = 'ยังไม่ได้ใส่เครดิตผู้สร้างโมเดล — หน้าเว็บจะใช้เครดิตเดิม (ของโมเดลตั้งต้น) ซึ่งอาจไม่ตรงกับไฟล์ใหม่ ควรใส่ชื่อผู้สร้าง';
            lop_model_set($db, $key, $row);
            lop_model_gc($db);
            $flash('บันทึกโมเดลของ "' . $items[$key] . '" แล้ว — เปิดหน้าจริงเพื่อตรวจว่าแสดงถูกต้อง' . ($warn ? ' · ข้อควรทราบ: ' . implode(' · ', $warn) : ''), $warn ? 'warn' : 'ok');
        } elseif ($act === 'clear') {
            lop_model_clear($db, $key);
            $flash('กลับไปใช้โมเดลตั้งต้นของเว็บสำหรับ "' . $items[$key] . '" แล้ว (โมเดลที่อัปโหลดไว้ยังย้อนกลับได้จากประวัติ)');
        } elseif ($act === 'restore') {
            $st = $db->prepare('SELECT * FROM ' . lop_model_t('model_history') . ' WHERE `id` = ? AND `mkey` = ?'); $st->execute([(int)($_POST['hid'] ?? 0), $key]); $h = $st->fetch();
            if (!$h) throw new InvalidArgumentException('ไม่พบรายการในประวัติ');
            foreach (['file', 'ar_file', 'poster'] as $f) if ($h[$f] !== '' && !is_file(lop_model_dir() . '/' . $h[$f])) throw new InvalidArgumentException('ไฟล์ของรายการนี้ไม่อยู่ในโฟลเดอร์ uploads/models แล้ว');
            lop_model_set($db, $key, $h);
            $flash('ย้อนกลับไปใช้โมเดลเมื่อ ' . $h['created_at'] . ' UTC แล้ว');
        } elseif ($act === 'hotspots' && $key === 'province') {
            $ov = []; $bad = [];
            foreach ($def['hotspots'] as $hid => [$dx, $dz]) {
                $x = trim((string)($_POST['x_' . $hid] ?? '')); $z = trim((string)($_POST['z_' . $hid] ?? ''));
                if ($x === '' && $z === '') continue;
                if (!is_numeric($x) || !is_numeric($z) || abs((float)$x) > 100000 || abs((float)$z) > 100000) { $bad[] = $places[$hid] ?? $hid; continue; }
                if (abs((float)$x - $dx) < 1e-9 && abs((float)$z - $dz) < 1e-9) continue;   // เท่าค่าตั้งต้น ไม่ต้องเก็บ
                $ov[$hid] = [(float)$x, (float)$z];
            }
            if ($bad) throw new InvalidArgumentException('ค่าพิกัดไม่ถูกต้อง (ต้องเป็นตัวเลขทั้ง x และ z): ' . implode(', ', $bad));
            lop_setting_set($db, 'province_hotspots', $ov ? json_encode($ov) : null);
            $flash($ov ? 'บันทึกพิกัดหมุดที่แก้แล้ว ' . count($ov) . ' จุด' : 'กลับไปใช้พิกัดหมุดตั้งต้นทั้งหมดแล้ว');
        }
    } catch (InvalidArgumentException $e) {
        foreach ($made as $p) @unlink($p);
        $flash($e->getMessage(), 'warn');
    } catch (Throwable $e) {
        foreach ($made as $p) @unlink($p);
        error_log('lopburi models: ' . $e->getMessage());
        $flash('บันทึกไม่สำเร็จ ลองอีกครั้ง (รายละเอียดอยู่ใน error log ของโฮสต์)', 'warn');
    }
    $back();
}

$fl = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);
$body = admin_nav('models', 'โมเดล 3 มิติ');
if ($fl) $body .= '<p class="card ' . ($fl[1] === 'warn' ? 'warn' : '') . '" role="status">' . $h($fl[0]) . '</p>';
$all = lop_models_all($db);
$defSize = function (string $rel): string { $p = dirname(__DIR__) . '/' . $rel; return $rel !== '' && is_file($p) ? number_format(filesize($p) / 1048576, 1) . ' MB' : '—'; };

/* ---------- รายการ ---------- */
if ($key === '') {
    $body .= '<p class="meta">เปลี่ยนไฟล์ 3 มิติ (.glb) ของแต่ละสถานที่และแผนที่ทั้งจังหวัดโดยไม่ต้องสร้างเว็บใหม่ ไฟล์ตั้งต้นของเว็บยังอยู่ กลับไปใช้ได้ทุกเมื่อ · ขีดจำกัดอัปโหลดของโฮสต์นี้: <b>' . ($limit === PHP_INT_MAX ? 'ไม่ทราบ' : round($limit / 1048576) . ' MB') . '</b> ต่อครั้ง</p>';
    $body .= '<div class="card" style="padding:0;overflow:auto"><table><thead><tr><th scope="col">รายการ</th><th scope="col">โมเดลที่ใช้อยู่</th><th scope="col">ไฟล์ AR</th><th scope="col">ภาพปก</th><th scope="col"><span class="sr-only">จัดการ</span></th></tr></thead><tbody>';
    foreach ($items as $k => $name) {
        $r = $all[$k] ?? null; $d = $k === 'province' ? $def['province'] : ($def['places'][$k] ?? ['url' => '', 'ar' => '']);
        $body .= '<tr><th scope="row" style="text-align:left">' . $h($name) . '</th><td>' . ($r ? '<span class="pill approved">อัปโหลดแล้ว</span> ' . $mb((int)$r['size']) . '<div class="meta">' . $h($r['updated_at']) . ' UTC</div>' : '<span class="pill">ตั้งต้นของเว็บ</span> ' . $h($defSize($d['url'])))
            . '</td><td>' . ($r ? ($r['ar_file'] !== '' ? $mb((int)$r['ar_size']) : '<span class="meta">ไม่มี</span>') : $h($defSize($d['ar']))) . '</td><td>' . ($r ? ($r['poster'] !== '' ? 'อัปโหลดแล้ว' : '<span class="meta">ไม่มี</span>') : '<span class="meta">ตั้งต้น</span>')
            . '</td><td><a class="tab" href="' . $h($url(['m' => $k])) . '" aria-label="จัดการโมเดล ' . $h($name) . '">จัดการ</a></td></tr>';
    }
    $body .= '</tbody></table></div>';
    page('โมเดล 3 มิติ', $body);
}

/* ---------- หน้ารายการเดียว ---------- */
$name = $items[$key]; $r = $all[$key] ?? null;
$d = $key === 'province' ? $def['province'] : ($def['places'][$key] ?? ['url' => '', 'ar' => '', 'credit' => '']);
$body .= '<p class="meta"><a href="' . $h($url()) . '">‹ ทุกรายการ</a> · <b>' . $h($name) . '</b></p>';

$body .= '<section class="card"><h2>โมเดลที่ใช้อยู่</h2>';
if ($r) {
    $base = '../' . LOP_MODEL_DIR . '/';
    $body .= '<p><span class="pill approved">อัปโหลดแล้ว</span> ' . $mb((int)$r['size']) . ' · ' . $h($r['updated_at']) . ' UTC · <a href="' . $h($base . $r['file']) . '" download>ดาวน์โหลดไฟล์</a></p>'
        . '<p class="meta">ไฟล์ AR: ' . ($r['ar_file'] !== '' ? $mb((int)$r['ar_size']) . ' · <a href="' . $h($base . $r['ar_file']) . '" download>ดาวน์โหลด</a>' : 'ไม่มี (ปุ่ม AR ใช้ไฟล์แสดงผล — ถ้าไฟล์ถูกบีบอัดจะใช้ AR ไม่ได้)') . ' · ภาพปก: ' . ($r['poster'] !== '' ? 'อัปโหลดแล้ว' : 'ไม่มี (จะแสดงปุ่ม "แตะเพื่อดู 3 มิติ" ไม่มีภาพ)') . '</p>'
        . '<p class="meta">เครดิตที่แสดง: ' . $h($r['credit'] !== '' ? $r['credit'] : '(ไม่ได้ใส่ — ใช้เครดิตเดิม)') . '</p>'
        . '<form method="post" action="' . $h($url()) . '"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="clear"><input type="hidden" name="m" value="' . $h($key) . '"><button type="submit" class="mid" data-confirm="กลับไปใช้โมเดลตั้งต้นของเว็บ? โมเดลที่อัปโหลดไว้จะยังย้อนกลับได้จากประวัติ">ใช้โมเดลตั้งต้นของเว็บ</button></form>';
} else {
    $body .= '<p><span class="pill">ตั้งต้นของเว็บ</span> ' . $h($d['url']) . ' (' . $h($defSize($d['url'])) . ')' . ($d['ar'] ? ' · AR: ' . $h($d['ar']) . ' (' . $h($defSize($d['ar'])) . ')' : '') . '</p><p class="meta">เครดิต: ' . $h($d['credit'] ?? '') . '</p>';
}
$body .= '<p><a class="tab" href="' . $h('../' . ($key === 'province' ? '#map' : 'places/' . $key . '.html')) . '" target="_blank" rel="noopener">ดูหน้าจริง ↗</a></p></section>';

$body .= '<section class="card"><h2>อัปโหลดโมเดลใหม่</h2><form method="post" enctype="multipart/form-data" action="' . $h($url()) . '" id="modelForm" data-limit="' . ($limit === PHP_INT_MAX ? 0 : $limit) . '">'
    . '<input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="upload"><input type="hidden" name="m" value="' . $h($key) . '">'
    . '<p><label for="f-glb"><b>ไฟล์โมเดลสำหรับแสดงบนเว็บ (.glb)</b>' . ($r ? ' — เว้นว่างถ้าไม่เปลี่ยน' : '') . '</label><br><input type="file" id="f-glb" name="glb" accept=".glb,model/gltf-binary"' . ($r ? '' : ' required') . '></p>'
    . '<p><label for="f-ar"><b>ไฟล์สำหรับ AR (.glb ไม่บีบอัด)</b> — ไม่บังคับ</label><br><input type="file" id="f-ar" name="ar" accept=".glb,model/gltf-binary"></p>'
    . '<p><label for="f-poster"><b>ภาพปก (JPEG/PNG/WebP)</b> — ไม่บังคับ ใช้เป็นภาพตัวอย่างก่อนกดดูโมเดล</label><br><input type="file" id="f-poster" name="poster" accept="image/jpeg,image/png,image/webp"></p>'
    . '<p><label for="f-credit"><b>เครดิตผู้สร้างโมเดล</b> — แสดงใต้โมเดลในหน้าเว็บ</label><br><input type="text" id="f-credit" name="credit" maxlength="300" value="' . $h($r['credit'] ?? '') . '" placeholder="เช่น โมเดล 3 มิติ: ปั้นโดย … (สัญญาอนุญาต …)"></p>'
    . '<p><input type="submit" class="ok" value="อัปโหลดและใช้โมเดลนี้"></p>'
    . '<div class="meta"><p style="margin:2px 0"><b>ข้อกำหนดไฟล์:</b> .glb (glTF 2.0) ที่รวมทุกอย่างไว้ในไฟล์เดียว · ไฟล์แสดงผลไม่เกิน ' . round(LOP_GLB_MAX_WEB / 1048576) . ' MB (แนะนำ ≤ 5 MB เพื่อให้โหลดเร็ว) · ไฟล์ AR ไม่เกิน ' . round(LOP_GLB_MAX_AR / 1048576) . ' MB และต้องไม่บีบอัด · ไม่รับ Draco/KTX2 · ระบบปรับขนาดและวางกึ่งกลางโมเดลให้เอง</p>'
    . '<p style="margin:2px 0">ย่อไฟล์ก่อนอัปโหลดด้วยเครื่องมือในโปรเจกต์ <code>npm run shrink -- ไฟล์ต้นฉบับ.glb --out ชื่อ.glb --ar 0.4</code> (ได้ทั้งไฟล์เว็บและ .ar.glb) · ภาพปกถ้าไม่ใส่ จะไม่มีภาพตัวอย่าง (ภาพเก่าของโมเดลเดิมจะไม่ถูกใช้ เพราะไม่ตรงกับโมเดลใหม่) · ภาพแชร์ลิงก์ (og) ยังเป็นภาพเดิมจนกว่าจะสร้างเว็บใหม่</p>'
    . '<p style="margin:2px 0">ใช้ได้เฉพาะโมเดลที่ผู้สร้างยินยอมให้ใช้ — ใส่เครดิตและสัญญาอนุญาตให้ครบ</p></div></form></section>';

$hist = lop_model_history($db, $key);
if ($hist) {
    $body .= '<details class="card"><summary>ประวัติโมเดลเดิม (' . count($hist) . ' รายการล่าสุด)</summary><ul style="list-style:none;padding:0;margin:8px 0 0">';
    foreach ($hist as $x) {
        $ok = is_file(lop_model_dir() . '/' . $x['file']);
        $body .= '<li class="row" style="padding:6px 0;border-top:1px solid #eee"><span class="meta" style="min-width:150px">' . $h($x['created_at']) . ' UTC</span><span style="flex:1;min-width:160px">' . $mb((int)$x['size']) . ($x['ar_file'] !== '' ? ' + AR ' . $mb((int)$x['ar_size']) : '') . ($x['credit'] !== '' ? ' · ' . $h(lop_substr($x['credit'], 60)) : '') . '</span>'
            . ($ok ? '<form method="post" action="' . $h($url()) . '"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="restore"><input type="hidden" name="m" value="' . $h($key) . '"><input type="hidden" name="hid" value="' . (int)$x['id'] . '"><button type="submit" class="mid" data-confirm="ใช้โมเดลนี้แทนโมเดลปัจจุบัน?">ใช้อันนี้</button></form>' : '<span class="meta">ไฟล์ถูกลบแล้ว</span>') . '</li>';
    }
    $body .= '</ul></details>';
}

/* ---------- พิกัดหมุดของแผนที่จังหวัด ---------- */
if ($key === 'province') {
    $ov = lop_hotspots_override($db);
    $body .= '<section class="card"><h2>ตำแหน่งหมุดบนแผนที่ 3 มิติ</h2><p class="meta">หมุดแต่ละจุดอยู่ที่พิกัด x, z ในหน่วยของไฟล์โมเดล (เหนืออยู่ด้านบนเมื่อมองจากด้านบน กึ่งกลางโมเดลประมาณ 0, 0) ความสูงระบบคำนวณจากผิวโมเดลเอง · ถ้าเปลี่ยนโมเดลแผนที่เป็นไฟล์ที่รูปทรงต่างจากเดิม หมุดอาจคลาดเคลื่อน ให้ปรับค่าตรงนี้แล้วเปิดแผนที่ในหน้าแรกดูผล · เว้นช่องว่างทั้งคู่ = ใช้ค่าตั้งต้น · วิธีวัดพิกัด: รัน <code>npm start</code> แล้วเปิด <code>/map-debug.html</code> ในเครื่องพัฒนา (มุมมองจากด้านบนพร้อมตารางพิกัด)</p>'
        . '<form method="post" action="' . $h($url()) . '"><input type="hidden" name="csrf" value="' . $h(csrf()) . '"><input type="hidden" name="act" value="hotspots"><input type="hidden" name="m" value="province">'
        . '<table><thead><tr><th scope="col">สถานที่</th><th scope="col">x (ตั้งต้น)</th><th scope="col">z (ตั้งต้น)</th></tr></thead><tbody>';
    foreach ($def['hotspots'] as $hid => [$dx, $dz]) {
        $cx = isset($ov[$hid]) ? $ov[$hid][0] : ''; $cz = isset($ov[$hid]) ? $ov[$hid][1] : '';
        $body .= '<tr><th scope="row" style="text-align:left">' . $h($places[$hid] ?? $hid) . '</th>'
            . '<td><input type="text" inputmode="decimal" name="x_' . $h($hid) . '" value="' . $h($cx) . '" placeholder="' . $h($dx) . '" aria-label="x ของ ' . $h($places[$hid] ?? $hid) . '" style="width:120px"></td>'
            . '<td><input type="text" inputmode="decimal" name="z_' . $h($hid) . '" value="' . $h($cz) . '" placeholder="' . $h($dz) . '" aria-label="z ของ ' . $h($places[$hid] ?? $hid) . '" style="width:120px"></td></tr>';
    }
    $body .= '</tbody></table><p><input type="submit" class="ok" value="บันทึกพิกัดหมุด"></p></form></section>';
}

page('โมเดล 3 มิติ — ' . $name, $body, '<script src="assets/models.js" defer></script>');
