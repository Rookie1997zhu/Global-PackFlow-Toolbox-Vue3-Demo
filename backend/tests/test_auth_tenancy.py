from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Role

User = get_user_model()


class AuthTenancyTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)

    def _csrf_headers(self) -> dict[str, str]:
        response = self.client.get(reverse("auth-csrf"))
        self.assertEqual(response.status_code, 200)
        token = response.json()["data"]["csrfToken"]
        return {"HTTP_X_CSRFTOKEN": token}

    def _register(self, email: str, password: str = "Passw0rd!xyz") -> dict:
        headers = self._csrf_headers()
        response = self.client.post(
            reverse("auth-register"),
            {"email": email, "password": password, "locale": "ko"},
            format="json",
            **headers,
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["data"]

    def test_register_login_me_and_personal_team(self) -> None:
        user_data = self._register("owner@example.com")
        self.assertEqual(user_data["email"], "owner@example.com")

        me = self.client.get(reverse("auth-me"))
        self.assertEqual(me.status_code, 200)
        payload = me.json()["data"]
        self.assertEqual(payload["user"]["email"], "owner@example.com")
        self.assertIsNotNone(payload["currentTeam"])
        self.assertEqual(payload["memberships"][0]["role"], Role.OWNER)

        self.client.post(
            reverse("auth-logout"),
            {},
            format="json",
            **self._csrf_headers(),
        )
        denied = self.client.get(reverse("auth-me"))
        self.assertEqual(denied.status_code, 403)

        login = self.client.post(
            reverse("auth-login"),
            {"email": "owner@example.com", "password": "Passw0rd!xyz"},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(login.status_code, 200)

    def test_anonymous_cannot_create_team(self) -> None:
        response = self.client.post(
            reverse("team-list-create"),
            {"name": "Hack"},
            format="json",
            **self._csrf_headers(),
        )
        self.assertIn(response.status_code, (401, 403))

    def test_cross_team_isolation_returns_404(self) -> None:
        self._register("a@example.com")
        team_a = self.client.get(reverse("team-list-create")).json()["data"][0]["id"]

        self.client.logout()
        self._register("b@example.com")
        detail = self.client.get(reverse("team-detail", kwargs={"team_id": team_a}))
        self.assertEqual(detail.status_code, 404)

    def test_invitation_flow_and_viewer_cannot_invite(self) -> None:
        self._register("owner@example.com")
        team_id = self.client.get(reverse("team-list-create")).json()["data"][0]["id"]

        invite = self.client.post(
            reverse("team-invitations", kwargs={"team_id": team_id}),
            {"email": "editor@example.com", "role": Role.EDITOR},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(invite.status_code, 201, invite.content)
        token = invite.json()["data"]["token"]

        self.client.logout()
        self._register("editor@example.com")
        accepted = self.client.post(
            reverse("invitation-accept"),
            {"token": token},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(accepted.status_code, 200, accepted.content)
        self.assertEqual(accepted.json()["data"]["role"], Role.EDITOR)

        # Promote to viewer-only second team path: create viewer via owner invite
        self.client.logout()
        # login as owner
        self.client.post(
            reverse("auth-login"),
            {"email": "owner@example.com", "password": "Passw0rd!xyz"},
            format="json",
            **self._csrf_headers(),
        )
        viewer_invite = self.client.post(
            reverse("team-invitations", kwargs={"team_id": team_id}),
            {"email": "viewer@example.com", "role": Role.VIEWER},
            format="json",
            **self._csrf_headers(),
        )
        viewer_token = viewer_invite.json()["data"]["token"]

        self.client.logout()
        self._register("viewer@example.com")
        self.client.post(
            reverse("invitation-accept"),
            {"token": viewer_token},
            format="json",
            **self._csrf_headers(),
        )
        forbidden = self.client.post(
            reverse("team-invitations", kwargs={"team_id": team_id}),
            {"email": "x@example.com", "role": Role.EDITOR},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(forbidden.status_code, 403)

        # membership count sanity
        self.assertEqual(
            Membership.objects.filter(team_id=team_id, status="active").count(),
            3,
        )
