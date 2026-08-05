/**
 * Node loader hook for the standalone verification script.
 *
 * Node's native TypeScript support (`--experimental-strip-types`) requires
 * explicit `.ts` extensions on relative ESM imports, and it does not know the
 * `@/` → `./src/` path alias from tsconfig.json. This hook handles both:
 *   1. Rewrites extensionless relative specifiers (`./x`) to `x.ts`.
 *   2. Rewrites `@/<path>` specifiers to `<project-root>/src/<path>.ts`.
 *
 * No src file is modified; this is purely a runtime resolution layer for the
 * throwaway verification script.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/node-ts-loader.mjs \
 *        scripts/verify-tenant-isolation.ts
 *
 * Based on the `module.registerHooks` API added in Node 22.14 / 23.6+.
 */

import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

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

    // 2. @/db → the verification DB shim (mirrors src/db/index.ts without the
    //    CJS `require()` calls that cannot run under ESM).
    if (specifier === "@/db") {
      const candidate = path.join(projectRoot, "scripts", "verify-db.ts");
      return nextResolve(pathToFileURL(candidate).href, context);
    }

    // 3. @/ alias → <root>/src/<path>.ts.
    if (specifier.startsWith("@/")) {
      const rest = specifier.slice(2); // "/db" etc.
      const target = path.join(projectRoot, "src", rest);
      const candidate = target.endsWith(".ts") ? target : `${target}.ts`;
      try {
        return nextResolve(pathToFileURL(candidate).href, context);
      } catch {
        // fall through
      }
    }

    return nextResolve(specifier, context);
  },
});
