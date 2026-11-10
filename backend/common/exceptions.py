"""Unified API error envelope for PackFlow (ok/code/message/requestId)."""

from __future__ import annotations

import uuid
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = None
    if request is not None:
        request_id = getattr(request, "request_id", None) or request.headers.get(
            "X-Request-Id"
        )
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:12]}"

    if response is None:
        return Response(
            {
                "ok": False,
                "code": "INTERNAL_ERROR",
                "message": "Unexpected server error",
                "requestId": request_id,
                "errors": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    code = "API_ERROR"
    message = "Request failed"
    errors: Any = {}

    if isinstance(detail, dict):
        if "detail" in detail and len(detail) == 1:
            message = str(detail["detail"])
            code = _status_to_code(response.status_code)
        else:
            errors = detail
            message = "Validation failed"
            code = "VALIDATION_ERROR"
    elif isinstance(detail, list):
        errors = {"non_field_errors": [str(item) for item in detail]}
        code = "VALIDATION_ERROR"
        message = "Validation failed"
    else:
        message = str(detail)
        code = _status_to_code(response.status_code)

    response.data = {
        "ok": False,
        "code": code,
        "message": message,
        "requestId": request_id,
        "errors": errors,
    }
    return response


def _status_to_code(http_status: int) -> str:
    mapping = {
        status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
        status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
        status.HTTP_403_FORBIDDEN: "FORBIDDEN",
        status.HTTP_404_NOT_FOUND: "NOT_FOUND",
        status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
        status.HTTP_409_CONFLICT: "CONFLICT",
        status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
    }
    return mapping.get(http_status, "API_ERROR")
