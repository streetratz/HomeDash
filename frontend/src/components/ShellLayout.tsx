/**
 * T059 (US1): Shell layout — header / main / footer.
 * T073/T074/T076 (US2): Integrated ThemeToggle, UserMenu, and ClockStrip.
 *
 * Provides the outer chrome for every page: branded header with user nav,
 * optional clock strip below the header, scrollable main content area,
 * and optional footer text. Mobile-responsive with Sheet-based nav.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, LogIn, Pencil, Save, X, Plus, LayoutGrid, Loader2, MonitorPlay, ArrowDownToLine } from 'lucide-react';
import { Button } from './ui/button.js';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet.js';
import { Separator } from './ui/separator.js';
import type { AuthUser, ShellSettings, ClockDisplayConfig } from '../state/bootstrap.js';
import { ThemeToggle } from './ThemeToggle.js';
import { UserMenu } from './UserMenu.js';
import { ClockStrip } from './ClockStrip.js';
import { APP_VERSION } from '../lib/buildInfo.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { useFontLoader } from '../hooks/useFontLoader.js';
import './header-animations.css';

const FONT_STACKS: Record<string, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'sf-pro': '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
  inter: '"Inter Variable", "Inter", system-ui, sans-serif',
  roboto: '"Roboto Flex Variable", "Roboto Flex", "Roboto", system-ui, sans-serif',
  'fira-sans': '"Fira Sans", system-ui, sans-serif',
  poppins: '"Poppins", system-ui, sans-serif',
  outfit: '"Outfit Variable", "Outfit", system-ui, sans-serif',
  'space-grotesk': '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif',
  'dm-sans': '"DM Sans Variable", "DM Sans", system-ui, sans-serif',
  segoe: '"Segoe UI", system-ui, sans-serif',
  mono: '"Fira Code Variable", "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace',
  'jetbrains-mono': '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
};

interface ShellLayoutProps {
  shell: ShellSettings | null;
  user?: AuthUser | null;
  themeMode?: 'light' | 'dark';
  onThemeToggle?: (newMode: 'light' | 'dark') => void;
  onLogout?: () => void;
  /** Callback to enter dashboard edit mode — shown as a header button when provided. */
  onEditDashboard?: () => void;
  /** Callback to manually trigger screensaver */
  onScreensaver?: () => void;
  /** Edit mode state — when provided, shows edit controls in header */
  editMode?: {
    isEditing: boolean;
    isDirty: boolean;
    isSaving: boolean;
    activeBreakpoint?: string;
    onSave: () => void;
    onCancel: () => void;
    onAddPlaceholder: () => void;
    onAddWidget?: () => void;
    onCopyToSmaller?: () => void;
  };
  /** When true, main content fills the viewport edge-to-edge with no padding. */
  fullBleed?: boolean;
  children: ReactNode;
}

