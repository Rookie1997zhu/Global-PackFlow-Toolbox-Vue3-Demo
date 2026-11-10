"""Create / cancel calculation jobs with usage reservation."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.schemes.models import Scheme

from .adapters import build_engine_payload, input_hash, normalize_params
from .models import (
    CalculationJob,
    EngineKind,
    JobStatus,
    ReservationStatus,
    UsageReservation,
)
from .tasks import run_calculation_job

# Soft monthly quota placeholder (not billing authority)
DEFAULT_MONTHLY_QUOTA = 100


class IdempotencyKeyReuse(Exception):
    """Same Idempotency-Key reused with a different request payload."""

    def __init__(self, *, existing_job_id: str, input_hash: str):
        self.existing_job_id = existing_job_id
        self.input_hash = input_hash
        super().__init__(existing_job_id)


def _month_start():
    now = timezone.now()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _get_revision(scheme_id: str, revision_no: int | None, team_id):
    scheme = (
        Scheme.objects.select_related("current_revision", "team")
        .filter(id=scheme_id, deleted_at__isnull=True)
        .first()
    )
    if scheme is None or str(scheme.team_id) != str(team_id):
        raise Http404()
    if revision_no is None:
        rev = scheme.current_revision
    else:
        rev = scheme.revisions.filter(revision_no=revision_no).first()
    if rev is None:
        raise ValidationError({"revisionNo": ["Revision not found"]})
    return scheme, rev


@transaction.atomic
def create_job(
    *,
    team,
    user,
    scheme_id: str,
    revision_no: int | None,
    params: dict | None,
    idempotency_key: str,
) -> CalculationJob:
    key = (idempotency_key or "").strip()
    if not key:
        raise ValidationError({"Idempotency-Key": ["Required"]})

    scheme, rev = _get_revision(scheme_id, revision_no, team.id)
    norm = normalize_params(params)
    payload = build_engine_payload(list(rev.cargo_json or []), norm)
    digest = input_hash(payload)

    existing = (
        CalculationJob.objects.select_for_update()
        .filter(team=team, idempotency_key=key)
        .first()
    )
    if existing is not None:
        if existing.input_hash != digest:
            raise IdempotencyKeyReuse(
                existing_job_id=str(existing.id),
                input_hash=existing.input_hash,
            )
        return existing

    month_start = _month_start()
    settled = UsageReservation.objects.filter(
        team=team,
        status=ReservationStatus.SETTLED,
        created_at__gte=month_start,
    ).count()
    pending = UsageReservation.objects.filter(
        team=team,
        status=ReservationStatus.PENDING,
        created_at__gte=month_start,
    ).count()
    if settled + pending >= DEFAULT_MONTHLY_QUOTA:
        raise ValidationError({"usage": ["Monthly calculation quota exceeded"]})

    job = CalculationJob.objects.create(
        team=team,
        scheme_revision=rev,
        engine=EngineKind.CONTAINER,
        status=JobStatus.QUEUED,
        idempotency_key=key,
        input_hash=digest,
        input_snapshot=payload,
        params_json=norm,
        created_by=user,
    )
    UsageReservation.objects.create(team=team, job=job, units=1, status=ReservationStatus.PENDING)

    job_id = str(job.id)

    # Eager mode (tests): run task body inline — TestCase does not flush on_commit mid-test.
    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        run_calculation_job.run(job_id)
        job.refresh_from_db()
    else:
        transaction.on_commit(lambda: run_calculation_job.delay(job_id))
    return job


@transaction.atomic
def request_cancel(*, job: CalculationJob) -> CalculationJob:
    job = CalculationJob.objects.select_for_update().get(pk=job.pk)
    if job.status in {JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELED}:
        return job
    if job.status == JobStatus.QUEUED:
        job.status = JobStatus.CANCELED
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "finished_at", "updated_at"])
        res = getattr(job, "usage_reservation", None)
        if res and res.status == ReservationStatus.PENDING:
            res.status = ReservationStatus.RELEASED
            res.save(update_fields=["status", "updated_at"])
        return job
    job.status = JobStatus.CANCEL_REQUESTED
    job.save(update_fields=["status", "updated_at"])
    return job


def job_to_dict(job: CalculationJob) -> dict:
    rev = job.scheme_revision
    return {
        "jobId": str(job.id),
        "status": job.status,
        "engine": job.engine,
        "engineVersion": job.engine_version or None,
        "schemeId": rev.scheme_id if rev else None,
        "schemeRevision": rev.revision_no if rev else None,
        "inputHash": job.input_hash,
        "params": job.params_json,
        "errorCode": job.error_code or None,
        "errorMessage": job.error_message or None,
        "createdAt": job.created_at.isoformat().replace("+00:00", "Z"),
        "updatedAt": job.updated_at.isoformat().replace("+00:00", "Z"),
        "statusUrl": f"/api/v1/calculations/jobs/{job.id}/",
        "resultUrl": f"/api/v1/calculations/jobs/{job.id}/result/",
    }


def result_to_dict(job: CalculationJob) -> dict:
    data = dict(job.result_json or {})
    data.setdefault("serverVerified", job.status == JobStatus.SUCCEEDED)
    data.setdefault("engineVersion", job.engine_version or None)
    data.setdefault("inputHash", job.input_hash)
    data["jobId"] = str(job.id)
    data["status"] = job.status
    return data


def usage_summary(team) -> dict:
    settled = UsageReservation.objects.filter(
        team=team, status=ReservationStatus.SETTLED
    ).count()
    pending = UsageReservation.objects.filter(
        team=team, status=ReservationStatus.PENDING
    ).count()
    used = settled + pending
    return {
        "used": used,
        "pending": pending,
        "settled": settled,
        "quota": DEFAULT_MONTHLY_QUOTA,
        "remaining": max(0, DEFAULT_MONTHLY_QUOTA - used),
        "note": "Placeholder quota — not a billing authority",
    }
