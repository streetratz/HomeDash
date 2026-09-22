/**
 * Dynamic font loader — imports @fontsource packages on demand
 * instead of bundling all 13 families at startup.
 */

import { useEffect, useRef } from 'react';

const FONT_IMPORTS: Record<string, () => Promise<unknown>> = {
  inter: () => import('@fontsource-variable/inter'),
  roboto: () => import('@fontsource-variable/roboto-flex'),
  'fira-sans': () => Promise.all([
    import('@fontsource/fira-sans/400.css'),
    import('@fontsource/fira-sans/500.css'),
    import('@fontsource/fira-sans/700.css'),
  ]),
  mono: () => import('@fontsource-variable/fira-code'),
  'jetbrains-mono': () => import('@fontsource-variable/jetbrains-mono'),
  poppins: () => Promise.all([
    import('@fontsource/poppins/400.css'),
    import('@fontsource/poppins/500.css'),
    import('@fontsource/poppins/700.css'),
  ]),
  outfit: () => import('@fontsource-variable/outfit'),
  'space-grotesk': () => import('@fontsource-variable/space-grotesk'),
  'dm-sans': () => import('@fontsource-variable/dm-sans'),
};

/** Fonts that don't need a web font import (system-installed) */
const SYSTEM_FONTS = new Set(['system', 'sf-pro', 'segoe', 'serif']);

/**
 * Dynamically loads the @fontsource CSS for the given font key.
 * No-ops for system fonts. Deduplicates repeated calls for the same key.
 */
export function useFontLoader(fontKey: string | undefined): void {
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const key = fontKey ?? 'system';
    if (SYSTEM_FONTS.has(key)) return;
    if (loadedRef.current.has(key)) return;

    const loader = FONT_IMPORTS[key];
    if (!loader) return;

    loadedRef.current.add(key);
    void loader();
  }, [fontKey]);
}
