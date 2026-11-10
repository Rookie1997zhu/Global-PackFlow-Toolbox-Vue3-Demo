"""Success envelope helpers."""

from __future__ import annotations

from typing import Any

from rest_framework.response import Response


def ok(data: Any = None, status: int = 200) -> Response:
    return Response({"ok": True, "data": data}, status=status)
