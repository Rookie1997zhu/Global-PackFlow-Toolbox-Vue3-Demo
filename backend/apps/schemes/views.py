"""Scheme REST endpoints."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Role
from common.responses import ok
from common.tenancy import require_membership, require_role, user_teams_qs

from .models import Scheme
from .serializers import SchemeImportSerializer, SchemeWriteSerializer
from .services import (
    SchemeVersionConflict,
    append_revision,
    create_scheme,
    restore_revision,
    scheme_to_document,
)

WRITE_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR}
READ_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER}


def _resolve_team_id(request: Request) -> str:
    team_id = (
        request.query_params.get("teamId")
        or request.headers.get("X-Team-Id")
        or request.data.get("teamId")
    )
    if team_id:
        return str(team_id)
    # Default to first personal/active membership team
    team = user_teams_qs(request.user).order_by("created_at").first()
    if team is None:
        raise ValidationError({"teamId": ["No team available"]})
    return str(team.id)


def _get_scheme_for_user(user, scheme_id: str) -> tuple[Scheme, object]:
    scheme = (
        Scheme.objects.select_related("current_revision", "team")
        .filter(id=scheme_id, deleted_at__isnull=True)
        .first()
    )
    if scheme is None:
        raise Http404()
    membership = require_membership(user, scheme.team_id)
    return scheme, membership


def _conflict(request: Request, expected: int, current: int) -> Response:
    return Response(
        {
            "ok": False,
            "code": "SCHEME_VERSION_CONFLICT",
            "message": "Scheme was modified by another member",
            "requestId": getattr(request, "request_id", None) or "scheme",
            "errors": {"expected": expected, "current": current},
        },
        status=status.HTTP_409_CONFLICT,
    )


def _expected_row_version(request: Request, data: dict) -> int | None:
    header = request.headers.get("If-Match")
    if header is not None and str(header).strip() != "":
        try:
            return int(str(header).strip().strip('"'))
        except ValueError as exc:
            raise ValidationError({"If-Match": ["must be an integer rowVersion"]}) from exc
    if "rowVersion" in data and data["rowVersion"] is not None:
        return int(data["rowVersion"])
    return None


class SchemeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        team_id = _resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, READ_ROLES)

        qs = Scheme.objects.filter(team_id=team_id, deleted_at__isnull=True).select_related(
            "current_revision"
        )
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(id__icontains=q))

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = min(max(int(request.query_params.get("pageSize", 20)), 1), 100)
        except ValueError as exc:
            raise ValidationError({"page": ["invalid pagination"]}) from exc

        total = qs.count()
        start = (page - 1) * page_size
        items = [scheme_to_document(s) for s in qs.order_by("-updated_at")[start : start + page_size]]
        return ok(
            {
                "items": items,
                "page": page,
                "pageSize": page_size,
                "total": total,
            }
        )

    @transaction.atomic
    def post(self, request: Request):
        team_id = _resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)

        serializer = SchemeWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        scheme = create_scheme(
            team=membership.team,
            user=request.user,
            name=data["name"],
            locale=data.get("locale") or "ko",
            cargo=data["cargo"],
            meta=data.get("meta") or {},
            legacy_id=str(data.get("id") or ""),
        )
        return ok(scheme_to_document(scheme), status=status.HTTP_201_CREATED)


class SchemeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, scheme_id: str):
        scheme, membership = _get_scheme_for_user(request.user, scheme_id)
        require_role(membership, READ_ROLES)
        return ok(scheme_to_document(scheme))

    @transaction.atomic
    def put(self, request: Request, scheme_id: str):
        scheme, membership = _get_scheme_for_user(request.user, scheme_id)
        require_role(membership, WRITE_ROLES)

        serializer = SchemeWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        expected = _expected_row_version(request, data)
        if expected is None:
            raise ValidationError(
                {"rowVersion": ["required via If-Match header or body.rowVersion"]}
            )
        # Fast path only; authoritative check is inside select_for_update.
        if expected != scheme.row_version:
            return _conflict(request, expected, scheme.row_version)

        try:
            scheme = append_revision(
                scheme=scheme,
                user=request.user,
                name=data["name"],
                locale=data.get("locale") or scheme.locale,
                cargo=data["cargo"],
                meta=data.get("meta") or {},
                expected_row_version=expected,
            )
        except SchemeVersionConflict as exc:
            return _conflict(request, exc.expected, exc.current)
        return ok(scheme_to_document(scheme))

    @transaction.atomic
    def delete(self, request: Request, scheme_id: str):
        scheme, membership = _get_scheme_for_user(request.user, scheme_id)
        require_role(membership, WRITE_ROLES)
        scheme.deleted_at = timezone.now()
        scheme.save(update_fields=["deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SchemeRevisionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, scheme_id: str):
        scheme, membership = _get_scheme_for_user(request.user, scheme_id)
        require_role(membership, READ_ROLES)
        items = [
            {
                "revisionNo": r.revision_no,
                "schemaVersion": r.schema_version,
                "contentHash": r.content_hash,
                "createdAt": r.created_at.isoformat().replace("+00:00", "Z"),
                "creatorId": str(r.creator_id) if r.creator_id else None,
            }
            for r in scheme.revisions.order_by("-revision_no")[:100]
        ]
        return ok({"items": items})


class SchemeRevisionRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request: Request, scheme_id: str, rev: int):
        scheme, membership = _get_scheme_for_user(request.user, scheme_id)
        require_role(membership, WRITE_ROLES)
        updated = restore_revision(scheme=scheme, user=request.user, revision_no=rev)
        if updated is None:
            raise NotFound(detail="Revision not found")
        return ok(scheme_to_document(updated))


class SchemeImportDemoView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request: Request):
        team_id = _resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)

        serializer = SchemeImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        legacy_id = str(data.get("id") or "").strip()

        if legacy_id:
            existing = Scheme.objects.filter(
                team_id=team_id,
                legacy_id=legacy_id,
                deleted_at__isnull=True,
            ).select_related("current_revision").first()
            if existing:
                return ok(
                    {
                        **scheme_to_document(existing),
                        "imported": False,
                        "deduped": True,
                    }
                )

        scheme = create_scheme(
            team=membership.team,
            user=request.user,
            name=data["name"],
            locale=data.get("locale") or "ko",
            cargo=data["cargo"],
            meta=data.get("meta") or {},
            legacy_id=legacy_id,
        )
        return ok(
            {**scheme_to_document(scheme), "imported": True, "deduped": False},
            status=status.HTTP_201_CREATED,
        )
