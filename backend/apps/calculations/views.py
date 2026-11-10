"""Calculation job and usage endpoints."""

from __future__ import annotations

from django.http import Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.files.views import WRITE_ROLES, resolve_team_id
from apps.organizations.models import Role
from common.responses import ok
from common.tenancy import require_membership, require_role

from .models import CalculationJob, JobStatus
from .serializers import JobCreateSerializer
from .services import (
    create_job,
    job_to_dict,
    request_cancel,
    result_to_dict,
    usage_summary,
)

READ_ROLES = {Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER}


def _get_job(user, job_id) -> tuple[CalculationJob, object]:
    job = (
        CalculationJob.objects.select_related("scheme_revision", "team", "usage_reservation")
        .filter(id=job_id)
        .first()
    )
    if job is None:
        raise Http404()
    membership = require_membership(user, job.team_id)
    return job, membership


class JobListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        ser = JobCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        team_id = str(data["teamId"]) if data.get("teamId") else resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, WRITE_ROLES)

        idem = request.headers.get("Idempotency-Key") or request.headers.get("idempotency-key")
        job = create_job(
            team=membership.team,
            user=request.user,
            scheme_id=data["schemeId"],
            revision_no=data.get("schemeRevision"),
            params=data.get("params"),
            idempotency_key=str(idem or ""),
        )
        return ok(job_to_dict(job), status=status.HTTP_202_ACCEPTED)


class JobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, job_id) -> Response:
        job, membership = _get_job(request.user, job_id)
        require_role(membership, READ_ROLES)
        return ok(job_to_dict(job))


class JobCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, job_id) -> Response:
        job, membership = _get_job(request.user, job_id)
        require_role(membership, WRITE_ROLES)
        job = request_cancel(job=job)
        return ok(job_to_dict(job))


class JobResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, job_id) -> Response:
        job, membership = _get_job(request.user, job_id)
        require_role(membership, READ_ROLES)
        if job.status != JobStatus.SUCCEEDED:
            return ok(
                {
                    "jobId": str(job.id),
                    "status": job.status,
                    "serverVerified": False,
                    "message": "Result not ready",
                }
            )
        return ok(result_to_dict(job))


class UsageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        team_id = resolve_team_id(request)
        membership = require_membership(request.user, team_id)
        require_role(membership, READ_ROLES)
        return ok(usage_summary(membership.team))
