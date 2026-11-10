#!/bin/sh
set -eu

MEDIA_ROOT="${MEDIA_ROOT:-/data/media}"
mkdir -p "$MEDIA_ROOT"
if id appuser >/dev/null 2>&1; then
  chown -R appuser:appuser "$MEDIA_ROOT" || true
fi

python /app/wait_for_db.py

if id appuser >/dev/null 2>&1; then
  exec su -s /bin/sh appuser -c "exec celery -A config worker -l info --concurrency=${CELERY_CONCURRENCY:-1}"
fi
exec celery -A config worker -l info --concurrency="${CELERY_CONCURRENCY:-1}"
