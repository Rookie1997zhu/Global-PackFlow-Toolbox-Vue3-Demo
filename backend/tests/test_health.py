from django.test import TestCase
from django.urls import reverse


class HealthEndpointTests(TestCase):
    def test_live_returns_ok(self) -> None:
        response = self.client.get(reverse("health-live"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["status"], "live")

    def test_ready_returns_ok_when_database_available(self) -> None:
        response = self.client.get(reverse("health-ready"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["status"], "ready")
        self.assertEqual(payload["data"]["database"], "ok")
