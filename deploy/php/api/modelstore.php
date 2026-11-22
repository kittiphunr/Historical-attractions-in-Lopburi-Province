<?php
/* ระบบจัดการไฟล์โมเดล 3 มิติ (.glb) ของสถานที่และแผนที่ทั้งจังหวัด — ใช้โดย admin/models.php และ data.php
 * - โมเดลที่อัปโหลดเก็บที่ uploads/models/<คีย์>-<รหัสสุ่ม>.glb (ชื่อใหม่ทุกครั้ง จึงไม่ติดแคชของไฟล์เก่า) ข้อมูลอยู่ในตาราง lop_models
 * - data.php ต่อท้าย assets/js/data.js ด้วยโค้ดที่แทนที่ glb.url/ar/credit ของสถานที่ และ PROVINCE_MODEL (url/ar/พิกัดหมุด)
 * - ตรวจไฟล์ GLB ที่ฝั่งเซิร์ฟเวอร์ด้วยการอ่านโครงสร้างไบนารี (ไม่รันโค้ดใด ๆ ในไฟล์)
 * ห้ามเปิดจากเว็บโดยตรง (api/.htaccess บล็อกไว้) */
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'modelstore.php') { http_response_code(403); exit; }

const LOP_MODEL_DIR = 'uploads/models';
const LOP_MODEL_KEEP = 5;                         // ประวัติโมเดลเดิมที่เก็บต่อคีย์
const LOP_GLB_MAX_WEB = 20 * 1024 * 1024;         // ไฟล์แสดงบนเว็บ
const LOP_GLB_MAX_AR = 40 * 1024 * 1024;          // ไฟล์ AR (ไม่บีบอัด จึงใหญ่กว่า)
const LOP_GLB_MAX_JSON = 16 * 1024 * 1024;
/** ส่วนขยาย glTF ที่ตัวแสดงของเว็บอ่านได้ (ตัวแสดงมีตัวถอดรหัส meshopt แต่ไม่มี Draco/KTX2 จึงไม่รับสองอย่างหลัง) */
const LOP_GLB_EXT_OK = ['EXT_meshopt_compression', 'KHR_mesh_quantization', 'KHR_texture_transform', 'EXT_texture_webp', 'KHR_lights_punctual',
    'KHR_materials_unlit', 'KHR_materials_emissive_strength', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_transmission',
    'KHR_materials_volume', 'KHR_materials_sheen', 'KHR_materials_clearcoat', 'KHR_materials_pbrSpecularGlossiness'];
/** ส่วนขยายที่ทำให้ปุ่ม AR (Scene Viewer / Quick Look) ใช้ไฟล์ไม่ได้ */
const LOP_GLB_EXT_NOT_AR = ['EXT_meshopt_compression', 'EXT_texture_webp', 'KHR_draco_mesh_compression', 'KHR_texture_basisu'];

function lop_model_t(string $name): string { return lop_cms_t($name); }

