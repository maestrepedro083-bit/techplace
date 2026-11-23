CREATE TABLE part_prices (
  part_key TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  supplier TEXT,
  cost INTEGER CHECK (cost BETWEEN 0 AND 99999999999),
  service_price INTEGER CHECK (service_price BETWEEN 0 AND 99999999999),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (name IS NULL AND category IS NULL AND supplier IS NULL) OR
    (name IS NOT NULL AND category IS NOT NULL AND supplier IS NOT NULL)
  )
);
