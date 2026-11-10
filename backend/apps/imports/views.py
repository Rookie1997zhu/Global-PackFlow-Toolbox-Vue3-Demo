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
from apps.files.views import WRITE_ROLES, api_error
from apps.schemes.models import Scheme
from common.responses import ok
from common.tenancy import require_membership, require_role

from .models import ImportBatch
from .serializers import ImportCommitSerializer, ImportPreviewSerializer
from .services import (
    ImportConflictError,
    batch_to_preview_dict,
    commit_batch,
    create_preview_batch,
)


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

        try:
            result = commit_batch(
                batch=batch,
                user=request.user,
                name=data.get("name"),
                mapping=data.get("mapping"),
                target_scheme=target,
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
        return ok(
            {
                "import": result["batch"],
                "scheme": result["scheme"],
                "cargo": result["cargo"],
            }
        )
