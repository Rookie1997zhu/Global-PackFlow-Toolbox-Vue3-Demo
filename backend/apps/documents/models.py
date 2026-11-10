"""Document snapshots and generated reports."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


TEMPLATE_VERSION = "v1"


class DocumentKind(models.TextChoices):
    PACKING_LIST = "packing_list", "Packing List"
    COMMERCIAL_INVOICE = "commercial_invoice", "Commercial Invoice"
    DIFF = "diff", "Diff Report"


class ReportFormat(models.TextChoices):
    PDF = "pdf", "PDF"
    XLSX = "xlsx", "XLSX"


class ReportStatus(models.TextChoices):
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


class DocumentSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="document_snapshots",
    )
    scheme_revision = models.ForeignKey(
        "schemes.SchemeRevision",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_snapshots",
    )
    kind = models.CharField(max_length=32, choices=DocumentKind.choices)
    payload_json = models.JSONField(default=dict)
    template_version = models.CharField(max_length=32, default=TEMPLATE_VERSION)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_snapshots",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["team", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.id}:{self.kind}"


class Report(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    snapshot = models.ForeignKey(
        DocumentSnapshot,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    file_asset = models.ForeignKey(
        "files.FileAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    locale = models.CharField(max_length=8, default="ko")
    format = models.CharField(max_length=8, choices=ReportFormat.choices)
    status = models.CharField(
        max_length=16,
        choices=ReportStatus.choices,
        default=ReportStatus.SUCCEEDED,
    )
    job_id = models.CharField(max_length=64, blank=True, default="")  # reserved for TASK 08
    error_code = models.CharField(max_length=64, blank=True, default="")
    expires_at = models.DateTimeField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["team", "-created_at"]),
            models.Index(fields=["team", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.snapshot.kind}:{self.format}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
