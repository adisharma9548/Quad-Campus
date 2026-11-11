import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export function openDatabase(dbPath = './data/quad.db') {
  if (dbPath !== ':memory:') {
    const resolvedDir = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(schema);
  return db;
}
