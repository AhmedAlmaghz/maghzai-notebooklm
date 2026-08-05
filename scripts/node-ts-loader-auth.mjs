/**
 * Node loader hook for the standalone AUTH verification script
 * (scripts/verify-auth-flows.ts).
 *
 * Extends scripts/node-ts-loader.mjs (which rewrites `@/db` → the SQLite shim
 * and `@/` → `./src/`) with two extra rewrites needed to run the REAL route
 * handlers outside a Next.js request:
 *
 *   1. `next/headers` → scripts/next-headers-shim.ts. The real module throws
 *      "Invariant: headers expected to render once" outside an AsyncLocalStorage
 *      request scope. The shim provides a process-global cookie jar with the
 *      same interface (get/set/delete + __reset/__dump), so the auth lib can
 *      run and the script can simulate browser cookies + read the CSRF token.
 *   2. `next/server` → the real `next/server.js` file (resolves under Node),
 *      so `NextResponse.json()` behaves exactly as in production.
 *
 * No src file is modified; this is purely a runtime resolution layer for the
 * throwaway verification script.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/node-ts-loader-auth.mjs \
 *        scripts/verify-auth-flows.ts
 */

import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Register the better-sqlite3 Date→ISO binding patch BEFORE anything can open
// the throwaway SQLite DB (the `@/db` shim is resolved through this hook, and
// static ESM imports of modules that touch the DB are hoisted above the script's
// env setup). See scripts/date-bind-shim.mjs.
await import("./date-bind-shim.mjs");

registerHooks({
  resolve(specifier, context, nextResolve) {
    // 1. Extensionless relative imports → add .ts.
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      if (!/\.[a-z0-9]+$/i.test(specifier)) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          // fall through
        }
      }
    }

    // 2. next/headers → the standalone cookie-jar shim.
    if (specifier === "next/headers") {
      const candidate = path.join(projectRoot, "scripts", "next-headers-shim.ts");
      return nextResolve(pathToFileURL(candidate).href, context);
    }

    // 3. next/server → the real implementation file (works standalone).
    if (specifier === "next/server" || specifier === "next/server.js") {
      return nextResolve("next/server.js", context);
    }

    // 4. @/db → the verification DB shim (mirrors src/db/index.ts without the
    //    CJS `require()` calls that cannot run under ESM).
    if (specifier === "@/db") {
      const candidate = path.join(projectRoot, "scripts", "verify-db.ts");
      return nextResolve(pathToFileURL(candidate).href, context);
    }

    // 5. @/ alias → <root>/src/<path>.ts (with a directory → index.ts fallback,
    //    e.g. `@/i18n` → src/i18n/index.ts used by the register route).
    if (specifier.startsWith("@/")) {
      const rest = specifier.slice(2); // "/db" etc.
      const target = path.join(projectRoot, "src", rest);
      const candidate = target.endsWith(".ts") ? target : `${target}.ts`;
      try {
        return nextResolve(pathToFileURL(candidate).href, context);
      } catch {
        // fall through
      }
      try {
        return nextResolve(pathToFileURL(`${target}/index.ts`).href, context);
      } catch {
        // fall through
      }
    }

    return nextResolve(specifier, context);
  },
});
