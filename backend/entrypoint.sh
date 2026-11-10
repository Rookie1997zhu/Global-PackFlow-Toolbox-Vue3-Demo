#!/bin/sh
set -eu

MEDIA_ROOT="${MEDIA_ROOT:-/data/media}"
mkdir -p "$MEDIA_ROOT"
if id appuser >/dev/null 2>&1; then
  chown -R appuser:appuser "$MEDIA_ROOT" || true
fi

echo "Waiting for database..."
python /app/wait_for_db.py

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting Gunicorn..."
if id appuser >/dev/null 2>&1; then
  exec su -s /bin/sh appuser -c "exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers ${GUNICORN_WORKERS:-2} \
    --timeout ${GUNICORN_TIMEOUT:-60} \
    --access-logfile - \
    --error-logfile -"
fi

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-60}" \
  --access-logfile - \
  --error-logfile -
