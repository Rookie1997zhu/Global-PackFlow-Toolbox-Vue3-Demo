"""XLSX report renderer via openpyxl."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook


def _escape_cell(value):
    """Prevent Excel formula injection for leading = + - @."""
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    text = str(value)
    if text[:1] in {"=", "+", "-", "@"}:
        return "'" + text
    return text


def render_xlsx(kind: str, payload: dict) -> bytes:
    wb = Workbook()
    ws = wb.active

    if kind == "packing_list":
        ws.title = "Packing List"
        meta = payload.get("meta") or {}
        ws.append(["Shipper", _escape_cell(meta.get("shipper", ""))])
        ws.append(["Consignee", _escape_cell(meta.get("consignee", ""))])
        ws.append(["PO", _escape_cell(meta.get("po", ""))])
        ws.append([])
        ws.append(
            [
                "SKU",
                "CartonFrom",
                "CartonTo",
                "Cartons",
                "Qty/Carton",
                "GrossKg",
                "NetKg",
                "L",
                "W",
                "H",
                "CBM",
            ]
        )
        for line in payload.get("lines") or []:
            cartons = int(line["cartonTo"]) - int(line["cartonFrom"]) + 1
            cbm = (
                float(line.get("lengthCm") or 0)
                * float(line.get("widthCm") or 0)
                * float(line.get("heightCm") or 0)
                / 1e6
                * cartons
            )
            ws.append(
                [
                    _escape_cell(line.get("sku")),
                    line.get("cartonFrom"),
                    line.get("cartonTo"),
                    cartons,
                    line.get("qtyPerCarton"),
                    round(float(line.get("grossKg") or 0) * cartons, 3),
                    round(float(line.get("netKg") or 0) * cartons, 3),
                    line.get("lengthCm"),
                    line.get("widthCm"),
                    line.get("heightCm"),
                    round(cbm, 4),
                ]
            )
        totals = payload.get("totals") or {}
        ws.append(
            [
                "TOTAL",
                "",
                "",
                totals.get("cartonCount"),
                totals.get("totalQty"),
                round(float(totals.get("grossKg") or 0), 3),
                round(float(totals.get("netKg") or 0), 3),
                "",
                "",
                "",
                round(float(totals.get("cbm") or 0), 4),
            ]
        )

    elif kind == "commercial_invoice":
        ws.title = "Invoice"
        meta = payload.get("meta") or {}
        ws.append(["Invoice", _escape_cell(meta.get("invoiceNo", ""))])
        ws.append(["Seller", _escape_cell(meta.get("seller", ""))])
        ws.append(["Buyer", _escape_cell(meta.get("buyer", ""))])
        ws.append(["PO", _escape_cell(meta.get("po", ""))])
        ws.append(["Currency", _escape_cell(meta.get("currency", ""))])
        ws.append(["Incoterms", _escape_cell(meta.get("incoterms", ""))])
        ws.append(["Payment", _escape_cell(meta.get("paymentTerms", ""))])
        ws.append([])
        ws.append(["SKU", "Description", "Qty", "Unit", "UnitPrice", "Amount"])
        for line in payload.get("lines") or []:
            amount = float(line.get("qty") or 0) * float(line.get("unitPrice") or 0)
            ws.append(
                [
                    _escape_cell(line.get("sku")),
                    _escape_cell(line.get("description")),
                    line.get("qty"),
                    _escape_cell(line.get("unit")),
                    line.get("unitPrice"),
                    round(amount, 2),
                ]
            )
        totals = payload.get("totals") or {}
        ws.append(["TOTAL", "", "", "", "", totals.get("computedTotal")])
        ws.append([])
        ws.append([_escape_cell(str(payload.get("disclaimer") or ""))])

    else:
        ws.title = "Diff"
        ws.append(["Key", "Kind", "Code", "Hint"])
        for d in payload.get("diffs") or []:
            ws.append(
                [
                    _escape_cell(d.get("key")),
                    _escape_cell(d.get("kind")),
                    _escape_cell(d.get("messageCode")),
                    _escape_cell(d.get("hint")),
                ]
            )

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
