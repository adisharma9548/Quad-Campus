PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
  full_name TEXT DEFAULT '',
  dob TEXT DEFAULT '',
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  branch TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_initials TEXT NOT NULL,
  interests_json TEXT NOT NULL DEFAULT '[]',
  profile_public INTEGER NOT NULL DEFAULT 0,
  discoverable INTEGER NOT NULL DEFAULT 0,
  read_receipts INTEGER NOT NULL DEFAULT 0,
  active_status INTEGER NOT NULL DEFAULT 0,
  suspended_until TEXT,
  suspension_reason TEXT,
  banned_at TEXT,
  ban_reason TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  reauth_until INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER NOT NULL,
  locked_until INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_name TEXT DEFAULT 'Others',
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

CREATE TABLE IF NOT EXISTS follow_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (requester_id, target_id)
);

CREATE TABLE IF NOT EXISTS custom_groups (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  PRIMARY KEY (owner_id, name)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT DEFAULT 'User privacy preference',
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS mutes (
  muter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (muter_id, muted_id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  data BLOB NOT NULL,
  exif_stripped INTEGER NOT NULL DEFAULT 1,
  stripped_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Discussion',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  space TEXT NOT NULL DEFAULT 'public' CHECK (space IN ('public', 'personal')),
  audience TEXT NOT NULL DEFAULT 'public',
  group_name TEXT DEFAULT '',
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  has_image INTEGER NOT NULL DEFAULT 0,
  media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  media_key TEXT DEFAULT '',
  location TEXT DEFAULT '',
  image_alt TEXT DEFAULT '',
  best_answer_id TEXT,
  shares_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'deleted')),
  deleted_reason TEXT,
  deleted_at TEXT,
  idempotency_key TEXT,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_space_status ON posts(space, status, created_at_ms DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_idempotency ON posts(author_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS post_answers (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_answers_post ON post_answers(post_id, created_at_ms ASC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_saves (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS dismissed_posts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS reels (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'Campus Reel',
  duration TEXT NOT NULL DEFAULT '',
  poster_key TEXT DEFAULT 'robotics',
  poster_alt TEXT DEFAULT '',
  media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  cover_media_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  video_path TEXT,
  thumbnail_path TEXT,
  cover_path TEXT,
  width INTEGER,
  height INTEGER,
  processing_error TEXT,
  duration_sec REAL,
  trim_start REAL NOT NULL DEFAULT 0,
  trim_end REAL,
  fit_mode TEXT NOT NULL DEFAULT 'crop',
  audience TEXT NOT NULL DEFAULT 'campus',
  comments_enabled INTEGER NOT NULL DEFAULT 1,
  mentions_json TEXT DEFAULT '[]',
  hashtags_json TEXT DEFAULT '[]',
  shares_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('processing', 'active', 'failed', 'deleted')),
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reel_views (
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (reel_id, user_id)
);

CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (reel_id, user_id)
);

CREATE TABLE IF NOT EXISTS reel_comments (
  id TEXT PRIMARY KEY,
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thread_likes (
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS thread_replies (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id TEXT REFERENCES thread_replies(id) ON DELETE CASCADE,
  reply_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reply_to_username TEXT DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  deleted_at TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user', 'reel', 'thread', 'thread_comment')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT DEFAULT '',
  content_snippet TEXT DEFAULT '',
  target_context TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'actioned')),
  action_taken TEXT DEFAULT '',
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  admin_user TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_username TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id TEXT DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS this_week_events (
  id TEXT PRIMARY KEY,
  date_label TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
