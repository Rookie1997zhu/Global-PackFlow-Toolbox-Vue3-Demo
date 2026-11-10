#!/bin/sh
# Restore Postgres + media from a backup directory created by backup.sh.
# Does NOT use `docker compose down -v` (that would wipe volumes).
# Usage:
#   sh deploy/scripts/restore.sh backups/packflow-YYYYMMDDTHHMMSSZ
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "Usage: $0 <backup-dir>" >&2
  exit 1
fi
case "$SRC" in
  /*) ;;
  *) SRC="$(pwd)/$SRC" ;;
esac

echo "Stopping api and worker (keep volumes)..."
docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" stop api worker || true

echo "Restoring postgres..."
docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" start postgres
sleep 3
docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" \
  exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < "$SRC/postgres.dump" || true

if [ -f "$SRC/media.tar" ]; then
  echo "Restoring media..."
  docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" start api
  docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" \
    exec -T api sh -c 'mkdir -p /data/media && tar xf - -C /data/media' < "$SRC/media.tar"
fi

echo "Starting stack..."
docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" \
  start redis engine_ts api worker caddy \
  || docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" up -d

echo "Restore finished from $SRC"
echo "Note: Redis is not restored (broker only). Re-run failed jobs if needed."
