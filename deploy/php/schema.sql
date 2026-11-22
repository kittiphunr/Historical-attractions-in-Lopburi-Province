-- ตารางสมุดเยี่ยมและรีวิวสถานที่ (MySQL 5.7+ / MariaDB 10.3+)
-- วิธีใช้: เปิด phpMyAdmin -> เลือกฐานข้อมูลที่สร้างไว้ -> แท็บ "นำเข้า" (Import) หรือ "SQL" แล้ววางทั้งไฟล์นี้
-- ถ้าเปลี่ยนชื่อตาราง (คำนำหน้า lop_) ต้องแก้ table_prefix ใน config.php ให้ตรงกัน

CREATE TABLE IF NOT EXISTS `lop_reviews` (
  `id`         CHAR(12)      NOT NULL,
  `kind`       ENUM('guestbook','review') NOT NULL,                       -- guestbook = สมุดเยี่ยมทั่วไป, review = รีวิวสถานที่
  `place`      VARCHAR(40)   NOT NULL DEFAULT '',                         -- รหัสสถานที่ เช่น sam-yot (สมุดเยี่ยมเว้นว่างได้)
  `name`       VARCHAR(80)   NOT NULL,
  `message`    TEXT          NOT NULL,
  `rating`     TINYINT UNSIGNED NOT NULL DEFAULT 0,                       -- 0-5 (รีวิวต้อง 1-5)
  `status`     ENUM('approved','pending','hidden') NOT NULL,              -- approved = แสดง, pending = รอตรวจ, hidden = ซ่อน
  `lang`       VARCHAR(8)    NOT NULL DEFAULT '',                         -- ภาษาของหน้าที่ผู้เขียนใช้ (ไว้ให้ผู้ดูแลดูเฉย ๆ)
  `ip_hash`    CHAR(20)      NOT NULL,                                    -- ค่าแฮชของ IP ไว้จำกัดความถี่เท่านั้น (ไม่ใช่ IP จริง)
  `created_at` DATETIME      NOT NULL,                                    -- เวลา UTC
  PRIMARY KEY (`id`),
  KEY `idx_list`   (`kind`, `place`, `status`, `created_at`),
  KEY `idx_ip`     (`ip_hash`, `created_at`),
  KEY `idx_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ระบบจัดการเนื้อหาสถานที่ (หน้า /admin/places.php) — ถ้าไม่ได้นำเข้า ระบบจะสร้างตารางนี้ให้เองเมื่อเปิดหน้าผู้ดูแล (ผู้ใช้ฐานข้อมูลต้องมีสิทธิ์ CREATE)
CREATE TABLE IF NOT EXISTS `lop_place_content` (
  `place`      VARCHAR(40)  NOT NULL,                                     -- รหัสสถานที่ เช่น sam-yot
  `lang`       VARCHAR(8)   NOT NULL,                                     -- th / en / zh / ja
  `field`      VARCHAR(20)  NOT NULL,                                     -- history / architecture / highlights / visit
  `html`       MEDIUMTEXT   NOT NULL,                                     -- HTML ที่ผ่านตัวกรองแล้ว (แก้ด้วย CKEditor 5)
  `updated_at` DATETIME     NOT NULL,                                     -- เวลา UTC
  PRIMARY KEY (`place`, `lang`, `field`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lop_place_revisions` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `place`      VARCHAR(40)  NOT NULL,
  `lang`       VARCHAR(8)   NOT NULL,
  `field`      VARCHAR(20)  NOT NULL,
  `html`       MEDIUMTEXT   NOT NULL,                                     -- ประวัติการแก้ไข (เก็บ 15 ครั้งล่าสุดต่อส่วน)
  `created_at` DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_key` (`place`, `lang`, `field`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ระบบจัดการโมเดล 3 มิติ (หน้า /admin/models.php) — ถ้าไม่ได้นำเข้า ระบบจะสร้างตารางนี้ให้เองเมื่อเปิดหน้าผู้ดูแล
CREATE TABLE IF NOT EXISTS `lop_models` (
  `mkey`       VARCHAR(40)  NOT NULL,                                     -- รหัสสถานที่ หรือ province (แผนที่ทั้งจังหวัด)
  `file`       VARCHAR(80)  NOT NULL,                                     -- ชื่อไฟล์ .glb ใน uploads/models
  `ar_file`    VARCHAR(80)  NOT NULL DEFAULT '',                          -- ไฟล์ .ar.glb (เว้นว่างได้)
  `poster`     VARCHAR(80)  NOT NULL DEFAULT '',                          -- ภาพปก .webp (เว้นว่างได้)
  `size`       INT UNSIGNED NOT NULL DEFAULT 0,
  `ar_size`    INT UNSIGNED NOT NULL DEFAULT 0,
  `credit`     VARCHAR(300) NOT NULL DEFAULT '',
  `updated_at` DATETIME     NOT NULL,                                     -- เวลา UTC
  PRIMARY KEY (`mkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lop_model_history` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `mkey`       VARCHAR(40)  NOT NULL,
  `file`       VARCHAR(80)  NOT NULL,
  `ar_file`    VARCHAR(80)  NOT NULL DEFAULT '',
  `poster`     VARCHAR(80)  NOT NULL DEFAULT '',
  `size`       INT UNSIGNED NOT NULL DEFAULT 0,
  `ar_size`    INT UNSIGNED NOT NULL DEFAULT 0,
  `credit`     VARCHAR(300) NOT NULL DEFAULT '',
  `created_at` DATETIME     NOT NULL,                                     -- เวลาที่โมเดลนี้เริ่มใช้ (เก็บ 5 ครั้งล่าสุดต่อรายการ)
  PRIMARY KEY (`id`),
  KEY `idx_key` (`mkey`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lop_settings` (
  `skey`       VARCHAR(40)  NOT NULL,                                     -- เช่น province_hotspots (พิกัดหมุดที่ผู้ดูแลแก้)
  `sval`       MEDIUMTEXT   NOT NULL,
  `updated_at` DATETIME     NOT NULL,
  PRIMARY KEY (`skey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
