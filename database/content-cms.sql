PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cms_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS cms_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS cms_login_attempts (
  client_ip TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  locked_until TEXT
);

CREATE TABLE IF NOT EXISTS cms_auth_challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cms_auth_challenges_expires_idx
  ON cms_auth_challenges(expires_at);

CREATE TABLE IF NOT EXISTS content_pages (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  draft_frontmatter TEXT NOT NULL DEFAULT '',
  draft_body TEXT NOT NULL DEFAULT '',
  published_frontmatter TEXT,
  published_body TEXT,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'archived')),
  draft_version INTEGER NOT NULL DEFAULT 0,
  published_revision INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS content_pages_state_updated_idx
  ON content_pages(state, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_revisions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES content_pages(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  path TEXT NOT NULL,
  frontmatter TEXT NOT NULL,
  body TEXT NOT NULL,
  message TEXT,
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(page_id, revision)
);

CREATE INDEX IF NOT EXISTS content_revisions_page_published_idx
  ON content_revisions(page_id, published_at DESC);
