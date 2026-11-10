"""File upload init / content / complete / download."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Role
from common.responses import ok
from common.tenancy import require_membership, require_role, user_teams_qs

from .models import FileAsset, FileAssetPurpose, FileAssetStatus
from .serializers import UploadCompleteSerializer, UploadInitSerializer
from .storage import LocalObjectStore, quarantine_key, sha256_bytes

WRITE_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR}
READ_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER}

STORE = LocalObjectStore()


def resolve_team_id(request: Request) -> str:
    team_id = (
        request.query_params.get("teamId")
        or request.headers.get("X-Team-Id")
        or (request.data.get("teamId") if hasattr(request, "data") else None)
    )
    if team_id:
        return str(team_id)
    team = user_teams_qs(request.user).order_by("created_at").first()
    if team is None:
        raise ValidationError({"teamId": ["No team available"]})
    return str(team.id)


def api_error(
    request: Request,
    *,
    code: str,
    message: str,
    http_status: int,
    errors: dict | None = None,
) -> Response:
    return Response(
        {
            "ok": False,
            "code": code,
            "message": message,
            "requestId": getattr(request, "request_id", None)
            or request.headers.get("X-Request-Id")
            or "files",
            "errors": errors or {},
        },
        status=http_status,
    )


def get_file_for_user(user, file_id) -> tuple[FileAsset, object]:
    asset = FileAsset.objects.filter(id=file_id).select_related("team").first()
    if asset is None:
        raise Http404()
    membership = require_membership(user, asset.team_id)
    return asset, membership


def sniff_format(filename: str, data: bytes) -> tuple[str, str | None]:
    """Return (mime, error_code). error_code set when format mismatch."""
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        if not (len(data) >= 4 and data[0:2] == b"PK"):
            return "", "UNSUPPORTED_FORMAT"
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", None
    if lower.endswith(".csv"):
        # Reject obvious binary / zip posing as csv
        if len(data) >= 2 and data[0:2] == b"PK":
            return "", "UNSUPPORTED_FORMAT"
        try:
            data[:4096].decode("utf-8")
        except UnicodeDecodeError:
            try:
                data[:4096].decode("cp949")
            except UnicodeDecodeError:
                return "", "UNSUPPORTED_FORMAT"
        return "text/csv", None
    return "", "UNSUPPORTED_FORMAT"


def asset_to_dict(asset: FileAsset, *, upload_url: str | None = None) -> dict:
    data = {
        "id": str(asset.id),
        "filename": asset.original_name,
        "size": asset.size or asset.declared_size,
        "mime": asset.mime,
        "status": asset.status,
        "purpose": asset.purpose,
        "sha256": asset.sha256 or None,
        "teamId": str(asset.team_id),
        "expiresAt": asset.expires_at.isoformat().replace("+00:00", "Z"),
    }
    if upload_url is not None:
        data["uploadUrl"] = upload_url
        data["uploadId"] = str(asset.id)
        data["maxBytes"] = int(getattr(settings, "PACKFLOW_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
    return data


class UploadInitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        ser = UploadInitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        max_bytes = int(getattr(settings, "PACKFLOW_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
        if data["size"] > max_bytes:
            return api_error(
                request,
                code="FILE_TOO_LARGE",
                message=f"File exceeds {max_bytes} bytes",
                http_status=status.HTTP_400_BAD_REQUEST,
                errors={"maxBytes": max_bytes, "size": data["size"]},
            )

        team_id = str(data["teamId"]) if data.get("teamId") else resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)

        asset = FileAsset.objects.create(
            team_id=team_id,
            original_name=data["filename"],
            declared_size=data["size"],
            mime=(data.get("contentType") or "").strip(),
            status=FileAssetStatus.PENDING,
            purpose=FileAssetPurpose.CARGO_IMPORT,
            uploaded_by=request.user,
            expires_at=timezone.now() + timedelta(hours=2),
        )
        upload_url = f"/api/v1/files/uploads/{asset.id}/content/"
        return ok(asset_to_dict(asset, upload_url=upload_url), status=201)


class UploadContentView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request: Request, upload_id) -> Response:
        asset, membership = get_file_for_user(request.user, upload_id)
        require_role(membership, WRITE_ROLES)

        if asset.status != FileAssetStatus.PENDING:
            raise ValidationError({"uploadId": ["Upload is not pending"]})
        if asset.is_expired:
            asset.status = FileAssetStatus.EXPIRED
            asset.save(update_fields=["status", "updated_at"])
            return api_error(
                request,
                code="UPLOAD_EXPIRED",
                message="Upload session expired",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        raw = request.body
        if request.content_type and "multipart/form-data" in request.content_type:
            f = request.FILES.get("file") or next(iter(request.FILES.values()), None)
            if f is None:
                raise ValidationError({"file": ["Missing file body"]})
            raw = f.read()

        max_bytes = int(getattr(settings, "PACKFLOW_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
        if len(raw) == 0:
            raise ValidationError({"file": ["Empty body"]})
        if len(raw) > max_bytes:
            return api_error(
                request,
                code="FILE_TOO_LARGE",
                message=f"File exceeds {max_bytes} bytes",
                http_status=status.HTTP_400_BAD_REQUEST,
                errors={"maxBytes": max_bytes, "size": len(raw)},
            )
        if asset.declared_size and abs(len(raw) - asset.declared_size) > max(
            1024, int(asset.declared_size * 0.05)
        ):
            # Soft check: allow small variance; hard reject huge mismatch
            if len(raw) > asset.declared_size * 2 or len(raw) > max_bytes:
                return api_error(
                    request,
                    code="FILE_TOO_LARGE",
                    message="Uploaded size does not match declared size",
                    http_status=status.HTTP_400_BAD_REQUEST,
                )

        key = quarantine_key(str(asset.team_id), str(asset.id), asset.original_name)
        STORE.put_bytes(key, raw)
        asset.storage_key = key
        asset.size = len(raw)
        asset.save(update_fields=["storage_key", "size", "updated_at"])
        return ok({"uploadId": str(asset.id), "bytesReceived": len(raw)})


class UploadCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        ser = UploadCompleteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        asset, membership = get_file_for_user(request.user, ser.validated_data["uploadId"])
        require_role(membership, WRITE_ROLES)

        if asset.status == FileAssetStatus.READY:
            return ok(asset_to_dict(asset))
        if asset.status != FileAssetStatus.PENDING:
            raise ValidationError({"uploadId": ["Upload cannot be completed"]})
        if asset.is_expired:
            asset.status = FileAssetStatus.EXPIRED
            asset.save(update_fields=["status", "updated_at"])
            return api_error(
                request,
                code="UPLOAD_EXPIRED",
                message="Upload session expired",
                http_status=status.HTTP_400_BAD_REQUEST,
            )
        if not asset.storage_key or not STORE.exists(asset.storage_key):
            raise ValidationError({"uploadId": ["File content missing; upload body first"]})

        data = STORE.get_bytes(asset.storage_key)
        mime, err = sniff_format(asset.original_name, data)
        if err:
            asset.status = FileAssetStatus.REJECTED
            asset.save(update_fields=["status", "updated_at"])
            return api_error(
                request,
                code=err,
                message="Unsupported or invalid file format",
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        asset.sha256 = sha256_bytes(data)
        asset.mime = mime
        asset.size = len(data)
        asset.status = FileAssetStatus.READY
        asset.save(update_fields=["sha256", "mime", "size", "status", "updated_at"])
        return ok(asset_to_dict(asset))


class FileDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, file_id) -> FileResponse:
        asset, membership = get_file_for_user(request.user, file_id)
        require_role(membership, READ_ROLES)
        if asset.status != FileAssetStatus.READY or not asset.storage_key:
            raise Http404()
        if not STORE.exists(asset.storage_key):
            raise Http404()
        path = STORE._path(asset.storage_key)
        return FileResponse(
            path.open("rb"),
            as_attachment=True,
            filename=asset.original_name,
            content_type=asset.mime or "application/octet-stream",
        )
