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
