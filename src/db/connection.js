import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATABASE_PATH = fileURLToPath(new URL('../../data/ticketing.sqlite', import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function createDatabase(databasePath = DEFAULT_DATABASE_PATH) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;');
  database.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return database;
}

export { DEFAULT_DATABASE_PATH };
