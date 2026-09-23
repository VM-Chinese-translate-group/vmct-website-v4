PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS feedback_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subtype TEXT NOT NULL,
  subtypes TEXT NOT NULL DEFAULT '',
  canonical_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  cover_url TEXT,
  cover_platform TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_items_category_idx
  ON feedback_items(category, status, vote_count DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS feedback_sources (
  item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL UNIQUE,
  external_id TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(item_id, platform, url)
);

CREATE INDEX IF NOT EXISTS feedback_sources_item_idx
  ON feedback_sources(item_id, is_primary DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS feedback_aliases (
  item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(item_id, alias)
);

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subtype TEXT NOT NULL,
  original_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  note TEXT,
  voter_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(item_id, voter_hash)
);
