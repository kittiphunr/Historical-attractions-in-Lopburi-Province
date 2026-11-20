-- ตารางสมุดเยี่ยม (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS entries (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  message  TEXT NOT NULL,
  rating   INTEGER NOT NULL DEFAULT 0,
  place    TEXT NOT NULL DEFAULT '',
  at       TEXT NOT NULL,          -- เวลา ISO 8601 (UTC)
  ip_hash  TEXT NOT NULL DEFAULT '' -- ค่าแฮชของ IP (ใช้จำกัดความถี่เท่านั้น ไม่เก็บ IP จริง)
);
CREATE INDEX IF NOT EXISTS idx_entries_at ON entries (at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_ip ON entries (ip_hash, at);
