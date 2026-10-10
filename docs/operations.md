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

## Collection configuration, backup and recovery

Collection configuration is authoritative household data, separate from synced
provider events and birthdays. The additive collection migration creates four
initially empty tables; no preset is seeded. Later additive migrations extend
`collection_streams` with a required bundled **icon** and optional inclusive
first/last **start/end date** bounds; existing rows default to the `Trash2` icon
and `null` (unbounded) bounds, so existing stream IDs, rules, exceptions and
Calendar/provider selections are preserved. Removing a stream prunes only its
collection selections.

Preview/save is a whole-configuration transaction. A concurrent save or restore
invalidates an older revision/runtime epoch and returns a conflict; retain the
draft, reload/rebase deliberately, review destructive/timezone confirmations and
preview again. Validation blockers cause no partial writes. Failed requests
retain entered fields. For diagnostics, capture the safe error code and request
ID, not private provider labels, backup contents or credentials.

Portable **v2** backups include all four collection tables, stable IDs/order,
disabled streams, exceptions, explicit dates, per-event icon and bounds, and
widget/public selections. They store rules, not generated occurrences. Older v2
backups written before the icon/bounds columns normalise a missing icon to
`Trash2` and missing bounds to `null` on restore, while fresh values are
preserved; pre-refactor readers will not accept the extended rows. The new reader
accepts collection-free **v1**, with an explicit full-replacement warning:
restoring it removes current collection configuration. An old v1-only reader
cannot read v2. Full restore validates the complete input before deleting
anything and rolls back failed inserts. Successful restore rotates the runtime
epoch and invalidates sessions; log in again. Existing secret exclusions and
provider OAuth reauthentication requirements remain in force.

Before upgrading, retain a consistent SQLite backup and the matching prior
container image. On a disposable copy, check `PRAGMA foreign_key_check` after
migration/restart. Downgrade recovery means restoring the **pre-upgrade database**
with its matching older image, not attempting a down-migration or feeding a v2
portable file to an older reader. Never test upgrade/restore against live data.

Public collection reads expose only the selected widget's permitted names,
colours, allowlisted icon and household date context. They do not expose rules,
bounds, management state, provider labels, revisions or epochs. Revoking the public subset or designated
dashboard denies subsequent reads; active views remove a denied cached payload
on their next fetch (foreground polling is 30 seconds, resume refresh is immediate).

---

## Break-Glass: Admin Password Reset

If you lose access to the admin account, use the `reset-admin` script to reset
credentials **without wiping the database**. Dashboards, widgets, and all other
data remain intact.

### Prerequisites

- Node.js 24
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
