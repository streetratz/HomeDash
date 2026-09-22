/**
 * WidgetHeaderContext — allows widget components to inject action
 * buttons into their parent placeholder's header bar.
 */

import { createContext, useContext, useCallback, useMemo, useState, type ReactNode } from 'react';

interface WidgetHeaderContextValue {
  /** Register action elements to render in the header bar */
  setActions: (actions: ReactNode) => void;
}

const WidgetHeaderContext = createContext<WidgetHeaderContextValue | null>(null);

export const WidgetHeaderProvider = WidgetHeaderContext.Provider;

/** Hook for widgets to inject header actions */
export function useWidgetHeader() {
  return useContext(WidgetHeaderContext);
}

/** Hook for PlaceholderWidget to create context + read collected actions */
export function useWidgetHeaderCollector() {
  const [actions, setActionsRaw] = useState<ReactNode>(null);

  const setActions = useCallback((node: ReactNode) => {
    setActionsRaw(node);
  }, []);

  const contextValue = useMemo<WidgetHeaderContextValue>(
    () => ({ setActions }),
    [setActions],
  );

  return { actions, contextValue };
}
