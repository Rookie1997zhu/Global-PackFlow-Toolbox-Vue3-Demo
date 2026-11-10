"""Document checker diff — mirrors frontend matchCheckerRows."""

from __future__ import annotations

from typing import Any


def _n(v: Any) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if n >= 0 else 0.0


def make_match_key(row: dict, mode: str = "sku+carton") -> str:
    s = str(row.get("sku") or "").strip().lower()
    c = str(row.get("carton") or "").strip().lower()
    p = str(row.get("po") or "").strip().lower()
    if mode == "sku":
        return f"sku::{s}" if s else ""
    if mode == "carton":
        return f"ctn::{c}" if c else ""
    if mode == "po+sku":
        if p and s:
            return f"{p}::{s}"
        return f"sku::{s}" if s else ""
    if s and c:
        return f"{s}::{c}"
    if s:
        return f"sku::{s}"
    if c:
        return f"ctn::{c}"
    return ""


def _near(a: float, b: float, eps: float = 0.011) -> bool:
    return abs(a - b) < eps


def match_checker_rows(
    expected: list[dict],
    actual: list[dict],
    mode: str = "sku+carton",
) -> list[dict]:
    def rekey(rows: list[dict]) -> list[dict]:
        out = []
        for r in rows:
            key = make_match_key(r, mode)
            if not key:
                continue
            item = dict(r)
            item["key"] = key
            out.append(item)
        return out

    exp_groups: dict[str, list[dict]] = {}
    act_groups: dict[str, list[dict]] = {}
    for r in rekey(expected):
        exp_groups.setdefault(r["key"], []).append(r)
    for r in rekey(actual):
        act_groups.setdefault(r["key"], []).append(r)

    diffs: list[dict] = []
    for key in sorted(set(exp_groups) | set(act_groups)):
        e_rows = exp_groups.get(key) or []
        a_rows = act_groups.get(key) or []

        if len(e_rows) > 1:
            diffs.append(
                {
                    "key": key,
                    "kind": "duplicate_expected",
                    "messageCode": "diffDupExpected",
                    "hint": f"Duplicate key in expected ({key})",
                }
            )
        if len(a_rows) > 1:
            diffs.append(
                {
                    "key": key,
                    "kind": "duplicate_actual",
                    "messageCode": "diffDupActual",
                    "hint": f"Duplicate key in actual ({key})",
                }
            )

        if not a_rows and e_rows:
            diffs.append(
                {
                    "key": key,
                    "kind": "missing_actual",
                    "messageCode": "diffMissingActual",
                    "expected": e_rows[0],
                    "hint": f"Expected missing in actual ({key})",
                }
            )
            continue
        if not e_rows and a_rows:
            diffs.append(
                {
                    "key": key,
                    "kind": "missing_expected",
                    "messageCode": "diffMissingExpected",
                    "actual": a_rows[0],
                    "hint": f"Actual missing in expected ({key})",
                }
            )
            continue
        if len(e_rows) != 1 or len(a_rows) != 1:
            continue

        e, a = e_rows[0], a_rows[0]
        field_miss = False

        def mismatch(kind: str, code: str, detail: dict) -> None:
            nonlocal field_miss
            field_miss = True
            diffs.append(
                {
                    "key": key,
                    "kind": kind,
                    "messageCode": code,
                    "expected": e,
                    "actual": a,
                    "detail": detail,
                    "hint": f"{kind} on {key}",
                }
            )

        if not _near(_n(e.get("qty")), _n(a.get("qty"))):
            mismatch("qty_mismatch", "diffQty", {"expectedQty": e.get("qty"), "actualQty": a.get("qty")})
        ew = e.get("weight", e.get("grossKg"))
        aw = a.get("weight", a.get("grossKg"))
        if not _near(_n(ew), _n(aw)):
            mismatch("weight_mismatch", "diffWeight", {"expectedWeight": ew, "actualWeight": aw})
        if not _near(_n(e.get("netKg")), _n(a.get("netKg"))):
            mismatch(
                "net_mismatch",
                "diffNet",
                {"expectedNetKg": e.get("netKg"), "actualNetKg": a.get("netKg")},
            )
        if not _near(_n(e.get("amount")), _n(a.get("amount"))):
            mismatch(
                "amount_mismatch",
                "diffAmount",
                {"expectedAmount": e.get("amount"), "actualAmount": a.get("amount")},
            )
        if str(e.get("unit") or "").strip().lower() != str(a.get("unit") or "").strip().lower():
            mismatch(
                "unit_mismatch",
                "diffUnit",
                {"expectedUnit": e.get("unit"), "actualUnit": a.get("unit")},
            )

        if not field_miss:
            diffs.append(
                {
                    "key": key,
                    "kind": "ok",
                    "messageCode": "diffOk",
                    "expected": e,
                    "actual": a,
                    "hint": f"Matched {key}",
                }
            )

    return sorted(diffs, key=lambda d: d["key"])
