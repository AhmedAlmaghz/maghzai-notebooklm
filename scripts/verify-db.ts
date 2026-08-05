/**
 * Verification DB shim — mirrors `src/db/index.ts`'s SQLite path exactly, but
 * without the CJS `require()` calls (which can't run under Node ESM) and with
 * the same table definitions + idempotent ALTERs so the throwaway verification
 * DB has the identical real schema and constraints the app uses.
 *
 * This is ONLY used by scripts/verify-tenant-isolation.ts via the
 * node-ts-loader's `@/db` rewrite. The production app keeps using src/db.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schemaSqlite from "../src/db/schema-sqlite";

// Throwaway DB next to the script. Always derived from this file's own
// location so it works regardless of CWD or dotenv state. Uses the per-run
// unique path set by verify-tenant-isolation.ts (SQLITE_DB_PATH) and falls
// back to a stable name for direct use.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "nblm_verify_isolation.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email_verified_at TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    refresh_token_version INTEGER NOT NULL DEFAULT 0,
    organization_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL,
    UNIQUE (organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    title TEXT NOT NULL DEFAULT 'دفتر بحث بلا عنوان',
    emoji TEXT NOT NULL DEFAULT '📓',
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'ready',
    error_message TEXT,
    char_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS source_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'note',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// SQLite does not support "ADD COLUMN IF NOT EXISTS", so check the existing
// columns via PRAGMA table_info and only add missing ones (idempotent).
const addColumn = (table: string, column: string, ddl: string) => {
  const cols = new Set(
    (sqlite.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name)
  );
  if (!cols.has(column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  }
};
addColumn("users", "email_verified_at", "email_verified_at TEXT");
addColumn("users", "role", "role TEXT NOT NULL DEFAULT 'user'");
addColumn("users", "refresh_token_version", "refresh_token_version INTEGER NOT NULL DEFAULT 0");
addColumn("users", "organization_id", "organization_id TEXT");
addColumn("notebooks", "organization_id", "organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL");
addColumn("notebooks", "visibility", "visibility TEXT NOT NULL DEFAULT 'private'");

export const db = drizzle(sqlite, { schema: schemaSqlite });
