"""Calculation jobs and usage reservations."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class JobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"
    CANCEL_REQUESTED = "cancel_requested", "Cancel requested"
    CANCELED = "canceled", "Canceled"


class EngineKind(models.TextChoices):
    CONTAINER = "container", "Container"


class ReservationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SETTLED = "settled", "Settled"
    RELEASED = "released", "Released"


class CalculationJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="calculation_jobs",
    )
    scheme_revision = models.ForeignKey(
        "schemes.SchemeRevision",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calculation_jobs",
    )
    engine = models.CharField(max_length=32, choices=EngineKind.choices, default=EngineKind.CONTAINER)
    engine_version = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=32, choices=JobStatus.choices, default=JobStatus.QUEUED)
    idempotency_key = models.CharField(max_length=128)
    input_hash = models.CharField(max_length=64)
    input_snapshot = models.JSONField(default=dict)
    params_json = models.JSONField(default=dict, blank=True)
    result_json = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=64, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calculation_jobs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "idempotency_key"],
                name="uniq_team_idempotency_key",
            )
        ]
        indexes = [
            models.Index(fields=["team", "-created_at"]),
            models.Index(fields=["team", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.engine}:{self.status}"


class UsageReservation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="usage_reservations",
    )
    job = models.OneToOneField(
        CalculationJob,
        on_delete=models.CASCADE,
        related_name="usage_reservation",
    )
    units = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=16,
        choices=ReservationStatus.choices,
        default=ReservationStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
