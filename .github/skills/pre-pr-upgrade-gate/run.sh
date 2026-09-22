#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE_REF="main"
BACKUP_PATH=""
RUN_ID="$$"
BASE_IMAGE="homedash:upgrade-base-${RUN_ID}"
CANDIDATE_IMAGE="homedash:upgrade-candidate-${RUN_ID}"
BASE_CONTAINER="homedash-upgrade-base-${RUN_ID}"
CANDIDATE_CONTAINER="homedash-upgrade-candidate-${RUN_ID}"
VOLUME_NAME="homedash-upgrade-data-${RUN_ID}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/homedash-upgrade-${RUN_ID}.XXXXXX")"
BEFORE_FILE="${WORK_DIR}/before.json"
AFTER_FILE="${WORK_DIR}/after.json"
COOKIE_FILE="${WORK_DIR}/cookies.txt"
WRAPPER_FILE="${WORK_DIR}/restore.json"
ADMIN_USERNAME="upgradegate"
ADMIN_PASSWORD="UpgradeGateOnly-046!"

usage() {
  cat <<'EOF'
Usage: run.sh [--base-ref REF] [--backup /absolute/path/to/backup.json]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-ref)
      BASE_REF="${2:?--base-ref requires a value}"
      shift 2
      ;;
    --backup)
      BACKUP_PATH="${2:?--backup requires a value}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -n "$BACKUP_PATH" ]]; then
  BACKUP_PATH="$(cd "$(dirname "$BACKUP_PATH")" && pwd)/$(basename "$BACKUP_PATH")"
  [[ -f "$BACKUP_PATH" ]] || {
    echo "Backup file not found: $BACKUP_PATH" >&2
    exit 2
  }
  jq -e '.format == "homedash-backup"' "$BACKUP_PATH" >/dev/null
fi

cleanup() {
  docker rm -f "$BASE_CONTAINER" "$CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME_NAME" >/dev/null 2>&1 || true
  docker image rm "$BASE_IMAGE" "$CANDIDATE_IMAGE" >/dev/null 2>&1 || true
  rm -f "$BEFORE_FILE" "$AFTER_FILE" "$COOKIE_FILE" "$WRAPPER_FILE"
  rmdir "$WORK_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for command in docker git curl jq; do
  command -v "$command" >/dev/null || {
    echo "Required command is missing: $command" >&2
    exit 2
  }
done

wait_for_health() {
  local container="$1"
  local status=""
  for _ in $(seq 1 45); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      return 0
    fi
    if [[ "$status" == "unhealthy" || "$status" == "exited" ]]; then
      docker logs --tail 150 "$container" >&2 || true
      return 1
    fi
    sleep 2
  done
  docker logs --tail 150 "$container" >&2 || true
  echo "Timed out waiting for $container to become healthy" >&2
  return 1
}

container_port() {
  docker port "$1" 3000/tcp | head -1 | awk -F: '{print $NF}'
}

snapshot_database() {
  local container="$1"
  local output="$2"
  docker exec -i -w /app/backend "$container" node >"$output" <<'NODE'
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const db = new Database('/data/db/homedash.sqlite', { readonly: true });
const excluded = new Set([
  '__drizzle_migrations',
  'sessions',
  'calendar_events',
  'shortcut_ping_results',
  'icon_cache_entries',
]);
const tableNames = db
  .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")
  .all()
  .map((row) => row.name)
  .filter((name) => !excluded.has(name));
const result = {
  migrations: db.prepare('select count(*) as count from __drizzle_migrations').get().count,
  foreignKeyViolations: db.prepare('pragma foreign_key_check').all().length,
  tables: {},
};
for (const table of tableNames) {
  const columns = db.prepare(`pragma table_info("${table}")`).all().map((row) => row.name);
  const rows = db.prepare(`select * from "${table}"`).all().map((row) => {
    const normalized = { ...row };
    for (const key of Object.keys(normalized)) {
      if (/^(last_|next_)/.test(key)) delete normalized[key];
    }
    return normalized;
  });
  rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  result.tables[table] = {
    columns,
    count: rows.length,
    sha256: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
  };
}
console.log(JSON.stringify(result, null, 2));
db.close();
NODE
}

snapshot_candidate_against_baseline() {
  local container="$1"
  local baseline="$2"
  local output="$3"
  docker cp "$baseline" "${container}:/tmp/homedash-upgrade-before.json"
  docker exec -i -w /app/backend "$container" node >"$output" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const before = JSON.parse(fs.readFileSync('/tmp/homedash-upgrade-before.json', 'utf8'));
const db = new Database('/data/db/homedash.sqlite', { readonly: true });
const result = {
  migrations: db.prepare('select count(*) as count from __drizzle_migrations').get().count,
  foreignKeyViolations: db.prepare('pragma foreign_key_check').all().length,
  tables: {},
};
for (const [table, baseline] of Object.entries(before.tables)) {
  const currentColumns = new Set(
    db.prepare(`pragma table_info("${table}")`).all().map((row) => row.name),
  );
  const missingColumns = baseline.columns.filter((column) => !currentColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`${table} lost baseline columns: ${missingColumns.join(', ')}`);
  }
  const selectedColumns = baseline.columns.map((column) => `"${column}"`).join(', ');
  const rows = db.prepare(`select ${selectedColumns} from "${table}"`).all().map((row) => {
    const normalized = { ...row };
    for (const key of Object.keys(normalized)) {
      if (/^(last_|next_)/.test(key)) delete normalized[key];
    }
    return normalized;
  });
  rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  result.tables[table] = {
    columns: baseline.columns,
    count: rows.length,
    sha256: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
  };
}
console.log(JSON.stringify(result, null, 2));
db.close();
NODE
}