export function ShellLayout({
  shell,
  user,
  themeMode = 'dark',
  onThemeToggle,
  onEditDashboard,
  onScreensaver,
  editMode,
  onLogout,
  fullBleed = false,
  children,
}: ShellLayoutProps) {
  const titleText = shell?.titleText ?? 'HomeDash';
  const titleFont = shell?.titleFont ?? 'system';
  const titleFontSizePx = shell?.titleFontSizePx ?? 18;
  const bodyFont = shell?.bodyFont ?? 'system';
  const logoUrl = shell?.logoUrl ?? null;
  const headerHeightPx = shell?.headerHeightPx ?? 56;
  const footerText = shell?.footerText ?? null;
  const repoUrl = shell?.repoUrl ?? null;
  const clockStripEnabled = shell?.clockStripEnabled ?? false;
  const clockStripAlignment = shell?.clockStripAlignment ?? 'center';
  const clockDisplayConfig = (shell?.clockDisplayConfig ?? {}) as ClockDisplayConfig;
  const clocks = shell?.clocks ?? [];
  const headerStyle = shell?.headerStyle ?? 'none';
  const headerTitleStyle = shell?.headerTitleStyle ?? 'none';
  const headerGlassEffect = shell?.headerGlassEffect ?? false;

  const titleFontStyle = {
    fontFamily: FONT_STACKS[titleFont] ?? FONT_STACKS['system'],
    fontSize: `${titleFontSizePx}px`,
  };

  // Apply body font to document root
  useFontLoader(bodyFont);
  useFontLoader(titleFont);
  useEffect(() => {
    const family = FONT_STACKS[bodyFont] ?? FONT_STACKS['system'] ?? '';
    document.documentElement.style.fontFamily = family;
    return () => { document.documentElement.style.fontFamily = ''; };
  }, [bodyFont]);

  // Compute header animation classes
  const headerAnimClass = headerStyle !== 'none' ? `header-anim-${headerStyle}-bg` : '';
  const headerGlassClass = headerGlassEffect ? 'header-glass-effect' : '';
  const titleAnimClass = headerTitleStyle !== 'none' ? `header-anim-${headerTitleStyle}-title` : '';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keep the browser tab title in sync with the configured site title
  useEffect(() => {
    document.title = titleText;
  }, [titleText]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className={`relative flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${headerAnimClass} ${headerGlassClass}`.trim()}
        style={{ height: `${headerHeightPx}px` }}
        role="banner"
      >
        {/* Left — logo + title */}
        <Link
          to="/"
          className="flex items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Go to dashboard"
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              aria-hidden="true"
              className="h-8 w-8 rounded object-contain"
            />
          )}
          <span
            className={`truncate font-semibold tracking-tight transition hover:opacity-80 ${titleAnimClass}`.trim()}
            style={titleFontStyle}
          >
            {titleText}
          </span>
        </Link>

        {/* Right — desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {editMode?.isEditing ? (
            <>
              <div className="mr-2 rounded-full bg-status-info/20 px-3 py-1 text-xs font-medium text-status-info">
                Edit Mode
              </div>
              {editMode.activeBreakpoint && editMode.activeBreakpoint !== 'lg' && (
                <div className="mr-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
                  {editMode.activeBreakpoint.toUpperCase()}
                </div>
              )}
              {editMode.onAddWidget && (
                <Button variant="outline" size="sm" onClick={editMode.onAddWidget} disabled={editMode.isSaving}>
                  <LayoutGrid className="mr-1.5 h-4 w-4" />
                  Add Widget
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={editMode.onAddPlaceholder} disabled={editMode.isSaving}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Container
              </Button>
              {editMode.onCopyToSmaller && editMode.activeBreakpoint !== 'xxs' && (
                <Button variant="outline" size="sm" onClick={editMode.onCopyToSmaller} disabled={editMode.isSaving}>
                  <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                  Apply to Smaller Sizes
                </Button>
              )}
              <div className="mx-1 h-6 w-px bg-border" />
              <Button variant="ghost" size="sm" onClick={editMode.onCancel} disabled={editMode.isSaving}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={editMode.onSave} disabled={!editMode.isDirty || editMode.isSaving}>
                {editMode.isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              {onEditDashboard && (
                <Button variant="ghost" size="icon" onClick={onEditDashboard} aria-label="Edit dashboard layout">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onScreensaver && (
                <Button variant="ghost" size="icon" onClick={onScreensaver} aria-label="Start screensaver">
                  <MonitorPlay className="h-4 w-4" />
                </Button>
              )}
              <ThemeToggle
                mode={themeMode}
                user={user ?? null}
                {...(onThemeToggle ? { onToggle: onThemeToggle } : {})}
              />
              <nav aria-label="User navigation">
                {user ? (
                  <UserMenu user={user} onLogout={onLogout ?? (() => undefined)} />
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <a href="/login" data-testid="login-link">
                      <LogIn className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Login
                    </a>
                  </Button>
                )}
              </nav>
            </>
          )}
        </div>

        {/* Right — mobile hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="font-semibold" style={titleFontStyle}>{titleText}</SheetTitle>
              <Separator className="my-3" />
              <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
                {editMode?.isEditing ? (
                  <>
                    <div className="rounded-md bg-status-info/20 px-3 py-2 text-sm font-medium text-status-info">
                      Dashboard Edit Mode
                    </div>
                    {editMode.onAddWidget && (
                      <Button
                        variant="ghost"
                        className="min-h-11 justify-start"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          editMode.onAddWidget?.();
                        }}
                        disabled={editMode.isSaving}
                      >
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        Add Widget
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="min-h-11 justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        editMode.onAddPlaceholder();
                      }}
                      disabled={editMode.isSaving}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Container
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-11 justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        editMode.onCancel();
                      }}
                      disabled={editMode.isSaving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel Changes
                    </Button>
                    <Button
                      className="min-h-11 justify-start"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        editMode.onSave();
                      }}
                      disabled={!editMode.isDirty || editMode.isSaving}
                    >
                      {editMode.isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Dashboard
                    </Button>
                  </>
                ) : onEditDashboard ? (
                  <Button variant="ghost" className="justify-start" onClick={() => { setMobileMenuOpen(false); onEditDashboard(); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Dashboard
                  </Button>
                ) : null}
                {!editMode?.isEditing && onScreensaver && (
                  <Button variant="ghost" className="justify-start" onClick={() => { setMobileMenuOpen(false); onScreensaver(); }}>
                    <MonitorPlay className="mr-2 h-4 w-4" />
                    Screensaver
                  </Button>
                )}
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <ThemeToggle
                    mode={themeMode}
                    user={user ?? null}
                    {...(onThemeToggle ? { onToggle: onThemeToggle } : {})}
                  />
                  <span className="text-sm text-muted-foreground">Theme</span>
                </div>
                <Separator />
                {user ? (
                  <>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {user.displayName
                          .split(' ')
                          .slice(0, 2)
                          .map((w) => w[0] ?? '')
                          .join('')
                          .toUpperCase()}
                      </span>
                      {user.displayName}
                    </div>
                    <Separator />
                    <Button variant="ghost" className="justify-start" asChild>
                      <Link to="/settings" onClick={() => setMobileMenuOpen(false)}>
                        Settings
                      </Link>
                    </Button>
                    {user.role === 'admin' && (
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link to="/admin/dashboards" onClick={() => setMobileMenuOpen(false)}>
                          Manage Dashboards
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="justify-start text-destructive"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onLogout?.();
                      }}
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="justify-start" asChild>
                    <a href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                      Login
                    </a>
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Clock strip (optional) ──────────────────────────────────────────── */}
      {clockStripEnabled && clocks.length > 0 && (
        <div className="border-b border-border bg-muted/50">
          <ClockStrip clocks={clocks} alignment={clockStripAlignment} clockDisplayConfig={clockDisplayConfig} />
        </div>
      )}

      {/* ── Breadcrumbs ─────────────────────────────────────────────────────── */}
      <Breadcrumbs />

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className={`flex-1 overflow-y-auto${fullBleed ? '' : ' p-4'}`} role="main">
        {children}
      </main>

      {/* ── Footer (optional) ──────────────────────────────────────────────── */}
      {footerText && (
        <footer
          className="shrink-0 border-t border-border bg-background px-4 py-2 text-center text-xs text-muted-foreground"
          role="contentinfo"
          data-testid="shell-footer"
        >
          <span>{footerText}</span>
          <span className="mx-2">·</span>
          <Link to="/settings?tab=about" className="hover:text-foreground transition-colors">
            v{APP_VERSION}
          </Link>
          {repoUrl && (
            <>
              <span className="mx-2">·</span>
              <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Repository
              </a>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
