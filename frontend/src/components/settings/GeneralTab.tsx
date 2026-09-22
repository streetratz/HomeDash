/**
 * General settings tab — User preferences (theme, dashboard prefs),
 * profile update (display name), and password change.
 * Visible to all authenticated users.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { ThemeToggle } from '../ThemeToggle.js';
import { Label } from '../ui/label.js';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import {
  useUserPreferences,
  useUpdateUserPreferences,
  useUpdateProfile,
  useChangePassword,
} from '../../state/settings.js';
import type { ThemeMode } from '../../state/settings.js';
import { useAdminDashboards } from '../../state/adminDashboards.js';
import type { AuthUser } from '../../state/bootstrap.js';
import { FieldRow } from './FieldRow.js';
import { ApiRequestError } from '../../lib/apiClient.js';
import { ChevronDown } from 'lucide-react';
import { SettingsErrorState, SettingsLoadingState } from './SettingsDataState.js';

interface GeneralTabProps {
  user: AuthUser | null;
  currentTheme: ThemeMode;
  onThemeToggle: (mode: ThemeMode) => void;
}

export function GeneralTab({ user, currentTheme, onThemeToggle }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Account — profile, theme, password */}
      <AccountSection user={user} currentTheme={currentTheme} onThemeToggle={onThemeToggle} />

      {/* Dashboard Preferences */}
      <UserDashboardPrefsSection />
    </div>
  );
}

// ── Account Section ───────────────────────────────────────────────────────────

function AccountSection({ user, currentTheme, onThemeToggle }: GeneralTabProps) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const updateProfile = useUpdateProfile();
  const [showPassword, setShowPassword] = useState(false);

  const handleSaveProfile = () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error('Display name cannot be empty.');
      return;
    }
    if (trimmed.length > 100) {
      toast.error('Display name cannot exceed 100 characters.');
      return;
    }
    updateProfile.mutate(
      { displayName: trimmed },
      {
        onSuccess: () => toast.success('Profile updated'),
        onError: () => toast.error('Failed to update profile'),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Display Name */}
        {user && (
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                placeholder="Your display name"
                className="flex-1"
              />
              <Button
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending || displayName.trim() === user.displayName}
                size="sm"
              >
                {updateProfile.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}

        {/* Theme */}
        <div className="flex items-center justify-between">
          <Label>Theme</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm capitalize text-muted-foreground">{currentTheme}</span>
            <ThemeToggle
              mode={currentTheme}
              user={user}
              onToggle={onThemeToggle}
            />
          </div>
        </div>

        {/* Password — collapsible */}
        <div className="border-t pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            Change Password
            <ChevronDown className={`h-4 w-4 transition-transform ${showPassword ? 'rotate-180' : ''}`} />
          </button>
          {showPassword && <PasswordFields />}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Password Fields (shown on disclosure) ─────────────────────────────────────

function PasswordFields() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const changePassword = useChangePassword();

  const handleSubmit = () => {
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed successfully');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setError(null);
        },
        onError: (err) => {
          if (err instanceof ApiRequestError && err.status === 401) {
            setError('Current password is incorrect.');
          } else {
            setError('Failed to change password.');
          }
        },
      },
    );
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Min. 8 characters"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleSubmit}
        disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
        size="sm"
      >
        {changePassword.isPending ? 'Changing…' : 'Change Password'}
      </Button>
    </div>
  );
}

// ── User Dashboard Preferences ────────────────────────────────────────────────

function UserDashboardPrefsSection() {
  const prefsQuery = useUserPreferences({ enabled: true });
  const updatePrefs = useUpdateUserPreferences();
  const dashboardsQuery = useAdminDashboards(true);

  const dashboards = dashboardsQuery.data ?? [];
  const webDashboardId = prefsQuery.data?.webDashboardId ?? null;
  const mobileDashboardId = prefsQuery.data?.mobileDashboardId ?? null;

  if (prefsQuery.isLoading || dashboardsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <SettingsLoadingState label="Loading dashboard preferences…" />
        </CardContent>
      </Card>
    );
  }

  if (prefsQuery.isError || dashboardsQuery.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <SettingsErrorState
            message="Dashboard preferences could not be loaded."
            onRetry={() => {
              void prefsQuery.refetch();
              void dashboardsQuery.refetch();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  function handleChange(field: 'webDashboardId' | 'mobileDashboardId', value: string) {
    const resolved = value === '__none__' ? null : value;
    updatePrefs.mutate(
      { [field]: resolved },
      {
        onSuccess: () => toast.success('Dashboard preference saved'),
        onError: (err: Error) => toast.error(`Failed to save: ${err.message}`),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dashboard Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldRow label="Web Dashboard">
          <Select
            value={webDashboardId ?? '__none__'}
            onValueChange={(v) => handleChange('webDashboardId', v)}
            disabled={updatePrefs.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="None (use default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (use default)</SelectItem>
              {dashboards.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Mobile Dashboard">
          <Select
            value={mobileDashboardId ?? '__none__'}
            onValueChange={(v) => handleChange('mobileDashboardId', v)}
            disabled={updatePrefs.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="None (use default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (use default)</SelectItem>
              {dashboards.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </CardContent>
    </Card>
  );
}