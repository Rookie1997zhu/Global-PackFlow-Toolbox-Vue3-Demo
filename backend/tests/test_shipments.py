from __future__ import annotations

from django.urls import reverse
from django.test import TestCase
from rest_framework.test import APIClient

from apps.shipments.conservation import (
    expected_carton_count,
    pieces_from_batch,
    validate_piece_carton_conservation,
)


SAMPLE_120_PAYLOAD = {
    "parties": {
        "customer": "Acme KR",
        "seller": "PackFlow Seller",
        "shipper": "Shipper Co",
        "consignee": "Consignee Co",
        "buyer": "Acme KR",
        "po": "PO-100",
        "incoterms": "FOB",
        "currency": "USD",
        "paymentTerms": "Net 30",
    },
    "productLines": [
        {
            "sku": "SKU-A",
            "description": "Widget A",
            "pieceQty": 120,
            "unit": "PCS",
            "unitPrice": 12.5,
        }
    ],
    "cartonBatches": [
        {
            "sku": "SKU-A",
            "piecesPerCarton": 12,
            "cartonCount": 10,
            "lastCartonQty": 12,
            "grossKg": 7.5,
            "netKg": None,
            "lengthCm": 42,
            "widthCm": 32,
            "heightCm": 28,
        }
    ],
    "checklist": {},
}


class ConservationUnitTests(TestCase):
    def test_120pcs_10ctn(self) -> None:
        count, last = expected_carton_count(120, 12)
        self.assertEqual(count, 10)
        self.assertEqual(last, 12)
        self.assertEqual(pieces_from_batch(SAMPLE_120_PAYLOAD["cartonBatches"][0]), 120)
        self.assertEqual(validate_piece_carton_conservation(SAMPLE_120_PAYLOAD), [])

    def test_partial_last_carton(self) -> None:
        payload = {
            "productLines": [{"sku": "S", "pieceQty": 121}],
            "cartonBatches": [
                {
                    "sku": "S",
                    "piecesPerCarton": 12,
                    "cartonCount": 11,
                    "lastCartonQty": 1,
                    "grossKg": 1,
                    "netKg": None,
                }
            ],
        }
        self.assertEqual(validate_piece_carton_conservation(payload), [])
        bad = {
            "productLines": [{"sku": "S", "pieceQty": 120}],
            "cartonBatches": [
                {"sku": "S", "piecesPerCarton": 12, "cartonCount": 11, "lastCartonQty": 1}
            ],
        }
        issues = validate_piece_carton_conservation(bad)
        self.assertTrue(any(i["code"] == "PIECE_CARTON_MISMATCH" for i in issues))


