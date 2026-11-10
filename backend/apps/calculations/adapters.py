"""Convert scheme cargo (cm/kg) to engine-ts input (mm/kg)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

CONTAINER_PRESETS_MM = {
    "20GP": {"length": 5890, "width": 2350, "height": 2390, "maxPayload": 28000},
    "40GP": {"length": 12030, "width": 2350, "height": 2390, "maxPayload": 26500},
    "40HQ": {"length": 12030, "width": 2350, "height": 2690, "maxPayload": 26500},
    "custom": {"length": 12000, "width": 2350, "height": 2690, "maxPayload": 26000},
}


def cargo_to_skus(cargo: list[dict], *, allow_rotate: bool = True, sku_overrides: dict | None = None) -> list[dict]:
    overrides = sku_overrides or {}
    skus: list[dict] = []
    for i, row in enumerate(cargo or []):
        sku = str(row.get("sku") or f"SKU-{i + 1}")
        ov = overrides.get(sku) or {}
        if "allowRotate" in row and row.get("allowRotate") is not None:
            rotate = bool(row.get("allowRotate"))
        elif "allowRotate" in ov:
            rotate = bool(ov.get("allowRotate"))
        else:
            rotate = bool(allow_rotate)
        if "stackable" in row and row.get("stackable") is not None:
            stackable = bool(row.get("stackable"))
        elif "stackable" in ov:
            stackable = bool(ov.get("stackable"))
        else:
            stackable = True
        skus.append(
            {
                "id": sku,
                "name": sku,
                "length": float(row.get("length") or 0) * 10,  # cm -> mm
                "width": float(row.get("width") or 0) * 10,
                "height": float(row.get("height") or 0) * 10,
                "weight": float(row.get("weight") or 0),
                "qty": int(float(row.get("qty") or 0)),
                "allowRotate": rotate,
                "stackable": stackable,
                "color": "",
            }
        )
    return skus


def resolve_container(params: dict) -> dict:
    preset = str(params.get("containerPreset") or "40HQ")
    if preset == "custom" and params.get("custom"):
        c = params["custom"]
        return {
            "length": float(c.get("lengthMm") or c.get("length") or 12000),
            "width": float(c.get("widthMm") or c.get("width") or 2350),
            "height": float(c.get("heightMm") or c.get("height") or 2690),
            "maxPayload": float(c.get("maxPayload") or 26000),
            "presetId": "custom",
        }
    base = dict(CONTAINER_PRESETS_MM.get(preset) or CONTAINER_PRESETS_MM["40HQ"])
    base["presetId"] = preset if preset in CONTAINER_PRESETS_MM else "40HQ"
    return base


def _sku_overrides(params: dict) -> dict[str, dict]:
    raw = params.get("skus") or []
    out: dict[str, dict] = {}
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("id") or item.get("sku") or "")
        if not sid:
            continue
        out[sid] = item
    return out


def build_engine_payload(cargo: list[dict], params: dict) -> dict:
    allow = params.get("allowRotate", True)
    overrides = _sku_overrides(params)
    return {
        "container": resolve_container(params),
        "skus": cargo_to_skus(cargo, allow_rotate=bool(allow), sku_overrides=overrides),
        "params": {
            "containerPreset": params.get("containerPreset") or "40HQ",
            "allowRotate": bool(allow),
            "skus": [
                {
                    "id": s["id"],
                    "allowRotate": s["allowRotate"],
                    "stackable": s["stackable"],
                }
                for s in cargo_to_skus(cargo, allow_rotate=bool(allow), sku_overrides=overrides)
            ],
        },
    }


def input_hash(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def normalize_params(raw: dict | None) -> dict[str, Any]:
    raw = raw or {}
    skus = raw.get("skus") if isinstance(raw.get("skus"), list) else None
    return {
        "containerPreset": str(raw.get("containerPreset") or "40HQ"),
        "allowRotate": bool(raw.get("allowRotate", True)),
        "custom": raw.get("custom") or None,
        "skus": skus,
    }
