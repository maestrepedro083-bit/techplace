CREATE TABLE products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0 CHECK (qty BETWEEN 0 AND 100000000),
  min_qty INTEGER NOT NULL CHECK (min_qty >= 0),
  cost INTEGER NOT NULL CHECK (cost >= 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  notes TEXT NOT NULL DEFAULT '',
  revision TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE stock_moves (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  delta INTEGER NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX stock_moves_created ON stock_moves (created_at DESC);
--> statement-breakpoint
CREATE TABLE cash_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  day TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  payment TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision TEXT NOT NULL,
  voided_at TEXT
);
--> statement-breakpoint
CREATE INDEX cash_entries_day ON cash_entries (day DESC, created_at DESC);
