-- Fedify's cache and idempotence store (see src/federation/kv.ts). Values are JSON;
-- expires_at is in milliseconds since the epoch, or NULL for no expiry.
CREATE TABLE fedify_kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  expires_at INTEGER
);
