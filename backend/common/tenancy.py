"""Team membership helpers and permission checks."""

from __future__ import annotations

from typing import Iterable

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from apps.organizations.models import Membership, MembershipStatus, Role, Team

ROLE_RANK = {
    Role.VIEWER: 1,
    Role.EDITOR: 2,
    Role.ADMIN: 3,
    Role.OWNER: 4,
}


def get_membership(user, team_id) -> Membership | None:
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return (
        Membership.objects.select_related("team", "user")
        .filter(
            user=user,
            team_id=team_id,
            status=MembershipStatus.ACTIVE,
            team__status="active",
        )
        .first()
    )


def require_membership(user, team_id) -> Membership:
    membership = get_membership(user, team_id)
    if membership is None:
        raise Http404()
    return membership


def role_at_least(role: str, minimum: str) -> bool:
    return ROLE_RANK.get(role, 0) >= ROLE_RANK.get(minimum, 99)


def require_role(membership: Membership, allowed: Iterable[str]) -> None:
    if membership.role not in set(allowed):
        raise PermissionDenied(detail="Insufficient team role")


def user_teams_qs(user):
    return Team.objects.filter(
        memberships__user=user,
        memberships__status=MembershipStatus.ACTIVE,
        status="active",
    ).distinct()
