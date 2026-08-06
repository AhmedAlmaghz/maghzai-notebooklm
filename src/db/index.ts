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
  //
  // During `next build` (and serverless cold starts) multiple worker processes
  // call this at the same time. Postgres' CREATE TABLE IF NOT EXISTS is NOT
  // race-safe for brand-new tables (concurrent type creation collides in
  // pg_type), so we serialize the whole DDL block behind a session-level
  // advisory lock held on a dedicated client.
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(83749021)");
    await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      -- Nullable: OAuth-only users (e.g. Google) have no password.
      password TEXT,
      -- Profile picture URL (from OAuth provider, optional).
      image TEXT,
      email_verified_at TIMESTAMPTZ,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      refresh_token_version INTEGER NOT NULL DEFAULT 0,
      organization_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(32) NOT NULL,
      provider_account_id VARCHAR(255) NOT NULL,
      provider_email VARCHAR(255),
      provider_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT oauth_accounts_provider_unique UNIQUE (provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT memberships_organization_user_unique UNIQUE (organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
      visibility VARCHAR(20) NOT NULL DEFAULT 'private',
      title VARCHAR(255) NOT NULL DEFAULT 'دفتر بحث بلا عنوان',
      emoji VARCHAR(8) NOT NULL DEFAULT '📓',
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
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

    -- Soft-delete migration for existing databases.
    ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

    -- Auth migrations for existing databases (idempotent).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
    -- Allow NULL passwords for OAuth-only users (no-op if already nullable).
    ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

    -- Multi-tenant isolation migrations for existing databases (idempotent).
    ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS organization_id TEXT;
    ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private';
    `);
  } finally {
    // Always release the advisory lock and the dedicated client, even on error.
    await client.query("SELECT pg_advisory_unlock(83749021)").catch(() => { });
    client.release();
  }

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
      -- Nullable: OAuth-only users (e.g. Google) have no password.
      password TEXT,
      -- Profile picture URL (from OAuth provider, optional).
      image TEXT,
      email_verified_at TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      refresh_token_version INTEGER NOT NULL DEFAULT 0,
      organization_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      provider_email TEXT,
      provider_name TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (provider, provider_account_id)
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

    -- Soft-delete migration for existing databases.
    ALTER TABLE notebooks ADD COLUMN deleted_at TEXT;
  `);

  // SQLite does not support "ADD COLUMN IF NOT EXISTS", so check the existing
  // columns via PRAGMA table_info for the specific table being altered and
  // only add missing ones (idempotent).
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
  addColumn("users", "image", "image TEXT");
  addColumn("notebooks", "organization_id", "organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL");
  addColumn("notebooks", "visibility", "visibility TEXT NOT NULL DEFAULT 'private'");

  // Migration: SQLite cannot drop a NOT NULL constraint in place, so rebuild
  // the users table when the password column is still NOT NULL (existing DBs
  // created before Google OAuth support).
  const userCols = sqlite.pragma("table_info(users)") as {
    name: string;
    notnull: number;
  }[];
  const passwordCol = userCols.find((c) => c.name === "password");
  if (passwordCol && passwordCol.notnull === 1) {
    sqlite.exec(`
      BEGIN;
      CREATE TABLE users_oauth (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        image TEXT,
        email_verified_at TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        refresh_token_version INTEGER NOT NULL DEFAULT 0,
        organization_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO users_oauth (
        id, name, email, password, image, email_verified_at,
        role, refresh_token_version, organization_id, created_at, updated_at
      )
      SELECT
        id, name, email, password, NULL, email_verified_at,
        role, refresh_token_version, organization_id, created_at, updated_at
      FROM users;
      DROP TABLE users;
      ALTER TABLE users_oauth RENAME TO users;
      COMMIT;
    `);
  }

  return drizzle(sqlite, { schema: schemaSqlite }) as Awaited<ReturnType<typeof initPostgres>>;
}

// ─── Export ───────────────────────────────────────────────────────────────────

// Top-level await is fine in Next.js server modules.
export const db = IS_POSTGRES
  ? await initPostgres()
  : initSqlite();
