"""Piece / carton conservation for shipment revision payloads."""

from __future__ import annotations

from typing import Any


def _n(v: Any) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if n >= 0 else 0.0


def pieces_from_batch(batch: dict) -> int:
    per = int(_n(batch.get("piecesPerCarton")))
    count = int(_n(batch.get("cartonCount")))
    if per <= 0 or count <= 0:
        return 0
    last = batch.get("lastCartonQty")
    if last is None:
        return per * count
    last_i = int(_n(last))
    if last_i <= 0:
        return 0
    if last_i == per:
        return per * count
    if count == 1:
        return last_i
    return per * (count - 1) + last_i


def expected_carton_count(piece_qty: int, pieces_per_carton: int) -> tuple[int, int]:
    """Return (carton_count, last_carton_qty) for pieceQty / piecesPerCarton."""
    if pieces_per_carton <= 0 or piece_qty <= 0:
        return 0, 0
    full = piece_qty // pieces_per_carton
    rem = piece_qty % pieces_per_carton
    if rem == 0:
        return full, pieces_per_carton
    return full + 1, rem


def validate_piece_carton_conservation(payload: dict) -> list[dict]:
    """Return list of issue dicts; empty means OK.

    Rules:
    - productLines.pieceQty must equal sum of carton batch pieces for same sku
    - netKg may be null (never fabricated)
    - 120 PCS / 12 PCS/CTN ⇒ 10 CTN
    """
    issues: list[dict] = []
    lines = payload.get("productLines") or []
    batches = payload.get("cartonBatches") or []
    if not isinstance(lines, list) or not isinstance(batches, list):
        return [{"code": "PAYLOAD_SHAPE", "message": "productLines/cartonBatches must be arrays"}]

    by_sku_pieces: dict[str, int] = {}
    for i, line in enumerate(lines):
        if not isinstance(line, dict):
            issues.append({"code": "LINE_SHAPE", "index": i, "message": "product line must be object"})
            continue
        sku = str(line.get("sku") or "").strip() or f"__line_{i}"
        piece_qty = int(_n(line.get("pieceQty")))
        if piece_qty <= 0:
            issues.append(
                {
                    "code": "PIECE_QTY_REQUIRED",
                    "sku": sku,
                    "index": i,
                    "message": "pieceQty must be > 0",
                }
            )
            continue
        by_sku_pieces[sku] = by_sku_pieces.get(sku, 0) + piece_qty

    by_sku_cartons: dict[str, int] = {}
    for i, batch in enumerate(batches):
        if not isinstance(batch, dict):
            issues.append({"code": "BATCH_SHAPE", "index": i, "message": "carton batch must be object"})
            continue
        sku = str(batch.get("sku") or "").strip() or f"__batch_{i}"
        per = int(_n(batch.get("piecesPerCarton")))
        count = int(_n(batch.get("cartonCount")))
        if per <= 0 or count <= 0:
            issues.append(
                {
                    "code": "CARTON_SPEC_REQUIRED",
                    "sku": sku,
                    "index": i,
                    "message": "piecesPerCarton and cartonCount must be > 0",
                }
            )
            continue
        # Reject fabricated net weight markers
        if "netKgFabricated" in batch or batch.get("_fabricatedNet") is True:
            issues.append(
                {
                    "code": "NET_KG_FABRICATED",
                    "sku": sku,
                    "index": i,
                    "message": "netKg must not be fabricated",
                }
            )
        pcs = pieces_from_batch(batch)
        by_sku_cartons[sku] = by_sku_cartons.get(sku, 0) + pcs

        # Optional self-check vs expected carton math when lastCartonQty present
        last = batch.get("lastCartonQty")
        if last is not None:
            expected_count, expected_last = expected_carton_count(pcs, per)
            if count != expected_count or int(_n(last)) != expected_last:
                issues.append(
                    {
                        "code": "CARTON_MATH_MISMATCH",
                        "sku": sku,
                        "index": i,
                        "message": (
                            f"cartonCount/lastCartonQty inconsistent with "
                            f"{pcs} pcs @ {per}/ctn (expected {expected_count}/{expected_last})"
                        ),
                    }
                )

    all_skus = set(by_sku_pieces) | set(by_sku_cartons)
    for sku in sorted(all_skus):
        lp = by_sku_pieces.get(sku, 0)
        cp = by_sku_cartons.get(sku, 0)
        if lp == 0 and cp == 0:
            continue
        if lp != cp:
            issues.append(
                {
                    "code": "PIECE_CARTON_MISMATCH",
                    "sku": sku,
                    "pieceQty": lp,
                    "cartonPieces": cp,
                    "message": f"pieceQty {lp} != carton content {cp} for sku {sku}",
                }
            )
    return issues


def build_confirmed_packing_lines(payload: dict) -> list[dict]:
    lines: list[dict] = []
    next_carton = 1
    for batch in payload.get("cartonBatches") or []:
        if not isinstance(batch, dict):
            continue
        sku = str(batch.get("sku") or "")
        per = int(_n(batch.get("piecesPerCarton")))
        count = int(_n(batch.get("cartonCount")))
        if per <= 0 or count <= 0:
            continue
        last = batch.get("lastCartonQty")
        last_i = int(_n(last)) if last is not None else per
        net = batch.get("netKg")
        gw = float(_n(batch.get("grossKg")))
        dims = {
            "lengthCm": float(_n(batch.get("lengthCm") or batch.get("length"))),
            "widthCm": float(_n(batch.get("widthCm") or batch.get("width"))),
            "heightCm": float(_n(batch.get("heightCm") or batch.get("height"))),
        }
        if last is None or last_i == per:
            from_ctn = next_carton
            to_ctn = next_carton + count - 1
            next_carton = to_ctn + 1
            lines.append(
                {
                    "sku": sku,
                    "cartonFrom": from_ctn,
                    "cartonTo": to_ctn,
                    "qtyPerCarton": per,
                    "lastCartonQty": per,
                    "grossKg": gw,
                    "netKg": None if net is None else float(net),
                    **dims,
                }
            )
        else:
            full = count - 1
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
                        "grossKg": gw,
                        "netKg": None if net is None else float(net),
                        **dims,
                    }
                )
            from_ctn = next_carton
            to_ctn = next_carton
            next_carton = to_ctn + 1
            lines.append(
                {
                    "sku": sku,
                    "cartonFrom": from_ctn,
                    "cartonTo": to_ctn,
                    "qtyPerCarton": last_i,
                    "lastCartonQty": last_i,
                    "grossKg": gw,
                    "netKg": None if net is None else float(net),
                    **dims,
                }
            )
    return lines


def build_confirmed_invoice_lines(payload: dict) -> list[dict]:
    lines: list[dict] = []
    for row in payload.get("productLines") or []:
        if not isinstance(row, dict):
            continue
        sku = str(row.get("sku") or "")
        lines.append(
            {
                "sku": sku,
                "description": str(row.get("description") or row.get("name") or sku),
                "qty": float(_n(row.get("pieceQty"))),
                "unitPrice": float(_n(row.get("unitPrice"))),
                "unit": str(row.get("unit") or "PCS"),
            }
        )
    return lines
