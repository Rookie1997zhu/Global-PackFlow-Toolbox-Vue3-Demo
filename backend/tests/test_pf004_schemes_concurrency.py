"""PF-004 / T-008 — true concurrent PUT same rowVersion => one 200 and one 409."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

from django.db import connection, transaction
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.schemes.models import Scheme

SAMPLE_CARGO = [
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


class SchemeConcurrentPutTests(TransactionTestCase):
    def _register_client(self, email: str) -> APIClient:
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get(reverse("auth-csrf")).json()["data"]["csrfToken"]
        headers = {"HTTP_X_CSRFTOKEN": csrf}
        reg = client.post(
            reverse("auth-register"),
            {"email": email, "password": "Passw0rd!xyz", "locale": "ko"},
            format="json",
            **headers,
        )
        assert reg.status_code in (200, 201), reg.content
        csrf = client.get(reverse("auth-csrf")).json()["data"]["csrfToken"]
        client._pf_csrf = {"HTTP_X_CSRFTOKEN": csrf}  # type: ignore[attr-defined]
        return client

    def test_two_puts_same_row_version_one_conflicts(self) -> None:
        # Two APIClient sessions for the same editor to hit TOCTOU on rowVersion.
        client_a = self._register_client("pf004-a@example.com")
        created_a = client_a.post(
            reverse("scheme-list-create"),
            {
                "version": 1,
                "name": "Concurrent A",
                "cargo": SAMPLE_CARGO,
                "meta": {},
            },
            format="json",
            **client_a._pf_csrf,  # type: ignore[attr-defined]
        )
        self.assertEqual(created_a.status_code, 201, created_a.content)
        scheme_id = created_a.json()["data"]["id"]
        url = reverse("scheme-detail", kwargs={"scheme_id": scheme_id})

        # Login same user in second client by re-register fails; use login endpoint
        client_b = APIClient(enforce_csrf_checks=True)
        csrf_b = client_b.get(reverse("auth-csrf")).json()["data"]["csrfToken"]
        login = client_b.post(
            reverse("auth-login"),
            {"email": "pf004-a@example.com", "password": "Passw0rd!xyz"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_b,
        )
        self.assertEqual(login.status_code, 200, login.content)
        csrf_b = client_b.get(reverse("auth-csrf")).json()["data"]["csrfToken"]
        headers_b = {"HTTP_X_CSRFTOKEN": csrf_b}
        headers_a = client_a._pf_csrf  # type: ignore[attr-defined]

        barrier = threading.Barrier(2)
        hold = threading.Event()
        release = threading.Event()

        def hold_row_lock() -> None:
            try:
                with transaction.atomic():
                    Scheme.objects.select_for_update().get(id=scheme_id)
                    hold.set()
                    release.wait(timeout=10)
            finally:
                connection.close()

        holder = threading.Thread(target=hold_row_lock, daemon=True)
        holder.start()
        self.assertTrue(hold.wait(timeout=5), "failed to acquire row lock helper")

        results: list = []

        def put(client: APIClient, headers: dict, name: str):
            try:
                barrier.wait(timeout=5)
                return client.put(
                    url,
                    {
                        "version": 1,
                        "name": name,
                        "cargo": SAMPLE_CARGO,
                        "meta": {},
                        "rowVersion": 1,
                    },
                    format="json",
                    **headers,
                )
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            fut_a = pool.submit(put, client_a, headers_a, "Writer-A")
            fut_b = pool.submit(put, client_b, headers_b, "Writer-B")
            # Both should be blocked in append_revision after unlocked version check
            threading.Event().wait(0.3)
            release.set()
            results = [fut_a.result(timeout=15), fut_b.result(timeout=15)]

        holder.join(timeout=5)
        codes = sorted(r.status_code for r in results)
        self.assertEqual(
            codes,
            [200, 409],
            msg=f"expected one success and one conflict, got {[r.status_code for r in results]} bodies={[r.content for r in results]}",
        )
        conflict = next(r for r in results if r.status_code == 409)
        body = conflict.json()
        self.assertEqual(body.get("code"), "SCHEME_VERSION_CONFLICT")
        scheme = Scheme.objects.get(id=scheme_id)
        self.assertEqual(scheme.row_version, 2)
        self.assertEqual(scheme.revisions.count(), 2)  # initial + one successful put
