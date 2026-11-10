#!/bin/sh
# Backup Postgres + media_data for PackFlow Compose stack.
# Usage (from repo root, Linux/macOS/Git-Bash with Docker CLI):
#   sh deploy/scripts/backup.sh [outdir]
# On Windows PowerShell, prefer:
#   docker compose -f deploy/compose.yml --env-file .env exec -T postgres ...
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$OUT/packflow-$STAMP"

mkdir -p "$DEST"

echo "Dumping postgres..."
docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DEST/postgres.dump"

echo "Archiving media volume..."
docker compose -f "$ROOT/deploy/compose.yml" --env-file "$ROOT/.env" \
  exec -T api sh -c 'cd /data/media && tar cf - .' > "$DEST/media.tar" || true

echo "Wrote backup to $DEST"
ls -la "$DEST"
