CREATE TABLE film_families (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  models TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  source_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision TEXT NOT NULL
);
