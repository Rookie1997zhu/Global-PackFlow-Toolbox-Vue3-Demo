from __future__ import annotations

from django.urls import reverse
from rest_framework.test import APIClient
from django.test import TestCase

SAMPLE_CARGO = [
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


class SchemeApiTests(TestCase):
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

    def test_create_get_roundtrip(self) -> None:
        self._register("owner@example.com")
        created = self.client.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "KR export week 12",
                "locale": "ko",
                "cargo": SAMPLE_CARGO,
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        body = created.json()["data"]
        self.assertEqual(body["version"], 1)
        self.assertEqual(body["name"], "KR export week 12")
        self.assertEqual(body["cargo"][0]["length"], 42)
        self.assertEqual(body["rowVersion"], 1)
        self.assertTrue(body["id"].startswith("sch_"))

        detail = self.client.get(reverse("scheme-detail", kwargs={"scheme_id": body["id"]}))
        self.assertEqual(detail.status_code, 200)
        again = detail.json()["data"]
        self.assertEqual(again["cargo"], body["cargo"])
        self.assertEqual(again["name"], body["name"])

    def test_cross_team_404(self) -> None:
        self._register("a@example.com")
        created = self.client.post(
            reverse("scheme-list-create"),
            {"version": 1, "name": "A", "cargo": SAMPLE_CARGO, "meta": {}},
            format="json",
            **self._csrf(),
        )
        scheme_id = created.json()["data"]["id"]

        self.client.logout()
        self._register("b@example.com")
        detail = self.client.get(reverse("scheme-detail", kwargs={"scheme_id": scheme_id}))
        self.assertEqual(detail.status_code, 404)

        put = self.client.put(
            reverse("scheme-detail", kwargs={"scheme_id": scheme_id}),
            {
                "version": 1,
                "name": "Hack",
                "cargo": SAMPLE_CARGO,
                "meta": {},
                "rowVersion": 1,
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(put.status_code, 404)

    def test_optimistic_lock_conflict(self) -> None:
        self._register("owner@example.com")
        created = self.client.post(
            reverse("scheme-list-create"),
            {"version": 1, "name": "Lock", "cargo": SAMPLE_CARGO, "meta": {}},
            format="json",
            **self._csrf(),
        )
        scheme_id = created.json()["data"]["id"]

        ok_put = self.client.put(
            reverse("scheme-detail", kwargs={"scheme_id": scheme_id}),
            {
                "version": 1,
                "name": "Lock v2",
                "cargo": SAMPLE_CARGO,
                "meta": {},
                "rowVersion": 1,
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(ok_put.status_code, 200)
        self.assertEqual(ok_put.json()["data"]["rowVersion"], 2)

        conflict = self.client.put(
            reverse("scheme-detail", kwargs={"scheme_id": scheme_id}),
            {
                "version": 1,
                "name": "Stale",
                "cargo": SAMPLE_CARGO,
                "meta": {},
                "rowVersion": 1,
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["code"], "SCHEME_VERSION_CONFLICT")

    def test_import_demo_and_reject_bad_dimensions(self) -> None:
        self._register("owner@example.com")
        imported = self.client.post(
            reverse("scheme-import-demo"),
            {
                "version": 1,
                "id": "sch_legacy_abc",
                "name": "From IndexedDB",
                "locale": "ko",
                "cargo": SAMPLE_CARGO,
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(imported.status_code, 201, imported.content)
        self.assertTrue(imported.json()["data"]["imported"])

        again = self.client.post(
            reverse("scheme-import-demo"),
            {
                "version": 1,
                "id": "sch_legacy_abc",
                "name": "From IndexedDB",
                "cargo": SAMPLE_CARGO,
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(again.status_code, 200)
        self.assertTrue(again.json()["data"]["deduped"])

        bad = self.client.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "Bad",
                "cargo": [
                    {
                        "sku": "X",
                        "length": 0,
                        "width": 30,
                        "height": 20,
                        "weight": 5,
                        "qty": 1,
                        "price": 1,
                    }
                ],
                "meta": {},
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(bad.status_code, 400)

    def test_restore_creates_new_revision(self) -> None:
        self._register("owner@example.com")
        created = self.client.post(
            reverse("scheme-list-create"),
            {"version": 1, "name": "R", "cargo": SAMPLE_CARGO, "meta": {}},
            format="json",
            **self._csrf(),
        )
        scheme_id = created.json()["data"]["id"]
        cargo2 = [{**SAMPLE_CARGO[0], "qty": 99}]
        self.client.put(
            reverse("scheme-detail", kwargs={"scheme_id": scheme_id}),
            {
                "version": 1,
                "name": "R2",
                "cargo": cargo2,
                "meta": {},
                "rowVersion": 1,
            },
            format="json",
            **self._csrf(),
        )
        restored = self.client.post(
            reverse(
                "scheme-revision-restore",
                kwargs={"scheme_id": scheme_id, "rev": 1},
            ),
            {},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(restored.status_code, 200, restored.content)
        data = restored.json()["data"]
        self.assertEqual(data["revisionNo"], 3)
        self.assertEqual(data["cargo"][0]["qty"], 120)
