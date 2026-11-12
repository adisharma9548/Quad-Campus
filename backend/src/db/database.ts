import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export function openDatabase(dbPath: string = './data/quad.db'): DatabaseSync {
  if (dbPath !== ':memory:') {
    const resolvedDir = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(schema);
  migrate(db);
  return db;
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

/** Additive, idempotent migrations for databases created by earlier versions. */
function migrate(db: DatabaseSync): void {
  if (!hasColumn(db, 'posts', 'edited_at_ms')) {
    db.exec('ALTER TABLE posts ADD COLUMN edited_at_ms INTEGER');
  }
  if (!hasColumn(db, 'thread_replies', 'parent_comment_id')) {
    db.exec('ALTER TABLE thread_replies ADD COLUMN parent_comment_id TEXT');
  }
  if (!hasColumn(db, 'thread_replies', 'reply_to_user_id')) {
    db.exec('ALTER TABLE thread_replies ADD COLUMN reply_to_user_id TEXT');
  }
  if (!hasColumn(db, 'thread_replies', 'reply_to_username')) {
    db.exec("ALTER TABLE thread_replies ADD COLUMN reply_to_username TEXT DEFAULT ''");
  }
  if (!hasColumn(db, 'thread_replies', 'status')) {
    db.exec("ALTER TABLE thread_replies ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }
  if (!hasColumn(db, 'thread_replies', 'deleted_at')) {
    db.exec('ALTER TABLE thread_replies ADD COLUMN deleted_at TEXT');
  }
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_thread_replies_thread_parent ON thread_replies(thread_id, parent_comment_id, created_at_ms ASC)'
  );

  // Ensure reports table CHECK constraint includes 'thread_comment' and has target_context column
  const reportsMeta = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reports'")
    .get() as { sql?: string } | undefined;
  if (reportsMeta?.sql && !reportsMeta.sql.includes('thread_comment')) {
    const hasCtxCol = hasColumn(db, 'reports', 'target_context');
    const ctxExpr = hasCtxCol ? "COALESCE(target_context, '')" : "''";
    db.exec(`
      BEGIN;
      CREATE TABLE reports_migrated (
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
      INSERT INTO reports_migrated
        (id, reporter_id, target_type, target_id, reason, details, content_snippet, target_context, status, action_taken, resolved_at, created_at)
      SELECT
        id, reporter_id, target_type, target_id, reason, COALESCE(details, ''), COALESCE(content_snippet, ''), ${ctxExpr}, status, COALESCE(action_taken, ''), resolved_at, created_at
      FROM reports;
      DROP TABLE reports;
      ALTER TABLE reports_migrated RENAME TO reports;
      COMMIT;
    `);
  } else if (!hasColumn(db, 'reports', 'target_context')) {
    db.exec("ALTER TABLE reports ADD COLUMN target_context TEXT DEFAULT ''");
  }

  // Additive Part 5 Reel metadata columns
  if (!hasColumn(db, 'reels', 'cover_media_id')) {
    db.exec('ALTER TABLE reels ADD COLUMN cover_media_id TEXT');
  }
  if (!hasColumn(db, 'reels', 'duration_sec')) {
    db.exec('ALTER TABLE reels ADD COLUMN duration_sec REAL NOT NULL DEFAULT 30');
  }
  if (!hasColumn(db, 'reels', 'trim_start')) {
    db.exec('ALTER TABLE reels ADD COLUMN trim_start REAL NOT NULL DEFAULT 0');
  }
  if (!hasColumn(db, 'reels', 'trim_end')) {
    db.exec('ALTER TABLE reels ADD COLUMN trim_end REAL NOT NULL DEFAULT 30');
  }
  if (!hasColumn(db, 'reels', 'fit_mode')) {
    db.exec("ALTER TABLE reels ADD COLUMN fit_mode TEXT NOT NULL DEFAULT 'crop'");
  }
  if (!hasColumn(db, 'reels', 'audience')) {
    db.exec("ALTER TABLE reels ADD COLUMN audience TEXT NOT NULL DEFAULT 'campus'");
  }
  if (!hasColumn(db, 'reels', 'comments_enabled')) {
    db.exec('ALTER TABLE reels ADD COLUMN comments_enabled INTEGER NOT NULL DEFAULT 1');
  }
  if (!hasColumn(db, 'reels', 'mentions_json')) {
    db.exec("ALTER TABLE reels ADD COLUMN mentions_json TEXT DEFAULT '[]'");
  }
  if (!hasColumn(db, 'reels', 'hashtags_json')) {
    db.exec("ALTER TABLE reels ADD COLUMN hashtags_json TEXT DEFAULT '[]'");
  }
}
