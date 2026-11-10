"""CSV / XLSX table parsers for import preview."""

from __future__ import annotations

import csv
import io
from typing import Any


def parse_csv_bytes(data: bytes) -> list[list[str]]:
    text = data.decode("utf-8-sig")
    try:
        return _parse_csv_text(text)
    except UnicodeDecodeError:
        text = data.decode("cp949")
        return _parse_csv_text(text)


def _parse_csv_text(text: str) -> list[list[str]]:
    reader = csv.reader(io.StringIO(text))
    rows = [[str(c) for c in row] for row in reader]
    return [r for r in rows if any(str(c).strip() != "" for c in r)]


def parse_xlsx_bytes(data: bytes) -> list[list[str]]:
    from openpyxl import load_workbook

    wb = load_workbook(filename=io.BytesIO(data), read_only=True, data_only=True)
    try:
        ws = wb.worksheets[0]
        rows: list[list[str]] = []
        for row in ws.iter_rows(values_only=True):
            cells = ["" if c is None else str(c) for c in row]
            if any(c.strip() != "" for c in cells):
                rows.append(cells)
        return rows
    finally:
        wb.close()


def load_table(filename: str, data: bytes) -> list[list[str]]:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        return parse_xlsx_bytes(data)
    if lower.endswith(".csv"):
        try:
            return parse_csv_bytes(data)
        except UnicodeDecodeError:
            # Fallback already in parse_csv_bytes; re-raise as format issue
            raise
    raise ValueError("UNSUPPORTED_FORMAT")


def preview_table(table: list[list[str]], limit: int = 10) -> list[list[str]]:
    return table[: max(1, limit + 1)]
