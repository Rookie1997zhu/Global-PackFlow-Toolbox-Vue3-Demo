"""Import batches linking uploaded files to scheme revisions."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class ImportBatchStatus(models.TextChoices):
    PREVIEW = "preview", "Preview"
    COMMITTED = "committed", "Committed"
    FAILED = "failed", "Failed"


class ImportBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="import_batches",
    )
    file = models.ForeignKey(
        "files.FileAsset",
        on_delete=models.PROTECT,
        related_name="import_batches",
    )
    mapping_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16,
        choices=ImportBatchStatus.choices,
        default=ImportBatchStatus.PREVIEW,
    )
    issues_json = models.JSONField(default=list, blank=True)
    preview_json = models.JSONField(default=dict, blank=True)
    target_scheme = models.ForeignKey(
        "schemes.Scheme",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_targets",
    )
    result_scheme = models.ForeignKey(
        "schemes.Scheme",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_results",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    committed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["team", "-created_at"]),
            models.Index(fields=["file"]),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.status}"
