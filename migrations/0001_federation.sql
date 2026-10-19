-- Fediverse state for the @blog@dominikhofer.me actor.
CREATE TABLE key_pairs (
  identifier  TEXT NOT NULL,
  algorithm   TEXT NOT NULL,
  private_key TEXT NOT NULL,
  public_key  TEXT NOT NULL,
  PRIMARY KEY (identifier, algorithm)
);

CREATE TABLE followers (
  actor_id         TEXT PRIMARY KEY,
  inbox_url        TEXT NOT NULL,
  shared_inbox_url TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Posts already announced to followers, to detect new, changed and removed ones.
CREATE TABLE posts (
  slug         TEXT PRIMARY KEY,
  object_id    TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  published_at TEXT NOT NULL
);

-- Replies to posts from fediverse accounts.
CREATE TABLE comments (
  id           TEXT PRIMARY KEY,
  post_slug    TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  author_name  TEXT NOT NULL,
  author_url   TEXT NOT NULL,
  author_handle TEXT,
  author_avatar TEXT,
  content      TEXT NOT NULL,
  url          TEXT,
  published_at TEXT NOT NULL
);

CREATE INDEX comments_post_slug ON comments (post_slug, published_at);
