from __future__ import annotations

from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

SAMPLE_CARGO = [
    {
        "sku": "SKU-A",
        "length": 42,
        "width": 32,
        "height": 28,
        "weight": 7.5,
        "qty": 5,
        "price": 1,
    }
]

FAKE_ENGINE = {
    "ok": True,
    "engineVersion": "container-1.0.0",
    "serverVerified": True,
    "result": {
        "placements": [{"skuId": "SKU-A", "x": 0, "y": 0, "z": 0}],
        "unplaced": [],
        "packedCount": 5,
        "totalCount": 5,
        "packedWeight": 37.5,
        "packedVolumeMm3": 1,
        "containerVolumeMm3": 100,
        "volumeUtilPct": 1,
        "weightUtilPct": 1,
        "strategy": "volume",
        "warnings": [],
    },
}


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class CalculationsApiTests(TestCase):
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

    def _scheme(self) -> str:
        created = self.client.post(
            reverse("scheme-list-create"),
            {"version": 1, "name": "Calc", "cargo": SAMPLE_CARGO, "meta": {}},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(created.status_code, 201, created.content)
        return created.json()["data"]["id"]

    @patch("apps.calculations.tasks.call_pack_container", return_value=FAKE_ENGINE)
    def test_job_succeeds_and_idempotent(self, _mock) -> None:
        self._register("calc@example.com")
        scheme_id = self._scheme()
        headers = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "idem-calc-1"}
        r1 = self.client.post(
            reverse("calc-job-create"),
            {
                "engine": "container",
                "schemeId": scheme_id,
                "params": {"containerPreset": "40HQ", "allowRotate": True},
            },
            format="json",
            **headers,
        )
        self.assertEqual(r1.status_code, 202, r1.content)
        job_id = r1.json()["data"]["jobId"]
        self.assertEqual(r1.json()["data"]["status"], "succeeded")

        headers2 = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "idem-calc-1"}
        r2 = self.client.post(
            reverse("calc-job-create"),
            {
                "engine": "container",
                "schemeId": scheme_id,
                "params": {"containerPreset": "40HQ", "allowRotate": True},
            },
            format="json",
            **headers2,
        )
        self.assertEqual(r2.status_code, 202)
        self.assertEqual(r2.json()["data"]["jobId"], job_id)

        usage = self.client.get(reverse("usage-summary"))
        self.assertEqual(usage.status_code, 200)
        self.assertEqual(usage.json()["data"]["settled"], 1)

        result = self.client.get(reverse("calc-job-result", kwargs={"job_id": job_id}))
        self.assertEqual(result.status_code, 200)
        body = result.json()["data"]
        self.assertTrue(body["serverVerified"])
        self.assertEqual(body["engineVersion"], "container-1.0.0")

    @patch("apps.calculations.tasks.call_pack_container", return_value=FAKE_ENGINE)
    def test_cross_team_404(self, _mock) -> None:
        self._register("a@calc.test")
        scheme_id = self._scheme()
        headers = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "idem-a"}
        created = self.client.post(
            reverse("calc-job-create"),
            {"engine": "container", "schemeId": scheme_id, "params": {"containerPreset": "20GP"}},
            format="json",
            **headers,
        )
        job_id = created.json()["data"]["jobId"]
        self.client.logout()
        self._register("b@calc.test")
        detail = self.client.get(reverse("calc-job-detail", kwargs={"job_id": job_id}))
        self.assertEqual(detail.status_code, 404)

    def test_request_id_header(self) -> None:
        self._register("rid@calc.test")
        r = self.client.get(reverse("usage-summary"), HTTP_X_REQUEST_ID="req_test_abc")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["X-Request-Id"], "req_test_abc")
        self.assertEqual(r.json().get("requestId"), "req_test_abc")