function lop_models_ensure(PDO $db): void {
    $m = lop_model_t('models'); $h = lop_model_t('model_history'); $s = lop_model_t('settings');
    $cols = "`file` VARCHAR(80) NOT NULL, `ar_file` VARCHAR(80) NOT NULL DEFAULT '', `poster` VARCHAR(80) NOT NULL DEFAULT '', `size` INT UNSIGNED NOT NULL DEFAULT 0, `ar_size` INT UNSIGNED NOT NULL DEFAULT 0, `credit` VARCHAR(300) NOT NULL DEFAULT ''";
    $db->exec("CREATE TABLE IF NOT EXISTS $m (`mkey` VARCHAR(40) NOT NULL, $cols, `updated_at` DATETIME NOT NULL, PRIMARY KEY (`mkey`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS $h (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `mkey` VARCHAR(40) NOT NULL, $cols, `created_at` DATETIME NOT NULL, PRIMARY KEY (`id`), KEY `idx_key` (`mkey`, `id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS $s (`skey` VARCHAR(40) NOT NULL, `sval` MEDIUMTEXT NOT NULL, `updated_at` DATETIME NOT NULL, PRIMARY KEY (`skey`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function lop_model_key_ok(string $k): bool { return $k === 'province' || preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $k) === 1; }
function lop_model_file_ok(string $f): bool { return $f === '' || preg_match('/^[a-z0-9-]{1,40}-[0-9a-f]{12}(\.ar)?\.(glb|webp)$/', $f) === 1; }

/** โมเดลที่อัปโหลดทั้งหมด: [คีย์ => แถว] */
function lop_models_all(PDO $db): array {
    $out = [];
    foreach ($db->query('SELECT * FROM ' . lop_model_t('models')) as $r) if (lop_model_key_ok($r['mkey'])) $out[$r['mkey']] = $r;
    return $out;
}
function lop_model_history(PDO $db, string $key): array {
    $st = $db->prepare('SELECT * FROM ' . lop_model_t('model_history') . ' WHERE `mkey` = ? ORDER BY `id` DESC LIMIT ' . (int)LOP_MODEL_KEEP);
    $st->execute([$key]);
    return $st->fetchAll();
}
function lop_setting_get(PDO $db, string $k): ?array {
    $st = $db->prepare('SELECT `sval`, `updated_at` FROM ' . lop_model_t('settings') . ' WHERE `skey` = ?');
    $st->execute([$k]);
    $r = $st->fetch();
    return $r ? ['v' => $r['sval'], 'updated_at' => $r['updated_at']] : null;
}
function lop_setting_set(PDO $db, string $k, ?string $v): void {
    if ($v === null) { $db->prepare('DELETE FROM ' . lop_model_t('settings') . ' WHERE `skey` = ?')->execute([$k]); return; }
    $db->prepare('INSERT INTO ' . lop_model_t('settings') . ' (`skey`, `sval`, `updated_at`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `sval` = VALUES(`sval`), `updated_at` = VALUES(`updated_at`)')->execute([$k, $v, gmdate('Y-m-d H:i:s')]);
}

/* ---------- ตรวจไฟล์ GLB ---------- */
/**
 * อ่านโครงสร้าง GLB 2.0 (ส่วนหัว + ก้อน JSON) โดยไม่โหลดทั้งไฟล์เข้าหน่วยความจำ
 * คืน ['ok' => true, 'info' => [...]] หรือ ['ok' => false, 'error' => 'ข้อความไทย']
 * $forAr = true เมื่อเป็นไฟล์สำหรับ AR: ห้ามใช้ส่วนขยายบีบอัด (Scene Viewer / Quick Look อ่านไม่ได้)
 */
function lop_glb_inspect(string $path, int $maxBytes, bool $forAr = false): array {
    $bad = fn(string $m) => ['ok' => false, 'error' => $m];
    $size = @filesize($path);
    if ($size === false || $size < 40) return $bad('ไฟล์เล็กเกินไปหรืออ่านไม่ได้');
    if ($size > $maxBytes) return $bad('ไฟล์ใหญ่เกิน ' . round($maxBytes / 1048576) . ' MB (ย่อไฟล์ด้วย npm run shrink หรือ gltf-transform ก่อนอัปโหลด)');
    $fh = @fopen($path, 'rb');
    if (!$fh) return $bad('เปิดไฟล์ไม่ได้');
    try {
        $hd = fread($fh, 12);
        if ($hd === false || strlen($hd) < 12 || substr($hd, 0, 4) !== 'glTF') return $bad('ไม่ใช่ไฟล์ .glb (ไม่พบส่วนหัว glTF) — ถ้าเป็น .gltf ให้แปลงเป็น .glb ก่อน');
        $h = unpack('Vver/Vlen', substr($hd, 4, 8));
        if ($h['ver'] !== 2) return $bad('รองรับเฉพาะ glTF เวอร์ชัน 2.0');
        if ($h['len'] !== $size) return $bad('ขนาดไฟล์ไม่ตรงกับที่ระบุในส่วนหัว (ไฟล์ขาดหรือเสียหาย)');
        $json = null; $pos = 12; $bin = 0; $chunks = 0;
        while ($pos + 8 <= $size) {
            fseek($fh, $pos);
            $ch = fread($fh, 8);
            if ($ch === false || strlen($ch) < 8) return $bad('โครงสร้างไฟล์เสียหาย');
            $c = unpack('Vlen/Vtype', $ch);
            if ($c['len'] < 0 || $pos + 8 + $c['len'] > $size) return $bad('ก้อนข้อมูลในไฟล์เกินขนาดไฟล์ (ไฟล์เสียหาย)');
            if (++$chunks > 8) return $bad('โครงสร้างไฟล์ผิดปกติ');
            if ($c['type'] === 0x4E4F534A && $json === null) {
                if ($c['len'] > LOP_GLB_MAX_JSON) return $bad('ส่วนอธิบายโมเดลใหญ่ผิดปกติ');
                $json = fread($fh, $c['len']);
            } elseif ($c['type'] === 0x004E4942) { $bin += $c['len']; }
            $pos += 8 + $c['len'];
        }
        if ($json === null || $json === false) return $bad('ไม่พบส่วนอธิบายโมเดล (JSON) ในไฟล์');
        $g = json_decode(rtrim($json, " \0"), true, 64);
        if (!is_array($g) || !isset($g['asset']['version']) || strpos((string)$g['asset']['version'], '2') !== 0) return $bad('ส่วนอธิบายโมเดลอ่านไม่ได้ (JSON เสีย)');
        foreach (['buffers', 'images'] as $list) foreach (($g[$list] ?? []) as $x) {
            if (isset($x['uri']) && strncmp((string)$x['uri'], 'data:', 5) !== 0) return $bad('ไฟล์อ้างถึงไฟล์ภายนอก (' . $list . ') — ต้องเป็น .glb ที่รวมทุกอย่างไว้ในไฟล์เดียว');
        }
        $req = array_map('strval', $g['extensionsRequired'] ?? []);
        $used = array_map('strval', $g['extensionsUsed'] ?? []);
        $unsupported = array_values(array_diff($req, LOP_GLB_EXT_OK));
        if ($unsupported) return $bad('ไฟล์ต้องใช้ส่วนขยายที่ตัวแสดงของเว็บไม่รองรับ: ' . implode(', ', $unsupported) . ' (ส่งออกใหม่โดยไม่ใช้ Draco/KTX2 หรือบีบอัดด้วย meshopt)');
        if ($forAr) {
            $bar = array_values(array_intersect(array_unique(array_merge($req, $used)), LOP_GLB_EXT_NOT_AR));
            if ($bar) return $bad('ไฟล์ AR ต้องไม่บีบอัด แต่พบ: ' . implode(', ', $bar) . ' (Scene Viewer/Quick Look อ่านไม่ได้) ส่งออกใหม่แบบไม่บีบอัด');
        }
        if (empty($g['meshes']) || empty($g['scenes'])) return $bad('ไม่พบรูปทรง (mesh) หรือฉากในไฟล์');
        $compressed = (bool)array_intersect($used, LOP_GLB_EXT_NOT_AR);
        return ['ok' => true, 'info' => ['size' => $size, 'meshes' => count($g['meshes']), 'materials' => count($g['materials'] ?? []), 'textures' => count($g['textures'] ?? []),
            'ext' => $used, 'compressed' => $compressed, 'generator' => lop_substr((string)($g['asset']['generator'] ?? ''), 80)]];
    } finally { fclose($fh); }
}

/* ---------- บันทึก / ย้อนกลับ / คืนค่าตั้งต้น ---------- */
function lop_model_dir(): string { return dirname(__DIR__) . '/' . LOP_MODEL_DIR; }
function lop_model_dir_ensure(): void {
    $d = lop_model_dir();
    if (!is_dir($d) && !@mkdir($d, 0755, true) && !is_dir($d)) throw new RuntimeException('สร้างโฟลเดอร์ ' . LOP_MODEL_DIR . ' ไม่ได้ (ตรวจสิทธิ์เขียนของโฟลเดอร์ uploads/)');
}
function lop_model_cols(array $r): array {
    return [(string)$r['file'], (string)$r['ar_file'], (string)$r['poster'], (int)$r['size'], (int)$r['ar_size'], (string)$r['credit']];
}
/** เก็บโมเดลปัจจุบัน (ถ้ามี) ลงประวัติ แล้วตัดประวัติเกิน LOP_MODEL_KEEP พร้อมลบไฟล์ที่ไม่มีใครอ้างถึงแล้ว */
function lop_model_archive(PDO $db, string $key): void {
    $m = lop_model_t('models'); $h = lop_model_t('model_history');
    $st = $db->prepare("SELECT * FROM $m WHERE `mkey` = ?"); $st->execute([$key]); $cur = $st->fetch();
    if ($cur) {
        $db->prepare("INSERT INTO $h (`mkey`, `file`, `ar_file`, `poster`, `size`, `ar_size`, `credit`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute(array_merge([$key], lop_model_cols($cur), [$cur['updated_at']]));
        $ids = $db->prepare("SELECT `id` FROM $h WHERE `mkey` = ? ORDER BY `id` DESC LIMIT " . (int)LOP_MODEL_KEEP); $ids->execute([$key]);
        $keep = array_map('intval', $ids->fetchAll(PDO::FETCH_COLUMN));
        if (count($keep) >= LOP_MODEL_KEEP) $db->prepare("DELETE FROM $h WHERE `mkey` = ? AND `id` < ?")->execute([$key, min($keep)]);
    }
}
/** ลบไฟล์ใน uploads/models ที่ไม่ถูกอ้างถึงทั้งในโมเดลปัจจุบันและประวัติ (เรียกหลังเปลี่ยนแปลงสำเร็จ) */
function lop_model_gc(PDO $db): int {
    $used = [];
    foreach ([lop_model_t('models'), lop_model_t('model_history')] as $t) foreach ($db->query("SELECT `file`, `ar_file`, `poster` FROM $t") as $r) foreach ($r as $f) if ($f !== '') $used[$f] = true;
    $n = 0;
    foreach (glob(lop_model_dir() . '/*') ?: [] as $p) {
        $b = basename($p);
        if (is_file($p) && lop_model_file_ok($b) && !isset($used[$b]) && filemtime($p) < time() - 300) { if (@unlink($p)) $n++; }   // ไฟล์อายุ < 5 นาทีเก็บไว้ (กำลังอัปโหลดอยู่)
    }
    return $n;
}
/** ตั้งโมเดลปัจจุบันของคีย์ (ไฟล์ต้องอยู่ใน uploads/models แล้ว) */
function lop_model_set(PDO $db, string $key, array $row): void {
    if (!lop_model_key_ok($key)) throw new InvalidArgumentException('คีย์ไม่ถูกต้อง');
    foreach (['file', 'ar_file', 'poster'] as $f) if (!lop_model_file_ok((string)$row[$f])) throw new InvalidArgumentException('ชื่อไฟล์ไม่ถูกต้อง');
    $m = lop_model_t('models');
    $db->beginTransaction();
    try {
        lop_model_archive($db, $key);
        $db->prepare("INSERT INTO $m (`mkey`, `file`, `ar_file`, `poster`, `size`, `ar_size`, `credit`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `file` = VALUES(`file`), `ar_file` = VALUES(`ar_file`), `poster` = VALUES(`poster`), `size` = VALUES(`size`), `ar_size` = VALUES(`ar_size`), `credit` = VALUES(`credit`), `updated_at` = VALUES(`updated_at`)")
            ->execute(array_merge([$key], lop_model_cols($row), [gmdate('Y-m-d H:i:s')]));
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}
/** กลับไปใช้โมเดลตั้งต้นของเว็บ (เก็บโมเดลที่อัปโหลดไว้ในประวัติ) */
function lop_model_clear(PDO $db, string $key): void {
    $db->beginTransaction();
    try { lop_model_archive($db, $key); $db->prepare('DELETE FROM ' . lop_model_t('models') . ' WHERE `mkey` = ?')->execute([$key]); $db->commit(); }
    catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}

/* ---------- ค่าตั้งต้นของเว็บ (อ่านจาก assets/js/data.js) ---------- */
function lop_models_defaults(): array {
    static $d = null;
    if ($d !== null) return $d;
    $src = @file_get_contents(dirname(__DIR__) . '/assets/js/data.js');
    $d = ['places' => [], 'province' => ['url' => '', 'ar' => '', 'credit' => ''], 'hotspots' => []];
    if (!is_string($src)) return $d;
    if (preg_match_all('/"id": "([a-z0-9-]+)",/', $src, $m, PREG_OFFSET_CAPTURE)) {
        foreach ($m[1] as $i => [$id, $off]) {
            $end = $m[1][$i + 1][1] ?? strlen($src);
            $block = substr($src, $off, $end - $off);
            if (preg_match('/"glb": \{[^}]*?"url": "([^"]+)"(?:,\s*"ar": "([^"]+)")?(?:[^}]*?"credit": "((?:[^"\\\\]|\\\\.)*)")?/s', $block, $g)) $d['places'][$id] = ['url' => $g[1], 'ar' => $g[2] ?? '', 'credit' => isset($g[3]) ? json_decode('"' . $g[3] . '"') : ''];
        }
    }
    if (preg_match('/window\.PROVINCE_MODEL = \{(.*?)\n\};/s', $src, $pm)) {
        $b = $pm[1];
        if (preg_match("/url: '([^']+)'/", $b, $x)) $d['province']['url'] = $x[1];
        if (preg_match("/ar: '([^']+)'/", $b, $x)) $d['province']['ar'] = $x[1];
        if (preg_match_all("/\{\s*id: '([a-z0-9-]+)',\s*x: (-?[0-9.]+),\s*z: (-?[0-9.]+)/", $b, $hs, PREG_SET_ORDER)) foreach ($hs as $h) $d['hotspots'][$h[1]] = [(float)$h[2], (float)$h[3]];
    }
    return $d;
}

/** พิกัดหมุดที่ผู้ดูแลแก้ (province_hotspots) เป็น [id => [x, z]] */
function lop_hotspots_override(PDO $db): array {
    $s = lop_setting_get($db, 'province_hotspots');
    $j = $s ? json_decode($s['v'], true) : null;
    $out = [];
    if (is_array($j)) foreach ($j as $id => $xz) if (is_string($id) && lop_model_key_ok($id) && is_array($xz) && count($xz) === 2 && is_numeric($xz[0]) && is_numeric($xz[1])) $out[$id] = [(float)$xz[0], (float)$xz[1]];
    return $out;
}

/** โค้ด JavaScript ที่ต่อท้าย data.js: แทนที่โมเดล/พิกัดหมุดตามที่ผู้ดูแลตั้ง และตั้ง window.LOP_MODELS (ใช้เลือกภาพปก) — คืน '' ถ้าไม่มีอะไรเปลี่ยน */
function lop_models_js(PDO $db): string {
    $models = lop_models_all($db);
    $hot = lop_hotspots_override($db);
    if (!$models && !$hot) return '';
    $out = [];
    foreach ($models as $k => $r) {
        $dir = LOP_MODEL_DIR . '/';
        if (!lop_model_file_ok((string)$r['file'])) continue;
        $out[$k] = ['url' => $dir . $r['file'], 'ar' => $r['ar_file'] !== '' ? $dir . $r['ar_file'] : '', 'poster' => $r['poster'] !== '' ? $dir . $r['poster'] : '', 'credit' => (string)$r['credit']];
        if ($r['ar_file'] !== '' && !lop_model_file_ok((string)$r['ar_file'])) $out[$k]['ar'] = '';
        if ($r['poster'] !== '' && !lop_model_file_ok((string)$r['poster'])) $out[$k]['poster'] = '';
    }
    $fl = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
    return "\n/* ต่อท้ายโดย data.php: โมเดลและพิกัดหมุดที่ผู้ดูแลตั้งผ่านหน้า /admin/models.php */\n(function () {\n  var M = " . json_encode((object)$out, $fl) . ", H = " . json_encode((object)$hot, $fl) . ";\n"
        . "  window.LOP_MODELS = M;\n"
        . "  (window.ATTRACTIONS || []).forEach(function (a) { var m = M[a.id]; if (m && a.glb) { a.glb = Object.assign({}, a.glb, { url: m.url, ar: m.ar || m.url }); if (m.credit) a.glb.credit = m.credit; } });\n"
        . "  var P = window.PROVINCE_MODEL; if (P) {\n"
        . "    if (M.province) { P.url = M.province.url; P.ar = M.province.ar || M.province.url; if (M.province.credit) P.credit = M.province.credit; }\n"
        . "    (P.hotspots || []).forEach(function (h) { if (H[h.id]) { h.x = H[h.id][0]; h.z = H[h.id][1]; } });\n  }\n})();\n";
}