cd "$ROOT_DIR"

echo "Building baseline image from ${BASE_REF}..."
git archive --format=tar "$BASE_REF" | docker build -q -t "$BASE_IMAGE" - >/dev/null
echo "Building candidate image from current worktree..."
docker build -q -t "$CANDIDATE_IMAGE" . >/dev/null

docker run -d --name "$BASE_CONTAINER" -p 127.0.0.1::3000 \
  -v "${VOLUME_NAME}:/data" \
  -e HOMEDASH_SESSION_SECRET=upgrade-gate-session-secret-only \
  "$BASE_IMAGE" >/dev/null
wait_for_health "$BASE_CONTAINER"
BASE_PORT="$(container_port "$BASE_CONTAINER")"
BASE_URL="http://127.0.0.1:${BASE_PORT}"

setup_response="$(
  curl -fsS -c "$COOKIE_FILE" -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USERNAME}\",\"displayName\":\"Upgrade Gate Admin\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    "${BASE_URL}/api/first-run/admin"
)"
csrf_token="$(printf '%s' "$setup_response" | jq -er '.csrfToken')"

if [[ -n "$BACKUP_PATH" ]]; then
  jq '{backup: ., confirmationWord: "RESTORE"}' "$BACKUP_PATH" >"$WRAPPER_FILE"
  curl -fsS -b "$COOKIE_FILE" -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: ${csrf_token}" \
    --data-binary "@${WRAPPER_FILE}" \
    "${BASE_URL}/api/admin/backup/restore" >/dev/null
fi

snapshot_database "$BASE_CONTAINER" "$BEFORE_FILE"
docker stop "$BASE_CONTAINER" >/dev/null
docker rm "$BASE_CONTAINER" >/dev/null

docker run -d --name "$CANDIDATE_CONTAINER" -p 127.0.0.1::3000 \
  -v "${VOLUME_NAME}:/data" \
  -e HOMEDASH_SESSION_SECRET=upgrade-gate-session-secret-only \
  "$CANDIDATE_IMAGE" >/dev/null
wait_for_health "$CANDIDATE_CONTAINER"
CANDIDATE_PORT="$(container_port "$CANDIDATE_CONTAINER")"
CANDIDATE_URL="http://127.0.0.1:${CANDIDATE_PORT}"
snapshot_candidate_against_baseline "$CANDIDATE_CONTAINER" "$BEFORE_FILE" "$AFTER_FILE"

jq -e '.foreignKeyViolations == 0' "$AFTER_FILE" >/dev/null
jq -e --slurpfile before "$BEFORE_FILE" '.migrations >= $before[0].migrations' "$AFTER_FILE" >/dev/null
jq -e --slurpfile before "$BEFORE_FILE" '.tables == $before[0].tables' "$AFTER_FILE" >/dev/null

curl -fsS -H 'Content-Type: application/json' \
  -d "{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\",\"rememberMe\":false}" \
  "${CANDIDATE_URL}/api/auth/login" >/dev/null

before_migrations="$(jq -r '.migrations' "$BEFORE_FILE")"
after_migrations="$(jq -r '.migrations' "$AFTER_FILE")"
table_count="$(jq -r '.tables | length' "$BEFORE_FILE")"
echo "Upgrade gate passed: migrations ${before_migrations} -> ${after_migrations}; ${table_count} tables preserved; 0 FK violations."
