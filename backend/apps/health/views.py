"""Liveness and readiness probes."""

from __future__ import annotations

from django.db import connection
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


def _ping_database() -> None:
    connection.ensure_connection()
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()


class LiveView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request: Request) -> Response:
        return Response(
            {"ok": True, "data": {"status": "live"}},
            status=status.HTTP_200_OK,
        )


class ReadyView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request: Request) -> Response:
        try:
            _ping_database()
        except Exception:
            # Recover from stale sockets after a database restart.
            try:
                connection.close()
                _ping_database()
            except Exception:
                return Response(
                    {
                        "ok": False,
                        "code": "DB_UNAVAILABLE",
                        "message": "Database is not ready",
                        "requestId": getattr(request, "request_id", None) or "health",
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        return Response(
            {"ok": True, "data": {"status": "ready", "database": "ok"}},
            status=status.HTTP_200_OK,
        )
