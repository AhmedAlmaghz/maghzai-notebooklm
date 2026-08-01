"use client";

import { useState, useEffect, useRef, ReactNode, ComponentType } from "react";

interface LazyLoadWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  threshold?: number;
  rootMargin?: string;
  className?: string;
}

/**
 * Lazy load wrapper with intersection observer
 * Only renders children when they're visible in the viewport
 */
export function LazyLoadWrapper({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = "100px",
  className = "",
}: LazyLoadWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, hasLoaded]);

  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400" />
    </div>
  );

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : fallback || defaultFallback}
    </div>
  );
}

/**
 * Higher-order component for lazy loading components
 */
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    threshold?: number;
    rootMargin?: string;
  }
) {
  return function LazyLoadedComponent(props: P) {
    return (
      <LazyLoadWrapper
        fallback={options?.fallback}
        threshold={options?.threshold}
        rootMargin={options?.rootMargin}
      >
        <Component {...props} />
      </LazyLoadWrapper>
    );
  };
}

