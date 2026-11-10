from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Invitation, Membership, Role, Team

User = get_user_model()


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = (
            "id",
            "name",
            "locale",
            "currency",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")


class TeamCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    locale = serializers.CharField(required=False, default="ko", max_length=8)
    currency = serializers.CharField(required=False, default="KRW", max_length=8)


class TeamUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, max_length=200)
    locale = serializers.CharField(required=False, max_length=8)
    currency = serializers.CharField(required=False, max_length=8)


class MembershipSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    userId = serializers.UUIDField(source="user_id", read_only=True)
    teamId = serializers.UUIDField(source="team_id", read_only=True)

    class Meta:
        model = Membership
        fields = (
            "id",
            "teamId",
            "userId",
            "email",
            "role",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[Role.ADMIN, Role.EDITOR, Role.VIEWER],
        default=Role.EDITOR,
    )

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_role(self, value: str) -> str:
        if value == Role.OWNER:
            raise serializers.ValidationError("Cannot invite as owner")
        return value


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()


class InvitationSerializer(serializers.ModelSerializer):
    teamId = serializers.UUIDField(source="team_id", read_only=True)

    class Meta:
        model = Invitation
        fields = (
            "id",
            "teamId",
            "email",
            "role",
            "expires_at",
            "accepted_at",
            "revoked_at",
            "created_at",
        )
        read_only_fields = fields
