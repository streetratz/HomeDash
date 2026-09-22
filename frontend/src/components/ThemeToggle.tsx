import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button.js';
import type { AuthUser } from '../state/bootstrap.js';
import {
  applyTheme,
  storeTheme,
  useUpdateUserPreferences,
} from '../state/settings.js';

interface ThemeToggleProps {
  mode: 'light' | 'dark';
  user: AuthUser | null;
  onToggle?: (newMode: 'light' | 'dark') => void;
}

export function ThemeToggle({ mode, user, onToggle }: ThemeToggleProps) {
  const nextMode = mode === 'dark' ? 'light' : 'dark';
  const updatePrefs = useUpdateUserPreferences();

  async function handleToggle() {
    applyTheme(nextMode);
    storeTheme(nextMode);
    onToggle?.(nextMode);

    if (user) {
      try {
        await updatePrefs.mutateAsync({ themeMode: nextMode });
      } catch {
        applyTheme(mode);
        storeTheme(mode);
        onToggle?.(mode);
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => void handleToggle()}
      data-testid="theme-toggle"
    >
      {mode === 'dark' ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </Button>
  );
}
