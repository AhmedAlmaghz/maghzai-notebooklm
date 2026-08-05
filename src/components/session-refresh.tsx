"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 60_000; // don't re-refresh more than once a minute

/**
 * Silent session bootstrap.
 *
 * The access JWT only lives 15 minutes while the refresh cookie lasts 30 days.
 * Whenever a protected page mounts (or the tab regains focus / becomes visible)
 * this component quietly calls POST /api/auth/refresh so the httpOnly access
 * cookie is rotated and the server-rendered page can re-read a fresh token via
 * router.refresh(). On 401 the user is genuinely logged out and the page-level
 * guards / redirects handle it — this component stays silent.
 *
 * Renders nothing. Drop `<SessionRefresh />` into any protected server page.
 */
export function SessionRefresh() {
  const router = useRouter();
  // Tracks the last *successful* refresh so a burst of focus events doesn't
  // hammer the endpoint (only refresh if >60s since the last success).
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function maybeRefresh() {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_INTERVAL_MS) return;
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include", // same-origin, but explicit for clarity
        });
        if (cancelled) return;
        if (res.ok) {
          lastRefreshRef.current = Date.now();
          // Re-render server components so they read the fresh access cookie.
          router.refresh();
        }
        // 401 → genuinely logged out; guards/redirects handle it. Non-200
        // without 401 (e.g. 5xx) is left alone to avoid churn.
      } catch {
        // Network blip — do nothing, the next focus/visibility event retries.
      }
    }

    void maybeRefresh();

    const onFocus = () => void maybeRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void maybeRefresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}

/**
 * Programmatic access to the same silent-refresh routine for components that
 * want to trigger it on demand (e.g. after a long-lived background task).
 */
export function useSessionRefresh() {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  return async function refreshSession(): Promise<boolean> {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_INTERVAL_MS) return true; // recent success
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        lastRefreshRef.current = Date.now();
        router.refresh();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };
}
