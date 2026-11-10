"""Report list / create / detail / download."""

from __future__ import annotations

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.files.storage import LocalObjectStore
from apps.files.views import WRITE_ROLES, api_error, resolve_team_id
from apps.organizations.models import Role
from common.responses import ok
from common.tenancy import require_membership, require_role

from .models import Report, ReportStatus
from .serializers import ReportCreateSerializer
from .services import create_report, report_to_dict

READ_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER}
STORE = LocalObjectStore()


def _get_report(user, report_id) -> tuple[Report, object]:
    report = (
        Report.objects.select_related(
            "snapshot",
            "snapshot__scheme_revision",
            "file_asset",
            "team",
        )
        .filter(id=report_id)
        .first()
    )
    if report is None:
        raise Http404()
    membership = require_membership(user, report.team_id)
    return report, membership


class ReportListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        team_id = resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, READ_ROLES)
        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = min(max(int(request.query_params.get("pageSize", 20)), 1), 100)
        except ValueError:
            page, page_size = 1, 20
        qs = Report.objects.filter(team_id=team_id).select_related(
            "snapshot", "snapshot__scheme_revision", "file_asset"
        )
        total = qs.count()
        start = (page - 1) * page_size
        items = [report_to_dict(r) for r in qs.order_by("-created_at")[start : start + page_size]]
        return ok({"items": items, "page": page, "pageSize": page_size, "total": total})

    def post(self, request: Request) -> Response:
        ser = ReportCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        team_id = str(data["teamId"]) if data.get("teamId") else resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)

        report = create_report(
            team=membership.team,
            user=request.user,
            kind=data["kind"],
            fmt=data["format"],
            locale=data.get("locale") or "ko",
            scheme_id=data.get("schemeId") or None,
            revision_no=data.get("revisionNo"),
            data=data,
        )
        return ok(report_to_dict(report), status=status.HTTP_201_CREATED)


class ReportDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, report_id) -> Response:
        report, membership = _get_report(request.user, report_id)
        require_role(membership, READ_ROLES)
        return ok(report_to_dict(report))


class ReportDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, report_id):
        report, membership = _get_report(request.user, report_id)
        require_role(membership, READ_ROLES)
        if report.status != ReportStatus.SUCCEEDED or not report.file_asset_id:
            raise Http404()
        if report.is_expired or (report.file_asset and report.file_asset.is_expired):
            return api_error(
                request,
                code="REPORT_EXPIRED",
                message="Report download expired",
                http_status=status.HTTP_410_GONE,
            )
        asset = report.file_asset
        if asset is None or not asset.storage_key or not STORE.exists(asset.storage_key):
            raise Http404()
        path = STORE._path(asset.storage_key)
        return FileResponse(
            path.open("rb"),
            as_attachment=True,
            filename=asset.original_name,
            content_type=asset.mime or "application/octet-stream",
        )
