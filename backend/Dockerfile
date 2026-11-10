FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN sed -i 's/\r$//' /app/entrypoint.sh /app/worker-entrypoint.sh \
    && chmod +x /app/entrypoint.sh /app/worker-entrypoint.sh \
    && adduser --disabled-password --gecos "" appuser \
    && mkdir -p /data/media \
    && chown -R appuser:appuser /app /data/media

# Entrypoint runs as root to chown the media volume, then drops to appuser.
USER root

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
