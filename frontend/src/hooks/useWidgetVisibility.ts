/**
 * useWidgetVisibility — Combines Page Visibility API + IntersectionObserver
 * to determine if a widget is "active" (tab visible AND element in viewport).
 *
 * Returns `isActive` boolean: true only when both conditions are met.
 */

import { useState, useEffect, useRef, type RefObject } from 'react';

export function useWidgetVisibility(ref: RefObject<HTMLElement | null>): boolean {
  const [isPageVisible, setIsPageVisible] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'visible',
  );
  const [isIntersecting, setIsIntersecting] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track page visibility
  useEffect(() => {
    const handler = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Track intersection with viewport
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [ref]);

  return isPageVisible && isIntersecting;
}
