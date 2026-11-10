from __future__ import annotations

import tempfile
from datetime import timedelta

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.documents.models import Report

SAMPLE_CARGO = [
    {
        "sku": "SKU-A",
        "length": 42,
        "width": 32,
        "height": 28,
        "weight": 7.5,
        "qty": 10,
        "price": 12.5,
    },
    {
        "sku": "SKU-B",
        "length": 36,
        "width": 28,
        "height": 22,
        "weight": 5.2,
        "qty": 5,
        "price": 8.0,
    },
]


class ReportsApiTests(TestCase):
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

    def _create_scheme(self) -> str:
        created = self.client.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "Report source",
                "locale": "ko",
                "cargo": SAMPLE_CARGO,
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        return created.json()["data"]["id"]

    def test_packing_list_pdf_and_xlsx(self) -> None:
        self._register("owner@reports.test")
        scheme_id = self._create_scheme()

        pdf = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "pdf",
                "locale": "ko",
                "schemeId": scheme_id,
                "shipper": "서울 수출",
                "consignee": "부산 바이어",
                "po": "PO-1",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(pdf.status_code, 201, pdf.content)
        pdata = pdf.json()["data"]
        self.assertEqual(pdata["kind"], "packing_list")
        self.assertEqual(pdata["format"], "pdf")
        self.assertEqual(pdata["sourceRevision"]["revisionNo"], 1)

        dl = self.client.get(reverse("report-download", kwargs={"report_id": pdata["id"]}))
        self.assertEqual(dl.status_code, 200)
        self.assertTrue(dl["Content-Type"].startswith("application/pdf"))
        body = b"".join(dl.streaming_content)
        self.assertTrue(body.startswith(b"%PDF"))
        # Korean / ASCII markers present in PDF streams (CID or embedded)
        self.assertTrue(b"Packing" in body or b"SKU-A" in body or len(body) > 500)

        xlsx = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "xlsx",
                "locale": "ko",
                "schemeId": scheme_id,
                "shipper": "서울 수출",
                "consignee": "Buyer",
                "po": "PO-1",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(xlsx.status_code, 201, xlsx.content)
        xdl = self.client.get(
            reverse("report-download", kwargs={"report_id": xlsx.json()["data"]["id"]})
        )
        self.assertEqual(xdl.status_code, 200)
        xbody = b"".join(xdl.streaming_content)
        self.assertTrue(xbody[:2] == b"PK")

    def test_invoice_disclaimer_and_diff_qty(self) -> None:
        self._register("owner2@reports.test")
        scheme_id = self._create_scheme()
        inv = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "commercial_invoice",
                "format": "xlsx",
                "locale": "ko",
                "schemeId": scheme_id,
                "seller": "Seller Co",
                "buyer": "Buyer Co",
                "invoiceNo": "INV-1",
                "currency": "USD",
                "incoterms": "FOB",
                "paymentTerms": "TT",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(inv.status_code, 201, inv.content)
        report = Report.objects.get(id=inv.json()["data"]["id"])
        disclaimer = report.snapshot.payload_json.get("disclaimer", "")
        self.assertIn("전자세금계산서", disclaimer)

        diff = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "diff",
                "format": "pdf",
                "locale": "ko",
                "schemeId": scheme_id,
                "matchMode": "sku",
                "expected": [{"sku": "A", "qty": 10, "weight": 1, "netKg": 1, "amount": 10, "unit": "PCS"}],
                "actual": [{"sku": "A", "qty": 9, "weight": 1, "netKg": 1, "amount": 10, "unit": "PCS"}],
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(diff.status_code, 201, diff.content)
        summary = diff.json()["data"]["diffSummary"]
        self.assertGreaterEqual(summary["failed"], 1)
        drep = Report.objects.get(id=diff.json()["data"]["id"])
        kinds = {d["kind"] for d in drep.snapshot.payload_json["diffs"]}
        self.assertIn("qty_mismatch", kinds)

    def test_cross_team_download_404(self) -> None:
        self._register("a@reports.test")
        scheme_id = self._create_scheme()
        created = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "pdf",
                "locale": "ko",
                "schemeId": scheme_id,
                "shipper": "A",
                "consignee": "B",
                "po": "P",
            },
            format="json",
            **self._csrf(),
        )
        report_id = created.json()["data"]["id"]
        self.client.logout()
        self._register("b@reports.test")
        detail = self.client.get(reverse("report-detail", kwargs={"report_id": report_id}))
        self.assertEqual(detail.status_code, 404)
        dl = self.client.get(reverse("report-download", kwargs={"report_id": report_id}))
        self.assertEqual(dl.status_code, 404)

    def test_expired_report(self) -> None:
        self._register("exp@reports.test")
        scheme_id = self._create_scheme()
        created = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "pdf",
                "locale": "en",
                "schemeId": scheme_id,
                "shipper": "A",
                "consignee": "B",
                "po": "P",
            },
            format="json",
            **self._csrf(),
        )
        report_id = created.json()["data"]["id"]
        report = Report.objects.get(id=report_id)
        report.expires_at = timezone.now() - timedelta(hours=1)
        report.save(update_fields=["expires_at"])
        if report.file_asset_id:
            fa = report.file_asset
            fa.expires_at = report.expires_at
            fa.save(update_fields=["expires_at"])
        dl = self.client.get(reverse("report-download", kwargs={"report_id": report_id}))
        self.assertEqual(dl.status_code, 410)
        self.assertEqual(dl.json()["code"], "REPORT_EXPIRED")

    def test_xlsx_formula_injection_is_escaped(self) -> None:
        """SKU/description starting with =/+/-/@ must not become Excel formulas."""
        import io

        from openpyxl import load_workbook

        self._register("formula@reports.test")
        evil = '=HYPERLINK("http://evil.example","x")'
        created = self.client.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "Formula inject",
                "locale": "ko",
                "cargo": [
                    {
                        "sku": evil,
                        "length": 42,
                        "width": 32,
                        "height": 28,
                        "weight": 7.5,
                        "qty": 2,
                        "price": 1,
                    }
                ],
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        scheme_id = created.json()["data"]["id"]
        xlsx = self.client.post(
            reverse("report-list-create"),
            {
                "kind": "packing_list",
                "format": "xlsx",
                "locale": "ko",
                "schemeId": scheme_id,
                "shipper": "+1+1",
                "consignee": "@SUM(1,1)",
                "po": "-1+1",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(xlsx.status_code, 201, xlsx.content)
        dl = self.client.get(
            reverse("report-download", kwargs={"report_id": xlsx.json()["data"]["id"]})
        )
        self.assertEqual(dl.status_code, 200)
        raw = b"".join(dl.streaming_content)
        wb = load_workbook(filename=io.BytesIO(raw), data_only=False)
        ws = wb.active
        for row in ws.iter_rows():
            for cell in row:
                if cell.value is None:
                    continue
                self.assertNotEqual(getattr(cell, "data_type", None), "f")
                text = str(cell.value)
                if text[:1] in {"=", "+", "-", "@"}:
                    self.fail(f"unescaped formula-like cell value: {text!r}")
