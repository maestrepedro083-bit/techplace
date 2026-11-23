CREATE TABLE knowledge_guides (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  actor TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE knowledge_events (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('guide', 'records', 'draft', 'unanswered')),
  feedback TEXT CHECK (feedback IN ('helpful', 'improve')),
  feedback_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX knowledge_events_created ON knowledge_events (created_at DESC);
