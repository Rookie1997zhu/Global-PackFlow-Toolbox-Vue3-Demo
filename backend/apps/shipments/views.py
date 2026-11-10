"""Shipment REST endpoints."""

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

from .models import Shipment, ShipmentStatus
from .serializers import (
    ShipmentCreateSerializer,
    ShipmentPlanSerializer,
    ShipmentReportSerializer,
    ShipmentStatusSerializer,
    ShipmentWriteSerializer,
)
from .services import (
    ShipmentVersionConflict,
    append_revision,
    create_shipment,
    create_shipment_report,
    document_link_to_dict,
    link_plan,
    plan_to_dict,
    restore_revision,
    shipment_to_document,
    transition_status,
)

WRITE_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR}
READ_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER}
CONFIRM_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR}


def _resolve_team_id(request: Request) -> str:
    team_id = (
        request.query_params.get("teamId")
        or request.headers.get("X-Team-Id")
        or request.data.get("teamId")
    )
    if team_id:
        return str(team_id)
    team = user_teams_qs(request.user).order_by("created_at").first()
    if team is None:
        raise ValidationError({"teamId": ["No team available"]})
    return str(team.id)


def _get_shipment_for_user(user, shipment_id: str) -> tuple[Shipment, object]:
    shipment = (
        Shipment.objects.select_related("current_revision", "team")
        .filter(id=shipment_id, deleted_at__isnull=True)
        .first()
    )
    if shipment is None:
        raise Http404()
    membership = require_membership(user, shipment.team_id)
    return shipment, membership


def _conflict(request: Request, expected: int, current: int) -> Response:
    return Response(
        {
            "ok": False,
            "code": "SHIPMENT_VERSION_CONFLICT",
            "message": "Shipment was modified by another member",
            "requestId": getattr(request, "request_id", None) or "shipment",
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


class ShipmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        team_id = _resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, READ_ROLES)

        qs = Shipment.objects.filter(team_id=team_id, deleted_at__isnull=True).select_related(
            "current_revision"
        )
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(shipment_no__icontains=q) | Q(id__icontains=q))

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = min(max(int(request.query_params.get("pageSize", 20)), 1), 100)
        except ValueError as exc:
            raise ValidationError({"page": ["invalid pagination"]}) from exc

        total = qs.count()
        start = (page - 1) * page_size
        items = [
            shipment_to_document(s) for s in qs.order_by("-updated_at")[start : start + page_size]
        ]
        return ok({"items": items, "page": page, "pageSize": page_size, "total": total})

    @transaction.atomic
    def post(self, request: Request) -> Response:
        team_id = _resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)

        ser = ShipmentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        shipment = create_shipment(
            team=membership.team,
            user=request.user,
            shipment_no=data["shipmentNo"],
            payload=data.get("payload"),
        )
        return ok(shipment_to_document(shipment), status=status.HTTP_201_CREATED)


class ShipmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, READ_ROLES)
        return ok(shipment_to_document(shipment))

    @transaction.atomic
    def put(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, WRITE_ROLES)

        ser = ShipmentWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        expected = _expected_row_version(request, data)
        if expected is None:
            raise ValidationError(
                {"rowVersion": ["required via If-Match header or body.rowVersion"]}
            )
        if expected != shipment.row_version:
            return _conflict(request, expected, shipment.row_version)

        try:
            shipment = append_revision(
                shipment=shipment,
                user=request.user,
                payload=data.get("payload")
                or (shipment.current_revision.payload_json if shipment.current_revision else {}),
                expected_row_version=expected,
                shipment_no=data.get("shipmentNo"),
                reason=data.get("reason") or "",
            )
        except ShipmentVersionConflict as exc:
            return _conflict(request, exc.expected, exc.current)
        return ok(shipment_to_document(shipment))

    @transaction.atomic
    def delete(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, WRITE_ROLES)
        shipment.deleted_at = timezone.now()
        shipment.status = ShipmentStatus.ARCHIVED
        shipment.archived_at = timezone.now()
        shipment.save(update_fields=["deleted_at", "status", "archived_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ShipmentRevisionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, READ_ROLES)
        items = [
            {
                "revisionNo": r.revision_no,
                "schemaVersion": r.schema_version,
                "contentHash": r.content_hash,
                "createdAt": r.created_at.isoformat().replace("+00:00", "Z"),
                "creatorId": str(r.creator_id) if r.creator_id else None,
            }
            for r in shipment.revisions.order_by("-revision_no")[:100]
        ]
        return ok({"items": items})


class ShipmentRevisionRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request: Request, shipment_id: str, rev: int) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, WRITE_ROLES)
        updated = restore_revision(shipment=shipment, user=request.user, revision_no=rev)
        if updated is None:
            raise NotFound(detail="Revision not found")
        return ok(shipment_to_document(updated))


class ShipmentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        ser = ShipmentStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        to_status = data["status"]
        if to_status in {ShipmentStatus.CONFIRMED, ShipmentStatus.SHIPPED, ShipmentStatus.READY}:
            require_role(membership, CONFIRM_ROLES)
        else:
            require_role(membership, WRITE_ROLES)

        expected = _expected_row_version(request, data)
        try:
            shipment = transition_status(
                shipment=shipment,
                user=request.user,
                to_status=to_status,
                reason=data.get("reason") or "",
                expected_row_version=expected,
            )
        except ShipmentVersionConflict as exc:
            return _conflict(request, exc.expected, exc.current)
        return ok(shipment_to_document(shipment))


class ShipmentReportView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, WRITE_ROLES)
        ser = ShipmentReportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        dto = create_shipment_report(
            shipment=shipment,
            user=request.user,
            kind=data["kind"],
            fmt=data["format"],
            locale=data.get("locale") or "ko",
            formal=bool(data.get("formal", True)),
        )
        return ok(dto, status=status.HTTP_201_CREATED)


class ShipmentDocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, READ_ROLES)
        items = [
            document_link_to_dict(d)
            for d in shipment.documents.select_related("revision").order_by("-created_at")[:100]
        ]
        return ok({"items": items})


class ShipmentPlanListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, READ_ROLES)
        items = [
            plan_to_dict(p)
            for p in shipment.plans.select_related("revision").order_by("-created_at")[:100]
        ]
        return ok({"items": items})

    @transaction.atomic
    def post(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, WRITE_ROLES)
        ser = ShipmentPlanSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        plan = link_plan(
            shipment=shipment,
            user=request.user,
            calculation_job_id=str(data["calculationJobId"]) if data.get("calculationJobId") else None,
            plan_type=data.get("planType") or "container",
            label=data.get("label") or "",
            parameters=data.get("parameters"),
        )
        return ok(plan_to_dict(plan), status=status.HTTP_201_CREATED)


class ShipmentEventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, shipment_id: str) -> Response:
        shipment, membership = _get_shipment_for_user(request.user, shipment_id)
        require_role(membership, READ_ROLES)
        items = [
            {
                "id": str(e.id),
                "eventType": e.event_type,
                "reason": e.reason,
                "meta": e.meta_json or {},
                "actorId": str(e.actor_id) if e.actor_id else None,
                "createdAt": e.created_at.isoformat().replace("+00:00", "Z"),
            }
            for e in shipment.events.order_by("-created_at")[:100]
        ]
        return ok({"items": items})
