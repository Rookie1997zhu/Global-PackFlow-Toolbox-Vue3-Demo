"""Korean/English sheet header aliases — mirrors frontend sheetMapping.ts."""

from __future__ import annotations

import re
from typing import Any

SHEET_FIELDS = (
    "sku",
    "description",
    "po",
    "carton",
    "qty",
    "unit",
    "grossKg",
    "netKg",
    "amount",
    "unitPrice",
    "lengthCm",
    "widthCm",
    "heightCm",
    "boxCount",
)

FIELD_ALIASES: dict[str, str] = {
    "sku": "sku",
    "item": "sku",
    "part": "sku",
    "name": "sku",
    "품명": "sku",
    "상품명": "sku",
    "품목": "sku",
    "제품명": "sku",
    "description": "description",
    "desc": "description",
    "spec": "description",
    "규격": "description",
    "사양": "description",
    "po": "po",
    "ponumber": "po",
    "purchaseorder": "po",
    "발주번호": "po",
    "발주": "po",
    "carton": "carton",
    "cartonno": "carton",
    "ctn": "carton",
    "ctnno": "carton",
    "카톤번호": "carton",
    "박스번호": "carton",
    "상자번호": "carton",
    "qty": "qty",
    "quantity": "qty",
    "pcs": "qty",
    "수량": "qty",
    "수량pcs": "qty",
    "boxcount": "boxCount",
    "boxes": "boxCount",
    "cartons": "boxCount",
    "박스수": "boxCount",
    "상자수": "boxCount",
    "unit": "unit",
    "uom": "unit",
    "단위": "unit",
    "weight": "grossKg",
    "gross": "grossKg",
    "grosskg": "grossKg",
    "grossweight": "grossKg",
    "총중량": "grossKg",
    "총중": "grossKg",
    "net": "netKg",
    "netkg": "netKg",
    "netweight": "netKg",
    "순중량": "netKg",
    "순중": "netKg",
    "amount": "amount",
    "value": "amount",
    "total": "amount",
    "금액": "amount",
    "합계금액": "amount",
    "unitprice": "unitPrice",
    "price": "unitPrice",
    "단가": "unitPrice",
    "length": "lengthCm",
    "lengthcm": "lengthCm",
    "l": "lengthCm",
    "가로": "lengthCm",
    "길이": "lengthCm",
    "width": "widthCm",
    "widthcm": "widthCm",
    "w": "widthCm",
    "세로": "widthCm",
    "폭": "widthCm",
    "height": "heightCm",
    "heightcm": "heightCm",
    "h": "heightCm",
    "높이": "heightCm",
}


def normalize_header(value: str) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[\s_/]+", "", text)


