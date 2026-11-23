ALTER TABLE products ADD COLUMN deleted_at TEXT;
--> statement-breakpoint
ALTER TABLE service_orders ADD COLUMN deleted_at TEXT;
--> statement-breakpoint
ALTER TABLE service_media ADD COLUMN deleted_at TEXT;
--> statement-breakpoint
ALTER TABLE film_families ADD COLUMN deleted_at TEXT;
--> statement-breakpoint
ALTER TABLE knowledge_guides ADD COLUMN deleted_at TEXT;
--> statement-breakpoint
CREATE TABLE shop_revision (
  id INTEGER PRIMARY KEY CHECK (id=1),
  version INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT INTO shop_revision (id) VALUES (1);
