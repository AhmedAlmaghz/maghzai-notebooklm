/**
 * Database client
 *
 * Supports two modes:
 *  - PostgreSQL (Neon / any Postgres):  set DATABASE_URL to a postgres:// connection string
 *  - SQLite (local dev only):           set DATABASE_DRIVER=sqlite (or leave DATABASE_URL unset)
 *
 * On Vercel, DATABASE_URL must be a PostgreSQL connection string.
 * better-sqlite3 is a native module that cannot run in Vercel's serverless environment.
 */

import { IS_POSTGRES } from "./schema";
import * as schemaPg from "./schema-pg";

// ─── PostgreSQL (Vercel / Neon / any hosted Postgres) ────────────────────────

async function initPostgres() {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when using PostgreSQL driver.\n" +
        "Set it to your Neon (or other Postgres) connection string."
    );
  }

  // Re-use the pool across hot-reloads in dev to avoid connection exhaustion.
  const globalForDb = globalThis as typeof globalThis & {
    __nblmPgPool?: InstanceType<typeof Pool>;
  };

  const pool =
    globalForDb.__nblmPgPool ??
    new Pool({
      connectionString: databaseUrl,
      // Neon requires SSL; regular Postgres works fine with or without it.
      ssl: databaseUrl.includes("neon.tech")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__nblmPgPool = pool;
  }

  // Auto-create tables when the app first boots.
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

  return drizzle(pool, { schema: schemaPg });
}

// ─── SQLite (local development only) ─────────────────────────────────────────

function initSqlite() {
  // Dynamic require so that Vercel's bundler never tries to include
  // better-sqlite3 (a native module that won't compile in serverless).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const schemaSqlite = require("./schema-sqlite");
  const path = require("path");

  let dbPath = process.env.SQLITE_DB_PATH || "nblm_app.db";
  if (dbPath.startsWith("file:")) dbPath = dbPath.replace(/^file:/, "");
  if (!path.isAbsolute(dbPath)) dbPath = path.join(process.cwd(), dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

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

  return drizzle(sqlite, { schema: schemaSqlite }) as Awaited<ReturnType<typeof initPostgres>>;
}

// ─── Export ───────────────────────────────────────────────────────────────────

// Top-level await is fine in Next.js server modules.
export const db = IS_POSTGRES
  ? await initPostgres()
  : initSqlite();
