CREATE TABLE sales (
  number INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  day TEXT NOT NULL,
  payment TEXT NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount > 0),
  cost INTEGER NOT NULL CHECK (cost >= 0),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finalized INTEGER NOT NULL DEFAULT 0 CHECK (finalized IN (0, 1)),
  voided_at TEXT,
  voided_by TEXT,
  void_reason TEXT
);
--> statement-breakpoint
CREATE INDEX sales_day ON sales (day DESC, number DESC);
--> statement-breakpoint
CREATE TABLE sale_items (
  sale_id TEXT NOT NULL REFERENCES sales(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost INTEGER NOT NULL CHECK (unit_cost >= 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  PRIMARY KEY (sale_id, product_id)
);
--> statement-breakpoint
ALTER TABLE cash_entries ADD COLUMN sale_id TEXT REFERENCES sales(id);
--> statement-breakpoint
CREATE UNIQUE INDEX cash_entries_sale ON cash_entries (sale_id);
--> statement-breakpoint
CREATE TABLE service_media (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES service_orders(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready'))
);
--> statement-breakpoint
CREATE INDEX service_media_order ON service_media (order_id, status, created_at DESC);
