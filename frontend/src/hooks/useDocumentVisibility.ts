/**
 * useDocumentVisibility — Tracks document visibility state.
 *
 * Returns `isVisible` (boolean) and fires an optional callback when the tab
 * becomes visible again, useful for triggering immediate refetches.
 */

import { useState, useEffect, useRef } from 'react';

export interface UseDocumentVisibilityOptions {
  /** Called when the document transitions from hidden → visible */
  onVisible?: () => void;
}

export function useDocumentVisibility(options?: UseDocumentVisibilityOptions) {
  const [isVisible, setIsVisible] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'visible',
  );
  const onVisibleRef = useRef(options?.onVisible);

  useEffect(() => {
    onVisibleRef.current = options?.onVisible;
  });

  useEffect(() => {
    const handler = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      if (visible) onVisibleRef.current?.();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return { isVisible };
}
