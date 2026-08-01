import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import Database from "better-sqlite3";
import path from "path";
import * as schemaPg from "./schema-pg";
import * as schemaSqlite from "./schema-sqlite";
import { IS_POSTGRES } from "./schema";

function initSqlite() {
  let dbPath = process.env.DATABASE_URL || "nblm_app.db";
  if (dbPath.startsWith("file:")) {
    dbPath = dbPath.replace(/^file:/, "");
  }
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.join(process.cwd(), dbPath);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  // Auto create SQLite tables if they do not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'دفتر بحث بلا عنوان',
      emoji TEXT NOT NULL DEFAULT '📓',
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

  return drizzleSqlite(sqlite, { schema: schemaSqlite });
}

async function initPostgres() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when using PostgreSQL driver");
  }

  const globalForDb = globalThis as typeof globalThis & {
    __arenaNextJsPostgresqlPool?: Pool;
  };

  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  // Auto create PostgreSQL tables if they do not exist.
  // Awaiting here ensures tables exist before the client is used.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL DEFAULT 'دفتر بحث بلا عنوان',
      emoji VARCHAR(8) NOT NULL DEFAULT '📓',
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      type VARCHAR(20) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      source_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'ready',
      error_message TEXT,
      char_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS source_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      citations JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      kind VARCHAR(20) NOT NULL DEFAULT 'note',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  return drizzlePg(pool, { schema: schemaPg });
}

// Top-level await guarantees the PostgreSQL tables exist before `db` is
// available to any importing module (server components, route handlers, etc.).
// For SQLite, initSqlite() is synchronous and creates tables inline.
//
// `db` is typed as the PostgreSQL client to match the PostgreSQL schema types
// exported from `./schema` (they are cast to PG types regardless of driver).
export const db = IS_POSTGRES
  ? await initPostgres()
  : (initSqlite() as unknown as Awaited<ReturnType<typeof initPostgres>>);
