# Operations Guide

This document covers operational procedures for HomeDash administrators.

---

## Revoking Public Widget Access

Public integration widgets are explicitly exposed per widget and are
read-only. To revoke access, enter dashboard edit mode, open the widget
settings, set **Public dashboard visibility** to **Hidden**, and save the
layout. The public snapshot cache is invalidated immediately, and the widget is
removed from the next anonymous bootstrap response.

Changing or clearing the public web/mobile dashboard in **Settings** also
invalidates public snapshots. Docker and unsupported widget types cannot be
made public.

---

## Break-Glass: Admin Password Reset

If you lose access to the admin account, use the `reset-admin` script to reset
credentials **without wiping the database**. Dashboards, widgets, and all other
data remain intact.

### Prerequisites

- Node.js 20+
- The project dependencies installed (`pnpm install`)
- The backend server should be **stopped** before running the script (to avoid
  SQLite locking issues)

### Usage

```bash
cd backend

# Interactive — prompts for username and password:
npx tsx scripts/reset-admin.ts

# Non-interactive — pass credentials as flags:
npx tsx scripts/reset-admin.ts --username admin --password "your-new-password"
```

### What It Does

1. Finds the first admin user in the database
2. Updates their username and password hash (argon2id)
3. **Invalidates all existing sessions** for that user — any open browser
   sessions will be logged out
4. If no users exist at all (empty database), creates a new admin user
   (equivalent to the first-run setup)

### Constraints

| Rule | Detail |
|------|--------|
| Username | Minimum 2 characters |
| Password | Minimum 8 characters |

### After Resetting

1. Restart the server (`pnpm dev` or restart Docker container)
2. Log in at `http://<your-host>:<port>` with the new credentials
3. You will be presented with the login screen (not first-run, since the user
   already exists)

### Full Database Reset

If you need to start completely fresh (lose all data):

```bash
# Delete the SQLite database file
rm backend/data/db/homedash.sqlite

# Restart the server — migrations run automatically
pnpm dev
```

You will see the first-run setup screen to create a new admin account.

---

## Portable Backup Restore

The **Download Backup** action creates a portable JSON backup containing dashboards,
widgets, users, groups, integrations, and settings. It intentionally excludes password
hashes, OAuth tokens, integration client secrets, Pi-hole and UniFi credentials,
CalDAV passwords, sessions, and uploaded asset files.

To restore into a fresh installation:

1. Complete first-run setup with the administrator username and password you want to
   keep using.
2. Open **Settings → Backup & Restore** and choose **Restore from Backup**.
3. Review the backup summary, type `RESTORE`, and confirm.
4. Sign in again with the same administrator username and password used before the
   restore.

The restoring administrator's credentials are preserved and assigned to the restored
administrator account. Other restored users cannot sign in until an administrator
resets their passwords. OAuth and CalDAV integrations must be re-authenticated, and
Pi-hole, UniFi, Spotify, or Sonos credentials may need to be re-entered.
References to uploaded assets are preserved only when those asset records already exist
on the target installation; otherwise unavailable logos, backgrounds, and shortcut
icons are cleared.

Use **Download Full Backup** instead when you need a byte-for-byte SQLite disaster
recovery copy that includes credentials and secrets.

---

## Environment Variables

See [quickstart.md](../specs/001-homelab-dashboard/quickstart.md) for the full
list of environment variables including session secrets, OAuth provider
credentials, and server configuration.
