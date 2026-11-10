"""XLSX report renderer via openpyxl."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook


def render_xlsx(kind: str, payload: dict) -> bytes:
    wb = Workbook()
    ws = wb.active

    if kind == "packing_list":
        ws.title = "Packing List"
        meta = payload.get("meta") or {}
        ws.append(["Shipper", meta.get("shipper", "")])
        ws.append(["Consignee", meta.get("consignee", "")])
        ws.append(["PO", meta.get("po", "")])
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
                float(line["lengthCm"])
                * float(line["widthCm"])
                * float(line["heightCm"])
                / 1e6
                * cartons
            )
            ws.append(
                [
                    line.get("sku"),
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
        ws.append(["Invoice", meta.get("invoiceNo", "")])
        ws.append(["Seller", meta.get("seller", "")])
        ws.append(["Buyer", meta.get("buyer", "")])
        ws.append(["PO", meta.get("po", "")])
        ws.append(["Currency", meta.get("currency", "")])
        ws.append(["Incoterms", meta.get("incoterms", "")])
        ws.append(["Payment", meta.get("paymentTerms", "")])
        ws.append([])
        ws.append(["SKU", "Description", "Qty", "Unit", "UnitPrice", "Amount"])
        for line in payload.get("lines") or []:
            amount = float(line.get("qty") or 0) * float(line.get("unitPrice") or 0)
            ws.append(
                [
                    line.get("sku"),
                    line.get("description"),
                    line.get("qty"),
                    line.get("unit"),
                    line.get("unitPrice"),
                    round(amount, 2),
                ]
            )
        totals = payload.get("totals") or {}
        ws.append(["TOTAL", "", "", "", "", totals.get("computedTotal")])
        ws.append([])
        ws.append([str(payload.get("disclaimer") or "")])

    else:
        ws.title = "Diff"
        ws.append(["Key", "Kind", "Code", "Hint"])
        for d in payload.get("diffs") or []:
            ws.append([d.get("key"), d.get("kind"), d.get("messageCode"), d.get("hint")])

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
