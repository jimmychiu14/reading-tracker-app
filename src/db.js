import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const url = process.env.TURSO_DATABASE_URL || `file:${join(dataDir, "reading-tracker.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const db = createClient({ url, authToken });

const schema = [
  `CREATE TABLE IF NOT EXISTS books (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    author        TEXT    NOT NULL DEFAULT '',
    isbn          TEXT    DEFAULT '',
    total_pages   INTEGER NOT NULL DEFAULT 0,
    current_page  INTEGER NOT NULL DEFAULT 0,
    status        TEXT    NOT NULL DEFAULT 'want_to_read'
                  CHECK (status IN ('want_to_read', 'reading', 'completed')),
    rating        INTEGER DEFAULT NULL
                  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    cover_url     TEXT    DEFAULT '',
    started_at    TEXT    DEFAULT NULL,
    finished_at   TEXT    DEFAULT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS book_tags (
    book_id  INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    content     TEXT    NOT NULL,
    page        INTEGER DEFAULT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id)`,
  `CREATE INDEX IF NOT EXISTS idx_books_status  ON books(status)`,
];

let initialized = false;

export async function initDb() {
  if (initialized) return;
  initialized = true;
  for (const sql of schema) {
    await db.execute(sql);
  }
}

export function now() {
  return new Date().toISOString();
}
