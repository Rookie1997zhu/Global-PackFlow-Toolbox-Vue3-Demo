"""PF-002 / T-004 — confirmed PL/CI lines must land in DocumentSnapshot (expected red)."""

from __future__ import annotations

import io
import tempfile

from django.test import TestCase, override_settings
from django.urls import reverse
from openpyxl import load_workbook
from rest_framework.test import APIClient

from apps.documents.models import Report

SCHEME_CARGO = [
    {
        "sku": "SKU-A",
        "length": 42,
        "width": 32,
        "height": 28,
        "weight": 7.5,
        "qty": 10,
        "price": 12.5,
    }
]

CONFIRMED_PL_LINES = [
    {
        "sku": "SKU-A",
        "cartonFrom": 1,
        "cartonTo": 9,
        "qtyPerCarton": 12,
        "grossKg": 7.5,
        "netKg": 6.1,
        "lengthCm": 42,
        "widthCm": 32,
        "heightCm": 28,
    }
]


class Pf002ConfirmedLinesTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self._media = tempfile.TemporaryDirectory()
        self._override = override_settings(MEDIA_ROOT=self._media.name)
        self._override.enable()
        self.addCleanup(self._override.disable)
        self.addCleanup(self._media.cleanup)

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

    def _scheme(self) -> str:
        created = self.client.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "PF002 source",
                "locale": "ko",
                "cargo": SCHEME_CARGO,
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        return created.json()["data"]["id"]

    def test_confirmed_packing_lines_enter_snapshot_and_xlsx(self) -> None:
        self._register("pf002@example.com")
        scheme_id = self._scheme()

        created = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "xlsx",
                "locale": "ko",
                "schemeId": scheme_id,
                "sourceMode": "confirmed_lines",
                "lines": CONFIRMED_PL_LINES,
                "shipper": "서울 수출",
                "consignee": "Buyer",
                "po": "PO-9",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        report = Report.objects.get(id=created.json()["data"]["id"])
        payload = report.snapshot.payload_json
        lines = payload.get("lines") or []
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0].get("cartonFrom"), 1)
        self.assertEqual(lines[0].get("cartonTo"), 9)
        self.assertEqual(lines[0].get("qtyPerCarton"), 12)
        self.assertAlmostEqual(float(lines[0].get("netKg")), 6.1, places=3)
        # Must not rebuild from cargo as 10 CTN × 1 with GW×0.92
        self.assertNotEqual(lines[0].get("qtyPerCarton"), 1)
        totals = payload.get("totals") or {}
        self.assertEqual(totals.get("cartonCount"), 9)
        self.assertAlmostEqual(float(totals.get("netKg") or 0), 6.1 * 9, places=3)

        dl = self.client.get(reverse("report-download", kwargs={"report_id": str(report.id)}))
        self.assertEqual(dl.status_code, 200)
        raw = b"".join(dl.streaming_content)
        wb = load_workbook(filename=io.BytesIO(raw), data_only=False)
        ws = wb.active
        flat = []
        for row in ws.iter_rows(values_only=True):
            flat.extend([c for c in row if c is not None])
        text = " ".join(str(c) for c in flat)
        # Renderer stores line NetKg as per-carton × cartons (6.1 × 9 = 54.9)
        self.assertTrue("54.9" in text or "6.1" in text)
        self.assertTrue("9" in text or "1-9" in text or "1–9" in text)

    def test_confirmed_invoice_unit_price_not_reverted_to_cargo(self) -> None:
        self._register("pf002-ci@example.com")
        scheme_id = self._scheme()
        created = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "commercial_invoice",
                "format": "xlsx",
                "locale": "ko",
                "schemeId": scheme_id,
                "sourceMode": "confirmed_lines",
                "lines": [
                    {
                        "sku": "SKU-A",
                        "description": "edited gift box",
                        "qty": 120,
                        "unitPrice": 13.75,
                        "unit": "PCS",
                    }
                ],
                "seller": "Seller",
                "buyer": "Buyer",
                "invoiceNo": "INV-1",
                "currency": "USD",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        report = Report.objects.get(id=created.json()["data"]["id"])
        line = (report.snapshot.payload_json.get("lines") or [None])[0]
        self.assertIsNotNone(line)
        self.assertAlmostEqual(float(line["unitPrice"]), 13.75, places=4)
        self.assertNotAlmostEqual(float(line["unitPrice"]), 12.5, places=4)
        self.assertEqual(line.get("description"), "edited gift box")

    def test_scheme_only_without_basis_is_not_formal_success(self) -> None:
        self._register("pf002-draft@example.com")
        scheme_id = self._scheme()
        created = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "pdf",
                "locale": "ko",
                "schemeId": scheme_id,
                "formal": True,
            },
            format="json",
            **self._csrf(),
        )
        if created.status_code in (400, 422):
            return
        self.assertEqual(created.status_code, 201, created.content)
        report = Report.objects.get(id=created.json()["data"]["id"])
        payload = report.snapshot.payload_json
        status = created.json()["data"].get("status")
        needs_review = payload.get("needsReview") or payload.get("status") == "draft"
        self.assertTrue(
            needs_review or status in {"draft", "needs_review"},
            "scheme-only formal PL must not succeed as final without confirmed lines/basis",
        )
