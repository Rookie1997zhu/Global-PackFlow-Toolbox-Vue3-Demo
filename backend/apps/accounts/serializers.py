from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from apps.organizations.models import Membership, MembershipStatus, Role, Team
from apps.organizations.serializers import MembershipSerializer, TeamSerializer

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    locale = serializers.CharField(required=False, default="ko", max_length=8)

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Email already registered")
        return email

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            locale=validated_data.get("locale") or "ko",
        )
        team = Team.objects.create(
            name="Personal",
            locale=user.locale,
            currency="KRW",
        )
        Membership.objects.create(
            team=team,
            user=user,
            role=Role.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        # ModelBackend expects USERNAME_FIELD via the `username` kwarg.
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError(
                {"email": ["Invalid email or password"]},
                code="authorization",
            )
        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "locale", "timezone", "verified_at", "date_joined")
        read_only_fields = fields


class MeSerializer(serializers.Serializer):
    def to_representation(self, user):
        memberships = (
            Membership.objects.select_related("team")
            .filter(user=user, status=MembershipStatus.ACTIVE)
            .order_by("created_at")
        )
        membership_data = MembershipSerializer(memberships, many=True).data
        current = memberships.first()
        return {
            "user": UserSerializer(user).data,
            "memberships": membership_data,
            "currentTeam": TeamSerializer(current.team).data if current else None,
        }
