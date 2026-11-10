"""Import preview / commit endpoints."""

from __future__ import annotations

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.files.models import FileAsset, FileAssetStatus
from apps.files.views import WRITE_ROLES, api_error, resolve_team_id
from apps.organizations.models import Role
from apps.schemes.models import Scheme
from apps.shipments.models import Shipment
from common.responses import ok
from common.tenancy import require_membership, require_role

from .models import ImportBatch, MappingTemplate
from .serializers import ImportCommitSerializer, ImportPreviewSerializer, MappingTemplateSerializer
from .services import (
    ImportConflictError,
    batch_to_preview_dict,
    commit_batch,
    create_preview_batch,
    template_to_dict,
    upsert_mapping_template,
)

READ_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER}


def _get_ready_file(user, file_id) -> tuple[FileAsset, object]:
    asset = FileAsset.objects.filter(id=file_id).select_related("team").first()
    if asset is None:
        raise Http404()
    membership = require_membership(user, asset.team_id)
    if asset.status != FileAssetStatus.READY:
        raise ValidationError({"fileId": ["File is not ready"]})
    return asset, membership


def _get_batch(user, import_id) -> tuple[ImportBatch, object]:
    batch = (
        ImportBatch.objects.select_related("file", "team", "result_scheme")
        .filter(id=import_id)
        .first()
    )
    if batch is None:
        raise Http404()
    membership = require_membership(user, batch.team_id)
    return batch, membership


class ImportPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        ser = ImportPreviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        asset, membership = _get_ready_file(request.user, data["fileId"])
        require_role(membership, WRITE_ROLES)
        if data.get("teamId") and str(data["teamId"]) != str(asset.team_id):
            raise Http404()
        batch = create_preview_batch(
            team=asset.team,
            user=request.user,
            asset=asset,
            mapping=data.get("mapping"),
            sheet_index=data.get("sheetIndex"),
        )
        return ok(batch_to_preview_dict(batch), status=201)


class ImportCommitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, import_id) -> Response:
        ser = ImportCommitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        batch, membership = _get_batch(request.user, import_id)
        require_role(membership, WRITE_ROLES)

        target = None
        target_id = (data.get("targetSchemeId") or "").strip()
        if target_id:
            target = (
                Scheme.objects.filter(id=target_id, deleted_at__isnull=True)
                .select_related("current_revision")
                .first()
            )
            if target is None:
                raise Http404()
            require_membership(request.user, target.team_id)
            if str(target.team_id) != str(batch.team_id):
                raise Http404()

        target_shipment = None
        ship_id = (data.get("targetShipmentId") or "").strip()
        if ship_id:
            target_shipment = (
                Shipment.objects.filter(id=ship_id, deleted_at__isnull=True)
                .select_related("current_revision")
                .first()
            )
            if target_shipment is None:
                raise Http404()
            require_membership(request.user, target_shipment.team_id)
            if str(target_shipment.team_id) != str(batch.team_id):
                raise Http404()

        target_kind = data.get("target") or ("shipment" if target_shipment else "scheme")

        try:
            result = commit_batch(
                batch=batch,
                user=request.user,
                name=data.get("name"),
                mapping=data.get("mapping"),
                target_scheme=target,
                target_shipment=target_shipment,
                target=target_kind,
                shipment_no=data.get("shipmentNo"),
                sheet_index=data.get("sheetIndex"),
            )
        except ImportConflictError:
            return api_error(
                request,
                code="IMPORT_CONFLICT",
                message="This file was already imported",
                http_status=status.HTTP_409_CONFLICT,
            )

        if not result.get("ok"):
            return api_error(
                request,
                code=result.get("code") or "IMPORT_REQUIRED_FIELD_MISSING",
                message="Import blocked by row issues; no default dimensions applied",
                http_status=status.HTTP_400_BAD_REQUEST,
                errors={"issues": result.get("issues") or []},
            )
        payload = {
            "import": result["batch"],
            "skippedRows": result.get("skippedRows") or 0,
            "issues": result.get("issues") or [],
        }
        if "scheme" in result:
            payload["scheme"] = result["scheme"]
            payload["cargo"] = result.get("cargo") or []
        if "shipment" in result:
            payload["shipment"] = result["shipment"]
        return ok(payload)


class MappingTemplateListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        team_id = resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, READ_ROLES)
        items = [
            template_to_dict(t)
            for t in MappingTemplate.objects.filter(team_id=team_id).order_by("-updated_at")[:100]
        ]
        return ok({"items": items})

    def post(self, request: Request) -> Response:
        ser = MappingTemplateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        team_id = str(data["teamId"]) if data.get("teamId") else resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)
        tpl = upsert_mapping_template(
            team=membership.team,
            user=request.user,
            name=data["name"],
            mapping=data["mapping"],
            sheet_hint=data.get("sheetHint") or "",
        )
        return ok(template_to_dict(tpl), status=status.HTTP_201_CREATED)


class MappingTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, user, template_id) -> tuple[MappingTemplate, object]:
        tpl = MappingTemplate.objects.filter(id=template_id).select_related("team").first()
        if tpl is None:
            raise Http404()
        membership = require_membership(user, tpl.team_id)
        return tpl, membership

    def get(self, request: Request, template_id) -> Response:
        tpl, membership = self._get(request.user, template_id)
        require_role(membership, READ_ROLES)
        return ok(template_to_dict(tpl))

    def put(self, request: Request, template_id) -> Response:
        tpl, membership = self._get(request.user, template_id)
        require_role(membership, WRITE_ROLES)
        ser = MappingTemplateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        tpl.name = data["name"].strip()
        tpl.mapping_json = data["mapping"]
        tpl.sheet_hint = data.get("sheetHint") or ""
        tpl.save(update_fields=["name", "mapping_json", "sheet_hint", "updated_at"])
        return ok(template_to_dict(tpl))

    def delete(self, request: Request, template_id) -> Response:
        tpl, membership = self._get(request.user, template_id)
        require_role(membership, WRITE_ROLES)
        tpl.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
