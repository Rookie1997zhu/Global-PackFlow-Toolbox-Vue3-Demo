"""HTTP client for engine-ts container packer."""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from django.conf import settings


def call_pack_container(payload: dict, timeout: float = 60.0) -> dict:
    base = getattr(settings, "ENGINE_TS_URL", "http://engine_ts:3100").rstrip("/")
    url = f"{base}/v1/pack/container"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"ok": False, "message": raw or str(exc)}
        raise RuntimeError(body.get("message") or f"engine HTTP {exc.code}") from exc
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"engine unreachable: {exc}") from exc
    if not body.get("ok"):
        raise RuntimeError(body.get("message") or "engine failed")
    return body
