"""Production settings — DEBUG off, secrets required via env."""

from .base import *  # noqa: F403

DEBUG = False

# Local Compose uses plain HTTP on :8080 — set these false via env.
# Real HTTPS deployments should leave defaults true.
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", True)  # noqa: F405
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", True)  # noqa: F405
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)  # noqa: F405
