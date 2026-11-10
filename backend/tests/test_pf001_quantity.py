"""PF-001 / T-001..T-003 — quantity semantics and net-weight (expected red until fix)."""

from __future__ import annotations

import json
from pathlib import Path

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.documents.builders import packing_from_cargo, packing_totals, invoice_from_cargo

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "shipment"


class Pf001QuantitySemanticsTests(TestCase):
    def test_fixture_120pcs_10ctn_contract(self) -> None:
        fx = json.loads((FIXTURES / "kr-120pcs-10ctn.json").read_text(encoding="utf-8"))
        conf = fx["confirmed"]
        # Target: builders (or cartonize helper) must honor pieceQty / piecesPerCarton.
        cargo = [
            {
                "sku": "SKU-A",
                "length": 42,
                "width": 32,
                "height": 28,
                "weight": conf["grossKgPerCarton"],
                "qty": conf["pieceQty"],
                "pieceQty": conf["pieceQty"],
                "piecesPerCarton": conf["piecesPerCarton"],
                "price": conf["unitPrice"],
            }
        ]
        lines = packing_from_cargo(cargo)
        totals = packing_totals(lines)
        self.assertEqual(totals["cartonCount"], fx["expectedPackingTotals"]["cartonCount"])
        self.assertEqual(totals["totalQty"], fx["expectedPackingTotals"]["totalQty"])
        self.assertEqual(lines[0]["qtyPerCarton"], conf["piecesPerCarton"])
        # Must not fabricate NW from gross×0.92 when net is null
        net = lines[0].get("netKg")
        self.assertTrue(
            net is None
            or abs(float(net) - float(conf["grossKgPerCarton"]) * 0.92) > 0.001,
            f"fabricated net weight: {net}",
        )

        inv = invoice_from_cargo(cargo)
        self.assertEqual(inv[0]["qty"], fx["expectedInvoice"]["qty"])
        self.assertEqual(inv[0]["unit"], fx["expectedInvoice"]["unit"])

    def test_fixture_partial_last_carton(self) -> None:
        fx = json.loads((FIXTURES / "partial-last-carton.json").read_text(encoding="utf-8"))
        conf = fx["confirmed"]
        cargo = [
            {
                "sku": "SKU-A",
                "length": 42,
                "width": 32,
                "height": 28,
                "weight": conf["grossKgPerCarton"],
                "qty": conf["pieceQty"],
                "pieceQty": conf["pieceQty"],
                "piecesPerCarton": conf["piecesPerCarton"],
                "netKg": conf["netKgPerCarton"],
                "price": 1,
            }
        ]
        lines = packing_from_cargo(cargo)
        totals = packing_totals(lines)
        self.assertEqual(totals["cartonCount"], fx["expectedPacking"]["cartonCount"])
        self.assertEqual(totals["totalQty"], fx["expectedPacking"]["totalQty"])
        self.assertEqual(totals["totalQty"], conf["pieceQty"])
        self.assertNotEqual(totals["totalQty"], fx["forbidden"]["totalQty"])
        # last carton qty must be 1 (partial), not padded
        last = lines[-1]
        self.assertEqual(
            last.get("lastCartonQty") or last.get("qtyPerCarton"),
            fx["expectedPacking"]["lastCartonQty"],
        )

    def test_bare_qty_must_not_become_120_cartons_with_fabricated_net(self) -> None:
        cargo = [
            {
                "sku": "SKU-A",
                "length": 42,
                "width": 32,
                "height": 28,
                "weight": 7.5,
                "qty": 120,
                "price": 12.5,
            }
        ]
        lines = packing_from_cargo(cargo)
        totals = packing_totals(lines)
        # Ambiguous legacy qty must not be treated as 120 CTN × 1 PCS with GW×0.92 NW.
        self.assertFalse(
            totals["cartonCount"] == 120
            and lines[0]["qtyPerCarton"] == 1
            and abs(float(lines[0]["netKg"]) - 7.5 * 0.92) < 0.001,
            "legacy qty inferred as CTN with fabricated net weight",
        )


class Pf001FormalReportRejectTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)

    def _csrf(self) -> dict:
        r = self.client.get(reverse("auth-csrf"))
        return {"HTTP_X_CSRFTOKEN": r.json()["data"]["csrfToken"]}

    def _register(self, email: str) -> None:
        self.client.post(
            reverse("auth-register"),
            {"email": email, "password": "Passw0rd!xyz", "locale": "ko"},
            format="json",
            **self._csrf(),
        )

    def test_formal_packing_list_rejects_ambiguous_qty_or_marks_needs_review(self) -> None:
        self._register("pf001@example.com")
        created = self.client.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "Ambiguous qty",
                "locale": "ko",
                "cargo": [
                    {
                        "sku": "SKU-A",
                        "length": 42,
                        "width": 32,
                        "height": 28,
                        "weight": 7.5,
                        "qty": 120,
                        "price": 12.5,
                    }
                ],
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        scheme_id = created.json()["data"]["id"]

        report = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "xlsx",
                "locale": "ko",
                "schemeId": scheme_id,
                "formal": True,
            },
            format="json",
            **self._csrf(),
        )
        # Formal export must not silently succeed with invented carton/NW semantics.
        if report.status_code in (400, 422):
            return
        self.assertEqual(report.status_code, 201, report.content)
        from apps.documents.models import Report

        row = Report.objects.get(id=report.json()["data"]["id"])
        payload = row.snapshot.payload_json
        needs_review = payload.get("needsReview") or payload.get("legacyQuantityBasis") == "unknown"
        totals = payload.get("totals") or {}
        lines = payload.get("lines") or []
        fabricated = (
            totals.get("cartonCount") == 120
            and lines
            and lines[0].get("qtyPerCarton") == 1
            and abs(float(lines[0].get("netKg") or 0) - 6.9) < 0.01
        )
        self.assertTrue(
            needs_review or not fabricated,
            "formal PL accepted invented 120 CTN and GW×0.92 net without review flag",
        )
