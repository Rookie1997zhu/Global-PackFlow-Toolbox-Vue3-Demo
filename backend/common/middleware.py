"""Request ID middleware for PackFlow APIs."""

from __future__ import annotations

import json
import uuid

from django.utils.deprecation import MiddlewareMixin


class RequestIdMiddleware(MiddlewareMixin):
    def process_request(self, request):
        rid = request.META.get("HTTP_X_REQUEST_ID") or request.headers.get("X-Request-Id")
        if not rid or not str(rid).strip():
            rid = f"req_{uuid.uuid4().hex[:12]}"
        request.request_id = str(rid).strip()[:64]

    def process_response(self, request, response):
        rid = getattr(request, "request_id", None)
        if not rid:
            return response
        response["X-Request-Id"] = rid
        ctype = response.get("Content-Type", "")
        if "application/json" not in ctype:
            return response
        try:
            payload = json.loads(response.content.decode("utf-8"))
        except Exception:
            return response
        if not isinstance(payload, dict) or "ok" not in payload:
            return response
        if payload.get("requestId"):
            return response
        payload["requestId"] = rid
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        response.content = raw
        response["Content-Length"] = str(len(raw))
        return response
