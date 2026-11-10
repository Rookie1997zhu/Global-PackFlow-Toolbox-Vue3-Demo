"""Build packing / invoice payloads from scheme cargo (no demo dimension fills)."""

from __future__ import annotations

from typing import Any


def _n(v: Any) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if n >= 0 else 0.0


def packing_from_cargo(cargo: list[dict]) -> list[dict]:
    lines: list[dict] = []
    next_carton = 1
    for i, c in enumerate(cargo or []):
        qty = max(1, int(_n(c.get("qty"))))
        from_ctn = next_carton
        to_ctn = next_carton + qty - 1
        next_carton = to_ctn + 1
        unit_gw = _n(c.get("weight"))
        lines.append(
            {
                "sku": str(c.get("sku") or f"SKU-{i + 1}"),
                "cartonFrom": from_ctn,
                "cartonTo": to_ctn,
                "qtyPerCarton": 1,
                "grossKg": unit_gw,
                "netKg": round(max(0.0, unit_gw * 0.92), 3),
                "lengthCm": _n(c.get("length")),
                "widthCm": _n(c.get("width")),
                "heightCm": _n(c.get("height")),
            }
        )
    return lines


def packing_totals(lines: list[dict]) -> dict:
    totals = {"cartonCount": 0, "totalQty": 0, "grossKg": 0.0, "netKg": 0.0, "cbm": 0.0}
    for line in lines:
        cartons = max(1, int(line["cartonTo"]) - int(line["cartonFrom"]) + 1)
        totals["cartonCount"] += cartons
        totals["totalQty"] += cartons * int(line["qtyPerCarton"])
        totals["grossKg"] += float(line["grossKg"]) * cartons
        totals["netKg"] += float(line["netKg"]) * cartons
        totals["cbm"] += (
            (float(line["lengthCm"]) * float(line["widthCm"]) * float(line["heightCm"]) / 1e6)
            * cartons
        )
    return totals


def invoice_from_cargo(cargo: list[dict]) -> list[dict]:
    lines: list[dict] = []
    for c in cargo or []:
        lines.append(
            {
                "sku": str(c.get("sku") or ""),
                "description": str(c.get("sku") or ""),
                "qty": _n(c.get("qty")),
                "unitPrice": _n(c.get("price")),
                "unit": "PCS",
            }
        )
    return lines


def invoice_totals(lines: list[dict]) -> dict:
    total = sum(float(l["qty"]) * float(l["unitPrice"]) for l in lines)
    return {"computedTotal": round(total, 2)}


CI_DISCLAIMER_KO = (
    "본 Commercial Invoice는 상업송장 샘플이며 관세신고서·전자세금계산서가 아닙니다. "
    "Customs declarations / 전자세금계산서 are not auto-generated."
)
CI_DISCLAIMER_EN = (
    "This Commercial Invoice is a trade document sample — not a customs declaration "
    "and not a Korean electronic tax invoice (전자세금계산서)."
)
