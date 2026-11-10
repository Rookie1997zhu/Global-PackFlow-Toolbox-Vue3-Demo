"""Team and invitation endpoints."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from common.responses import ok
from common.tenancy import require_membership, require_role, user_teams_qs

from .models import (
    Invitation,
    Membership,
    MembershipStatus,
    Role,
    Team,
    hash_invitation_token,
)
from .serializers import (
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    MembershipSerializer,
    TeamCreateSerializer,
    TeamSerializer,
    TeamUpdateSerializer,
)


class TeamListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        teams = user_teams_qs(request.user).order_by("name")
        return ok(TeamSerializer(teams, many=True).data)

    @transaction.atomic
    def post(self, request: Request):
        serializer = TeamCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        team = Team.objects.create(
            name=data["name"],
            locale=data.get("locale") or request.user.locale or "ko",
            currency=data.get("currency") or "KRW",
        )
        Membership.objects.create(
            team=team,
            user=request.user,
            role=Role.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        return ok(TeamSerializer(team).data, status=status.HTTP_201_CREATED)


class TeamDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, team_id):
        require_membership(request.user, team_id)
        team = Team.objects.get(id=team_id)
        return ok(TeamSerializer(team).data)

    def patch(self, request: Request, team_id):
        membership = require_membership(request.user, team_id)
        require_role(membership, {Role.OWNER, Role.ADMIN})
        serializer = TeamUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        team = membership.team
        for field, value in serializer.validated_data.items():
            setattr(team, field, value)
        team.save()
        return ok(TeamSerializer(team).data)


class TeamMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, team_id):
        require_membership(request.user, team_id)
        members = (
            Membership.objects.select_related("user")
            .filter(team_id=team_id, status=MembershipStatus.ACTIVE)
            .order_by("created_at")
        )
        return ok(MembershipSerializer(members, many=True).data)


class TeamInvitationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, team_id):
        membership = require_membership(request.user, team_id)
        require_role(membership, {Role.OWNER, Role.ADMIN})
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        role = serializer.validated_data["role"]

        if Membership.objects.filter(
            team_id=team_id, user__email=email, status=MembershipStatus.ACTIVE
        ).exists():
            return Response(
                {
                    "ok": False,
                    "code": "ALREADY_MEMBER",
                    "message": "User is already a member",
                    "requestId": getattr(request, "request_id", None) or "invite",
                    "errors": {},
                },
                status=status.HTTP_409_CONFLICT,
            )

        invitation, raw_token = Invitation.create_with_token(
            team=membership.team,
            email=email,
            role=role,
            invited_by=request.user,
        )
        payload = InvitationSerializer(invitation).data
        payload["token"] = raw_token
        return ok(payload, status=status.HTTP_201_CREATED)


class InvitationAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request: Request):
        serializer = InvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        token_hash = hash_invitation_token(token)
        invitation = (
            Invitation.objects.select_related("team")
            .filter(token_hash=token_hash)
            .first()
        )
        if invitation is None or not invitation.is_open:
            raise NotFound(detail="Invitation not found or expired")

        if invitation.email != request.user.email.lower():
            raise PermissionDenied(detail="Invitation email does not match account")

        membership, _created = Membership.objects.get_or_create(
            team=invitation.team,
            user=request.user,
            defaults={
                "role": invitation.role,
                "status": MembershipStatus.ACTIVE,
            },
        )
        if membership.status != MembershipStatus.ACTIVE:
            membership.status = MembershipStatus.ACTIVE
            membership.role = invitation.role
            membership.save(update_fields=["status", "role", "updated_at"])

        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["accepted_at"])
        return ok(MembershipSerializer(membership).data)
