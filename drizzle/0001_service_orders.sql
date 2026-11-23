CREATE TABLE service_orders (
  number INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open', 'working', 'done', 'canceled')),
  due_day TEXT,
  amount INTEGER CHECK (amount IS NULL OR amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision TEXT NOT NULL
);
