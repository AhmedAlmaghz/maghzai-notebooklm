/**
 * Verification shim for `next/headers` — used ONLY by scripts/verify-auth-flows.ts
 * (via the node-ts-loader-auth.mjs resolver). The real `next/headers` module can
 * only be used inside a Next.js request scope (AsyncLocalStorage); outside one it
 * throws `Invariant: headers expected to render once`. This shim gives the
 * standalone script a process-global cookie jar with the exact same interface the
 * auth lib uses:
 *
 *   cookies() → Promise<{ get(name), set(name, value, opts), delete(name) }>
 *
 * The verification script resets the jar (`__reset()`) before each HTTP-flow
 * step and inspects it (`__dump()`) to simulate browser cookies and read the CSRF
 * token, exactly like `client-csrf.ts` reads `document.cookie` in the browser.
 *
 * This is a runtime-only stand-in; it is never imported by app code and never
 * ships to the Next.js bundle. The production app keeps using the real
 * `next/headers` (src/lib/auth.ts).
 */

type CookieValue = { value: string };

// Shared mutable jar. Imported modules hold a reference to the `cookies` object,
// so we mutate this same map across imports (no re-assignment).
const jar = new Map<string, CookieValue>();

export function cookies() {
  return Promise.resolve({
    get(name: string): CookieValue | undefined {
      return jar.get(name);
    },
    set(name: string, value: string): void {
      jar.set(name, { value });
    },
    delete(name: string): void {
      jar.delete(name);
    },
  });
}

export function headers() {
  return Promise.resolve(new Headers());
}

export function draftMode() {
  return Promise.resolve({ isEnabled: false, enable: () => {}, disable: () => {} });
}

/** Resets the cookie jar (used between verification steps). */
export function __reset() {
  jar.clear();
}

/** Returns a copy of the current cookie jar. */
export function __dump(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, { value }] of jar) out[name] = value;
  return out;
}
