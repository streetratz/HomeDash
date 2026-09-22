/**
 * T074 (US2): Authenticated user menu component.
 *
 * Uses shadcn/ui DropdownMenu (Radix-based) for accessible keyboard navigation,
 * focus management, and outside-click handling.
 */

import { Link } from 'react-router-dom';
import { Settings, LogOut, ChevronDown, LayoutDashboard, Users, Info } from 'lucide-react';
import { Button } from './ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';
import type { AuthUser } from '../state/bootstrap.js';

interface UserMenuProps {
  user: AuthUser;
  onLogout: () => void;
}

/** Return the user's initials (up to 2 chars) for the avatar circle. */
function initials(displayName: string): string {
  return displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2"
          data-testid="user-menu-trigger"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initials(user.displayName)}
          </span>
          <span className="hidden text-sm text-muted-foreground sm:block" data-testid="user-display-name">
            {user.displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40" data-testid="user-menu">
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-2" data-testid="settings-link">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>

        {(user.isAdmin || user.role === 'admin') && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/admin/dashboards" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Dashboards
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/groups" className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden="true" />
                Groups
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/settings?tab=about" className="flex items-center gap-2" data-testid="about-link">
            <Info className="h-4 w-4" aria-hidden="true" />
            About
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onLogout}
          className="flex items-center gap-2"
          data-testid="logout-button"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
