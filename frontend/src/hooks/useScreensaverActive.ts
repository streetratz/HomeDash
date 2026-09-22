/**
 * Lightweight context to signal widgets that the screensaver is active,
 * so they can pause redundant polling.
 */
import { createContext, useContext } from 'react';

export const ScreensaverActiveContext = createContext(false);

export function useScreensaverActive(): boolean {
  return useContext(ScreensaverActiveContext);
}
