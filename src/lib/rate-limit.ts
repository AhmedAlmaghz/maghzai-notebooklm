/**
 * In-memory sliding-window rate limiter.
 *
 * IMPORTANT: this state lives in a single Node process. In multi-instance
 * deployments (Vercel serverless, multiple nodes) replace this with a shared
 * store such as Upstash Redis / Vercel KV (a drop-in `rateLimit` with the same
 * signature backed by `@upstash/ratelimit`). The module is kept deliberately
 * thin so the swap is a one-file change.
 */

export interface RateLimitOptions {
    limit: number;
    windowMs: number;
}

export interface RateLimitResult {
    success: boolean;
    retryAfterMs: number;
}

interface Bucket {
    timestamps: number[]; // sliding window of request timestamps (ms)
}

// Key = `${ip}:${route}` — see buildRateLimitKey() below.
const buckets = new Map<string, Bucket>();

function now(): number {
    return Date.now();
}

function prune(bucket: Bucket, windowMs: number): void {
    const cutoff = now() - windowMs;
    // Trim from the front; the array is kept sorted (insertion order = time order).
    let i = 0;
    while (i < bucket.timestamps.length && bucket.timestamps[i] <= cutoff) i++;
    if (i > 0) bucket.timestamps.splice(0, i);
}

/**
 * Checks a sliding window for `key`. Returns `{ success, retryAfterMs }`.
 * On failure, `retryAfterMs` is the number of ms until the oldest request in
 * the current window falls out (i.e. when a new request will be allowed).
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
    const { limit, windowMs } = opts;

    // Opportunistic cleanup so the Map never grows unbounded.
    if (buckets.size > 10_000) {
        const cutoff = now() - 60 * 60 * 1000;
        for (const [k, b] of buckets) {
            prune(b, windowMs);
            if (b.timestamps.length === 0) buckets.delete(k);
        }
    }

    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { timestamps: [] };
        buckets.set(key, bucket);
    }

    prune(bucket, windowMs);

    if (bucket.timestamps.length >= limit) {
        const oldest = bucket.timestamps[0];
        const retryAfterMs = Math.max(0, oldest + windowMs - now());
        return { success: false, retryAfterMs };
    }

    bucket.timestamps.push(now());
    return { success: true, retryAfterMs: 0 };
}

/**
 * Builds a stable per-IP key for a route, honoring X-Forwarded-For when present
 * (first value is the client IP in most proxies). Falls back to "unknown".
 */
export function buildRateLimitKey(req: Request, route: string): string {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    let ip = "unknown";
    if (forwarded) {
        ip = forwarded.split(",")[0].trim();
    } else if (realIp) {
        ip = realIp.trim();
    }
    return `${ip}:${route}`;
}

/**
 * Convenience: applies rate limiting for a request and returns the result plus
 * a `Retry-After` value (seconds) to set on the response when rejected.
 */
export function checkRateLimit(
    req: Request,
    route: string,
    opts: RateLimitOptions
): { result: RateLimitResult; retryAfterSeconds: number } {
    const key = buildRateLimitKey(req, route);
    const result = rateLimit(key, opts);
    const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
    return { result, retryAfterSeconds };
}
