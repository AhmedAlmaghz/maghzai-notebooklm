/**
 * Preload shim — Date → ISO-string binding for better-sqlite3 in the
 * verification scripts only.
 *
 * better-sqlite3 v13 refuses to bind a `Date` instance ("SQLite3 can only bind
 * numbers, strings, bigints, buffers, and null"). The auth lib writes real
 * `Date` objects into `refresh_tokens` / `email_verifications` / `password_resets`
 * TEXT columns. In production (Postgres) that is fine; on SQLite the app's own
 * services already write ISO strings (see `nowValue()` in org-service). This
 * preload patches the `Statement` methods (`run`/`get`/`all` + raw variants) to
 * coerce any `Date` parameter to `.toISOString()` — the same representation the
 * app writes on SQLite — so the REAL auth route handlers run unchanged.
 *
 * MUST be registered with `--import ./scripts/date-bind-shim.mjs` BEFORE any
 * module that opens the SQLite DB (i.e. before the `@/db` shim loads).
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// The auth lib (src/lib/auth.ts) uses a bare `require("crypto")` inside
// timingSafeEqualHex(). Under Node ESM a bare `require` is undefined; expose one
// so the REAL auth source runs unchanged in the verification script.
if (typeof globalThis.require !== "function") {
  globalThis.require = require;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3");

const coerce = (params) =>
    params.map((p) => (p instanceof Date ? p.toISOString() : p));

const origPrepare = Database.prototype.prepare;
Database.prototype.prepare = function (source) {
    const stmt = origPrepare.call(this, source);
    const origRun = stmt.run.bind(stmt);
    const origGet = stmt.get.bind(stmt);
    const origAll = stmt.all.bind(stmt);
    stmt.run = (...params) => origRun(...coerce(params));
    stmt.get = (...params) => origGet(...coerce(params));
    stmt.all = (...params) => origAll(...coerce(params));
    const origRaw = stmt.raw.bind(stmt);
    stmt.raw = () => {
        const raw = origRaw();
        const origRawGet = raw.get.bind(raw);
        const origRawAll = raw.all.bind(raw);
        raw.get = (...params) => origRawGet(...coerce(params));
        raw.all = (...params) => origRawAll(...coerce(params));
        return raw;
    };
    return stmt;
};
