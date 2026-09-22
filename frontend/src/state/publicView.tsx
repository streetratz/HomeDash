import { createContext, useContext, type ReactNode } from 'react';

const PublicViewContext = createContext(false);

export function PublicViewProvider({
  isPublic,
  children,
}: {
  isPublic: boolean;
  children: ReactNode;
}) {
  return (
    <PublicViewContext.Provider value={isPublic}>
      {children}
    </PublicViewContext.Provider>
  );
}

export function useIsPublicView(): boolean {
  return useContext(PublicViewContext);
}
