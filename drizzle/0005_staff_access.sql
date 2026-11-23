CREATE TABLE staff_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  disabled_at TEXT
);
--> statement-breakpoint
CREATE TABLE staff_invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  account_id TEXT REFERENCES staff_accounts(id),
  reset_user TEXT REFERENCES staff_accounts(id)
);
--> statement-breakpoint
CREATE TABLE staff_sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_accounts(id),
  expires_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX staff_sessions_account ON staff_sessions (staff_id);
--> statement-breakpoint
CREATE INDEX staff_sessions_expiry ON staff_sessions (expires_at);
--> statement-breakpoint
CREATE TABLE staff_login_attempts (
  key TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
