"""Celery tasks for calculation jobs."""

from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from .engine_client import call_pack_container
from .models import CalculationJob, JobStatus, ReservationStatus, UsageReservation


@shared_task(bind=True, max_retries=0, name="calculations.run_job")
def run_calculation_job(self, job_id: str) -> None:
    job = CalculationJob.objects.select_related("usage_reservation").filter(id=job_id).first()
    if job is None:
        return
    if job.status == JobStatus.CANCEL_REQUESTED:
        job.status = JobStatus.CANCELED
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "finished_at", "updated_at"])
        _release(job)
        return
    if job.status not in {JobStatus.QUEUED, JobStatus.RUNNING}:
        return

    job.status = JobStatus.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])

    try:
        engine_body = call_pack_container(job.input_snapshot)
        if job.status == JobStatus.CANCEL_REQUESTED:
            # re-check cancel
            job.refresh_from_db()
        job.refresh_from_db()
        if job.status == JobStatus.CANCEL_REQUESTED:
            job.status = JobStatus.CANCELED
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "finished_at", "updated_at"])
            _release(job)
            return
        result = engine_body.get("result") or {}
        job.result_json = {
            "serverVerified": True,
            "engineVersion": engine_body.get("engineVersion") or "container-1.0.0",
            "inputHash": job.input_hash,
            "pack": result,
        }
        job.engine_version = str(engine_body.get("engineVersion") or "container-1.0.0")
        job.status = JobStatus.SUCCEEDED
        job.finished_at = timezone.now()
        job.error_code = ""
        job.error_message = ""
        job.save(
            update_fields=[
                "result_json",
                "engine_version",
                "status",
                "finished_at",
                "error_code",
                "error_message",
                "updated_at",
            ]
        )
        _settle(job)
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.FAILED
        job.error_code = "ENGINE_ERROR"
        job.error_message = str(exc)[:2000]
        job.finished_at = timezone.now()
        job.save(
            update_fields=[
                "status",
                "error_code",
                "error_message",
                "finished_at",
                "updated_at",
            ]
        )
        _release(job)


def _settle(job: CalculationJob) -> None:
    res = getattr(job, "usage_reservation", None)
    if res and res.status == ReservationStatus.PENDING:
        res.status = ReservationStatus.SETTLED
        res.save(update_fields=["status", "updated_at"])


def _release(job: CalculationJob) -> None:
    res = getattr(job, "usage_reservation", None)
    if res and res.status == ReservationStatus.PENDING:
        res.status = ReservationStatus.RELEASED
        res.save(update_fields=["status", "updated_at"])