class ShipmentApiTests(TestCase):
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

    def _create(self, payload=None, shipment_no: str = "SHP-001") -> dict:
        body = {"shipmentNo": shipment_no, "payload": payload or SAMPLE_120_PAYLOAD}
        created = self.client.post(
            reverse("shipment-list-create"),
            body,
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        return created.json()["data"]

    def test_create_get_conservation_roundtrip(self) -> None:
        self._register("owner@example.com")
        data = self._create()
        self.assertTrue(data["id"].startswith("shp_"))
        self.assertEqual(data["status"], "draft")
        self.assertEqual(data["revisionNo"], 1)
        self.assertEqual(data["payload"]["productLines"][0]["pieceQty"], 120)
        self.assertEqual(data["payload"]["cartonBatches"][0]["cartonCount"], 10)

        detail = self.client.get(reverse("shipment-detail", kwargs={"shipment_id": data["id"]}))
        self.assertEqual(detail.status_code, 200)
        again = detail.json()["data"]
        self.assertEqual(again["payload"]["productLines"][0]["pieceQty"], 120)
        self.assertIsNone(again["payload"]["cartonBatches"][0]["netKg"])

    def test_cross_team_404(self) -> None:
        self._register("a@example.com")
        data = self._create()
        shipment_id = data["id"]

        self.client.logout()
        self._register("b@example.com")
        detail = self.client.get(reverse("shipment-detail", kwargs={"shipment_id": shipment_id}))
        self.assertEqual(detail.status_code, 404)

        put = self.client.put(
            reverse("shipment-detail", kwargs={"shipment_id": shipment_id}),
            {"payload": SAMPLE_120_PAYLOAD, "rowVersion": 1},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(put.status_code, 404)

    def test_optimistic_lock_conflict(self) -> None:
        self._register("owner@example.com")
        data = self._create()
        shipment_id = data["id"]

        ok_put = self.client.put(
            reverse("shipment-detail", kwargs={"shipment_id": shipment_id}),
            {
                "payload": SAMPLE_120_PAYLOAD,
                "rowVersion": 1,
                "shipmentNo": "SHP-001",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(ok_put.status_code, 200)
        self.assertEqual(ok_put.json()["data"]["rowVersion"], 2)

        conflict = self.client.put(
            reverse("shipment-detail", kwargs={"shipment_id": shipment_id}),
            {"payload": SAMPLE_120_PAYLOAD, "rowVersion": 1},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["code"], "SHIPMENT_VERSION_CONFLICT")

    def test_status_machine_and_reports(self) -> None:
        self._register("owner@example.com")
        data = self._create()
        shipment_id = data["id"]

        ready = self.client.post(
            reverse("shipment-status", kwargs={"shipment_id": shipment_id}),
            {"status": "ready", "rowVersion": data["rowVersion"]},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(ready.status_code, 200, ready.content)
        self.assertEqual(ready.json()["data"]["status"], "ready")
        row = ready.json()["data"]["rowVersion"]

        confirmed = self.client.post(
            reverse("shipment-status", kwargs={"shipment_id": shipment_id}),
            {"status": "confirmed", "rowVersion": row},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.content)
        row = confirmed.json()["data"]["rowVersion"]
        rev_no = confirmed.json()["data"]["revisionNo"]

        pl = self.client.post(
            reverse("shipment-reports", kwargs={"shipment_id": shipment_id}),
            {"kind": "packing_list", "format": "xlsx", "locale": "ko", "formal": False},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(pl.status_code, 201, pl.content)
        pl_body = pl.json()["data"]
        self.assertEqual(pl_body["shipmentRevision"]["revisionNo"], rev_no)

        ci = self.client.post(
            reverse("shipment-reports", kwargs={"shipment_id": shipment_id}),
            {"kind": "commercial_invoice", "format": "xlsx", "locale": "ko", "formal": False},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(ci.status_code, 201, ci.content)
        self.assertEqual(ci.json()["data"]["shipmentRevision"]["revisionNo"], rev_no)

        docs = self.client.get(
            reverse("shipment-documents", kwargs={"shipment_id": shipment_id})
        )
        self.assertEqual(docs.status_code, 200)
        purposes = {d["purpose"] for d in docs.json()["data"]["items"]}
        self.assertEqual(purposes, {"pl", "ci"})

        # Critical edit reverts to draft
        put = self.client.put(
            reverse("shipment-detail", kwargs={"shipment_id": shipment_id}),
            {"payload": SAMPLE_120_PAYLOAD, "rowVersion": row, "reason": "fix PO"},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(put.status_code, 200, put.content)
        self.assertEqual(put.json()["data"]["status"], "draft")

    def test_reject_bad_conservation_on_ready(self) -> None:
        self._register("owner@example.com")
        bad = {
            "parties": {},
            "productLines": [{"sku": "S", "pieceQty": 100}],
            "cartonBatches": [
                {"sku": "S", "piecesPerCarton": 12, "cartonCount": 10, "lastCartonQty": 12, "grossKg": 1}
            ],
            "checklist": {},
        }
        created = self.client.post(
            reverse("shipment-list-create"),
            {"shipmentNo": "BAD-1", "payload": bad},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 400)

    def test_restore_revision(self) -> None:
        self._register("owner@example.com")
        data = self._create()
        shipment_id = data["id"]
        payload2 = {
            **SAMPLE_120_PAYLOAD,
            "productLines": [
                {**SAMPLE_120_PAYLOAD["productLines"][0], "pieceQty": 240, "description": "v2"}
            ],
            "cartonBatches": [
                {
                    **SAMPLE_120_PAYLOAD["cartonBatches"][0],
                    "cartonCount": 20,
                    "lastCartonQty": 12,
                }
            ],
        }
        put = self.client.put(
            reverse("shipment-detail", kwargs={"shipment_id": shipment_id}),
            {"payload": payload2, "rowVersion": 1},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(put.status_code, 200)
        self.assertEqual(put.json()["data"]["revisionNo"], 2)

        restored = self.client.post(
            reverse(
                "shipment-revision-restore",
                kwargs={"shipment_id": shipment_id, "rev": 1},
            ),
            {},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(restored.status_code, 200, restored.content)
        body = restored.json()["data"]
        self.assertEqual(body["revisionNo"], 3)
        self.assertEqual(body["payload"]["productLines"][0]["pieceQty"], 120)
