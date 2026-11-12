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
}
