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

    @patch("apps.calculations.tasks.call_pack_container", return_value=FAKE_ENGINE)
    def test_idempotency_key_reuse_with_different_payload_conflicts(self, _mock) -> None:
        """Same Idempotency-Key + different params must 409 (not silently return old job)."""
        self._register("idem-conflict@calc.test")
        scheme_id = self._scheme()
        headers = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "idem-reuse-1"}
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

        headers2 = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "idem-reuse-1"}
        r2 = self.client.post(
            reverse("calc-job-create"),
            {
                "engine": "container",
                "schemeId": scheme_id,
                "params": {"containerPreset": "20GP", "allowRotate": False},
            },
            format="json",
            **headers2,
        )
        self.assertEqual(r2.status_code, 409, r2.content)
        code = r2.json().get("code") or ""
        self.assertIn("IDEMPOTENCY", code.upper())
        usage = self.client.get(reverse("usage-summary"))
        self.assertEqual(usage.json()["data"]["settled"], 1)

    @patch("apps.calculations.tasks.call_pack_container", return_value=FAKE_ENGINE)
    @patch("apps.calculations.services.DEFAULT_MONTHLY_QUOTA", 1)
    def test_quota_is_natural_month_scoped(self, _mock) -> None:
        """Prior-month settled usage must not block this month (quota=1)."""
        from datetime import timedelta

        from django.utils import timezone

        from apps.calculations.models import ReservationStatus, UsageReservation

        self._register("quota@calc.test")
        scheme_id = self._scheme()
        headers = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "quota-old"}
        r1 = self.client.post(
            reverse("calc-job-create"),
            {
                "engine": "container",
                "schemeId": scheme_id,
                "params": {"containerPreset": "40HQ"},
            },
            format="json",
            **headers,
        )
        self.assertEqual(r1.status_code, 202, r1.content)
        # Move reservation to previous month
        res = UsageReservation.objects.filter(status=ReservationStatus.SETTLED).latest("created_at")
        UsageReservation.objects.filter(pk=res.pk).update(
            created_at=timezone.now() - timedelta(days=40)
        )

        headers2 = {**self._csrf(), "HTTP_IDEMPOTENCY_KEY": "quota-new"}
        r2 = self.client.post(
            reverse("calc-job-create"),
            {
                "engine": "container",
                "schemeId": scheme_id,
                "params": {"containerPreset": "40HQ"},
            },
            format="json",
            **headers2,
        )
        self.assertEqual(
            r2.status_code,
            202,
            msg="prior-month usage must not consume current-month quota",
        )