def detect_column_mapping(headers: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for i, header in enumerate(headers):
        field = FIELD_ALIASES.get(normalize_header(header))
        if field and field not in mapping:
            mapping[field] = i
    return mapping


def _num(value: Any) -> float:
    if value is None:
        return 0.0
    text = str(value).strip().replace(",", "")
    if text == "":
        return 0.0
    try:
        n = float(text)
    except ValueError:
        return 0.0
    return n if n >= 0 else 0.0


def apply_mapping(table: list[list[str]], mapping: dict[str, int]) -> list[dict]:
    if len(table) < 2:
        return []
    rows: list[dict] = []
    for r in range(1, len(table)):
        cells = table[r]

        def cell(field: str) -> str:
            idx = mapping.get(field)
            if idx is None or idx >= len(cells):
                return ""
            return str(cells[idx] or "").strip()

        sku = cell("sku")
        description = cell("description") or sku
        rows.append(
            {
                "rawIndex": r,
                "sku": sku,
                "description": description,
                "po": cell("po"),
                "carton": cell("carton"),
                "qty": _num(cell("qty")),
                "unit": cell("unit"),
                "grossKg": _num(cell("grossKg")),
                "netKg": _num(cell("netKg")),
                "amount": _num(cell("amount")),
                "unitPrice": _num(cell("unitPrice")),
                "lengthCm": _num(cell("lengthCm")),
                "widthCm": _num(cell("widthCm")),
                "heightCm": _num(cell("heightCm")),
                "boxCount": _num(cell("boxCount")),
            }
        )
    return rows


def validate_mapped_rows(rows: list[dict]) -> list[dict]:
    """Return row issues. Dimension/weight gaps are blocking for cargo commit."""
    issues: list[dict] = []
    carton_seen: dict[str, int] = {}
    for row in rows:
        raw = row["rawIndex"]
        if not str(row["sku"]).strip() and not str(row["carton"]).strip():
            issues.append({"rawIndex": raw, "code": "errImportEmptyKey"})
            continue
        if not str(row["sku"]).strip():
            issues.append({"rawIndex": raw, "code": "errImportSku", "field": "sku"})
        qty = float(row["qty"] or 0)
        box_count = float(row["boxCount"] or 0)
        if qty <= 0 and box_count <= 0:
            issues.append({"rawIndex": raw, "code": "errImportQty", "field": "qty"})
        net = float(row["netKg"] or 0)
        gross = float(row["grossKg"] or 0)
        if net > 0 and gross > 0 and net > gross + 1e-9:
            issues.append({"rawIndex": raw, "code": "errImportNetGross", "field": "netKg"})
        length = float(row["lengthCm"] or 0)
        width = float(row["widthCm"] or 0)
        height = float(row["heightCm"] or 0)
        if not (length > 0 and width > 0 and height > 0 and gross > 0):
            issues.append(
                {
                    "rawIndex": raw,
                    "code": "CARGO_DIMENSIONS_REQUIRED",
                    "field": "lengthCm",
                }
            )
        carton = str(row["carton"] or "").strip()
        if carton:
            key = carton.lower()
            if key in carton_seen:
                issues.append({"rawIndex": raw, "code": "errImportDupCarton", "field": "carton"})
            else:
                carton_seen[key] = raw
    return issues


BLOCKING_ISSUE_CODES = {
    "CARGO_DIMENSIONS_REQUIRED",
    "errImportEmptyKey",
    "errImportSku",
    "errImportQty",
}


def rows_to_cargo(rows: list[dict]) -> list[dict]:
    """Convert mapped rows to scheme cargo. Never invent default L/W/H/weight."""
    cargo: list[dict] = []
    for i, row in enumerate(rows):
        length = float(row["lengthCm"] or 0)
        width = float(row["widthCm"] or 0)
        height = float(row["heightCm"] or 0)
        weight = float(row["grossKg"] or 0)
        if not (length > 0 and width > 0 and height > 0 and weight > 0):
            continue
        qty = int(max(0, row["boxCount"] or row["qty"] or 0))
        if qty <= 0:
            continue
        unit_price = float(row["unitPrice"] or 0)
        amount = float(row["amount"] or 0)
        price = unit_price
        if price <= 0 and amount > 0 and qty > 0:
            price = amount / qty
        sku = str(row["sku"] or row["description"] or f"SKU-{i + 1}").strip()
        cargo.append(
            {
                "sku": sku,
                "length": length,
                "width": width,
                "height": height,
                "weight": weight,
                "qty": qty,
                "price": price,
            }
        )
    return cargo


def rows_to_shipment_payload(rows: list[dict], *, parties: dict | None = None) -> dict:
    """Build shipment revision payload from mapped import rows.

    qty = pieceQty (PCS); boxCount = cartonCount when present.
    piecesPerCarton derived from integer division; remainder uses lastCartonQty.
    Skipped/invalid rows must appear in issues — never silently dropped without issues.
    """
    from apps.shipments.conservation import expected_carton_count

    product_lines: list[dict] = []
    carton_batches: list[dict] = []
    for i, row in enumerate(rows):
        length = float(row["lengthCm"] or 0)
        width = float(row["widthCm"] or 0)
        height = float(row["heightCm"] or 0)
        weight = float(row["grossKg"] or 0)
        if not (length > 0 and width > 0 and height > 0 and weight > 0):
            continue
        piece_qty = int(max(0, row["qty"] or 0))
        box_count = int(max(0, row["boxCount"] or 0))
        if piece_qty <= 0 and box_count <= 0:
            continue
        if piece_qty <= 0 and box_count > 0:
            # Legacy sheet where only carton count exists — treat 1 pcs/ctn
            piece_qty = box_count
        sku = str(row["sku"] or row["description"] or f"SKU-{i + 1}").strip()
        unit_price = float(row["unitPrice"] or 0)
        amount = float(row["amount"] or 0)
        if unit_price <= 0 and amount > 0 and piece_qty > 0:
            unit_price = amount / piece_qty
        net = float(row["netKg"] or 0)
        net_kg = net if net > 0 else None

        if box_count > 0:
            per = piece_qty // box_count
            rem = piece_qty % box_count
            if per <= 0:
                per = 1
                box_count, last = expected_carton_count(piece_qty, per)
            elif rem == 0:
                last = per
            else:
                # Prefer explicit conservation: recompute cartons from per
                box_count, last = expected_carton_count(piece_qty, per)
        else:
            per = piece_qty
            box_count, last = expected_carton_count(piece_qty, per)

        product_lines.append(
            {
                "sku": sku,
                "description": str(row["description"] or sku),
                "pieceQty": piece_qty,
                "unit": str(row["unit"] or "PCS") or "PCS",
                "unitPrice": unit_price,
            }
        )
        carton_batches.append(
            {
                "sku": sku,
                "piecesPerCarton": per,
                "cartonCount": box_count,
                "lastCartonQty": last,
                "grossKg": weight,
                "netKg": net_kg,
                "lengthCm": length,
                "widthCm": width,
                "heightCm": height,
            }
        )

    return {
        "parties": parties
        or {
            "customer": "",
            "seller": "",
            "shipper": "",
            "consignee": "",
            "buyer": "",
            "po": "",
            "incoterms": "",
            "currency": "USD",
            "paymentTerms": "",
        },
        "productLines": product_lines,
        "cartonBatches": carton_batches,
        "checklist": {"importRowCount": len(rows), "acceptedRows": len(product_lines)},
    }
