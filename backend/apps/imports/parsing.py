"""CSV / XLSX table parsers for import preview."""

from __future__ import annotations

import csv
import io
from typing import Any


def parse_csv_bytes(data: bytes) -> list[list[str]]:
    last_err: Exception | None = None
    for encoding in ("utf-8-sig", "cp949", "utf-8"):
        try:
            text = data.decode(encoding)
            return _parse_csv_text(text)
        except UnicodeDecodeError as exc:
            last_err = exc
            continue
    if last_err:
        raise last_err
    return _parse_csv_text(data.decode("utf-8", errors="replace"))


def _parse_csv_text(text: str) -> list[list[str]]:
    reader = csv.reader(io.StringIO(text))
    rows = [[str(c) for c in row] for row in reader]
    return [r for r in rows if any(str(c).strip() != "" for c in r)]


def list_xlsx_sheets(data: bytes) -> list[dict[str, Any]]:
    from openpyxl import load_workbook

    wb = load_workbook(filename=io.BytesIO(data), read_only=True, data_only=True)
    try:
        return [{"index": i, "name": str(ws.title)} for i, ws in enumerate(wb.worksheets)]
    finally:
        wb.close()


def parse_xlsx_bytes(data: bytes, sheet_index: int = 0) -> list[list[str]]:
    from openpyxl import load_workbook

    wb = load_workbook(filename=io.BytesIO(data), read_only=True, data_only=True)
    try:
        if not wb.worksheets:
            return []
        idx = int(sheet_index or 0)
        if idx < 0 or idx >= len(wb.worksheets):
            raise ValueError(f"INVALID_SHEET_INDEX:{idx}")
        ws = wb.worksheets[idx]
        rows: list[list[str]] = []
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c) for c in row]
            if any(c.strip() != "" for c in cells):
                rows.append(cells)
        return rows
    finally:
        wb.close()


def load_table(filename: str, data: bytes, sheet_index: int | None = None) -> list[list[str]]:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        return parse_xlsx_bytes(data, sheet_index=0 if sheet_index is None else int(sheet_index))
    if lower.endswith(".csv"):
        return parse_csv_bytes(data)
    raise ValueError("UNSUPPORTED_FORMAT")


def preview_table(table: list[list[str]], limit: int = 10) -> list[list[str]]:
    return table[: max(1, limit + 1)]
