import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Hook that detects whether text content overflows its container.
 * Uses ResizeObserver for responsive detection with a configurable tolerance.
 *
 * @param tolerance - Pixel buffer before considering text as overflowing (default: 4)
 * @returns [ref, overflows] - Attach ref to the text container element
 */
export function useTextOverflow<T extends HTMLElement = HTMLElement>(
  tolerance = 4,
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [overflows, setOverflows] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setOverflows(false);
      return;
    }
    setOverflows(el.scrollWidth > el.clientWidth + tolerance);
  }, [tolerance]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    checkOverflow();

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [checkOverflow]);

  return [ref, overflows];
}
