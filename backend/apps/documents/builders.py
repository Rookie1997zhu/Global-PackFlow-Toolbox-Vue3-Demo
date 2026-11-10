"""Build packing / invoice payloads from scheme cargo (no demo dimension fills)."""

from __future__ import annotations

from typing import Any


def _n(v: Any) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if n >= 0 else 0.0


def _optional_net(c: dict) -> float | None:
    if "netKg" not in c or c.get("netKg") is None:
        return None
    return round(_n(c.get("netKg")), 3)


def cargo_needs_review(cargo: list[dict]) -> bool:
    for c in cargo or []:
        has_piece = _n(c.get("pieceQty")) > 0 and _n(c.get("piecesPerCarton")) > 0
        basis = str(c.get("quantityBasis") or "")
        if has_piece:
            if _optional_net(c) is None:
                return True
            continue
        if basis in {"piece", "carton"}:
            if _optional_net(c) is None:
                return True
            continue
        return True
    return False


def packing_from_cargo(cargo: list[dict]) -> list[dict]:
    lines: list[dict] = []
    next_carton = 1
    for i, c in enumerate(cargo or []):
        sku = str(c.get("sku") or f"SKU-{i + 1}")
        unit_gw = _n(c.get("weight"))
        net = _optional_net(c)
        piece_qty = int(_n(c.get("pieceQty")))
        per = int(_n(c.get("piecesPerCarton")))
        basis = str(c.get("quantityBasis") or "")

        if piece_qty > 0 and per > 0:
            full = piece_qty // per
            rem = piece_qty % per
            if rem == 0 and full > 0:
                from_ctn = next_carton
                to_ctn = next_carton + full - 1
                next_carton = to_ctn + 1
                lines.append(
                    {
                        "sku": sku,
                        "cartonFrom": from_ctn,
                        "cartonTo": to_ctn,
                        "qtyPerCarton": per,
                        "lastCartonQty": per,
                        "grossKg": unit_gw,
                        "netKg": net,
                        "lengthCm": _n(c.get("length")),
                        "widthCm": _n(c.get("width")),
                        "heightCm": _n(c.get("height")),
                        "needsReview": net is None,
                    }
                )
            else:
                if full > 0:
                    from_ctn = next_carton
                    to_ctn = next_carton + full - 1
                    next_carton = to_ctn + 1
                    lines.append(
                        {
                            "sku": sku,
                            "cartonFrom": from_ctn,
                            "cartonTo": to_ctn,
                            "qtyPerCarton": per,
                            "grossKg": unit_gw,
                            "netKg": net,
                            "lengthCm": _n(c.get("length")),
                            "widthCm": _n(c.get("width")),
                            "heightCm": _n(c.get("height")),
                            "needsReview": net is None,
                        }
                    )
                if rem > 0:
                    from_ctn = next_carton
                    to_ctn = next_carton
                    next_carton = to_ctn + 1
                    lines.append(
                        {
                            "sku": sku,
                            "cartonFrom": from_ctn,
                            "cartonTo": to_ctn,
                            "qtyPerCarton": rem,
                            "lastCartonQty": rem,
                            "grossKg": unit_gw,
                            "netKg": net,
                            "lengthCm": _n(c.get("length")),
                            "widthCm": _n(c.get("width")),
                            "heightCm": _n(c.get("height")),
                            "needsReview": net is None,
                        }
                    )
            continue

        if basis == "carton":
            qty = max(1, int(_n(c.get("qty"))))
            from_ctn = next_carton
            to_ctn = next_carton + qty - 1
            next_carton = to_ctn + 1
            lines.append(
                {
                    "sku": sku,
                    "cartonFrom": from_ctn,
                    "cartonTo": to_ctn,
                    "qtyPerCarton": 1,
                    "grossKg": unit_gw,
                    "netKg": net,
                    "lengthCm": _n(c.get("length")),
                    "widthCm": _n(c.get("width")),
                    "heightCm": _n(c.get("height")),
                    "needsReview": net is None,
                }
            )
            continue

        # Bare qty / unknown — do not invent CTN×1 or GW×0.92
        lines.append(
            {
                "sku": sku,
                "cartonFrom": 1,
                "cartonTo": 1,
                "qtyPerCarton": 0,
                "grossKg": unit_gw,
                "netKg": net,
                "lengthCm": _n(c.get("length")),
                "widthCm": _n(c.get("width")),
                "heightCm": _n(c.get("height")),
                "needsReview": True,
                "legacyQuantityBasis": "unknown",
            }
        )
    return lines


def packing_totals(lines: list[dict]) -> dict:
    totals = {"cartonCount": 0, "totalQty": 0, "grossKg": 0.0, "netKg": 0.0, "cbm": 0.0}
    for line in lines:
        cartons = max(0, int(line["cartonTo"]) - int(line["cartonFrom"]) + 1)
        if int(line.get("qtyPerCarton") or 0) <= 0 and line.get("needsReview"):
            # Placeholder review row — do not inflate carton counts
            cartons = 0
        totals["cartonCount"] += cartons
        totals["totalQty"] += cartons * int(line.get("qtyPerCarton") or 0)
        totals["grossKg"] += float(line.get("grossKg") or 0) * max(cartons, 0)
        if line.get("netKg") is not None:
            totals["netKg"] += float(line["netKg"]) * max(cartons, 0)
        totals["cbm"] += (
            (float(line.get("lengthCm") or 0)
             * float(line.get("widthCm") or 0)
             * float(line.get("heightCm") or 0)
             / 1e6)
            * max(cartons, 0)
        )
    return totals


def invoice_from_cargo(cargo: list[dict]) -> list[dict]:
    lines: list[dict] = []
    for c in cargo or []:
        piece_qty = _n(c.get("pieceQty"))
        qty = piece_qty if piece_qty > 0 else _n(c.get("qty"))
        lines.append(
            {
                "sku": str(c.get("sku") or ""),
                "description": str(c.get("sku") or ""),
                "qty": qty,
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
