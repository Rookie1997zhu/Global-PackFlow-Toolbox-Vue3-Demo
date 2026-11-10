"""Team-scoped private file assets (upload quarantine → ready)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class FileAssetStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    READY = "ready", "Ready"
    REJECTED = "rejected", "Rejected"
    EXPIRED = "expired", "Expired"


class FileAssetPurpose(models.TextChoices):
    CARGO_IMPORT = "cargo_import", "Cargo import"
    REPORT = "report", "Report"


class FileAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="file_assets",
    )
    original_name = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=512, blank=True, default="")
    sha256 = models.CharField(max_length=64, blank=True, default="")
    size = models.BigIntegerField(default=0)
    declared_size = models.BigIntegerField(default=0)
    mime = models.CharField(max_length=128, blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=FileAssetStatus.choices,
        default=FileAssetStatus.PENDING,
    )
    purpose = models.CharField(
        max_length=32,
        choices=FileAssetPurpose.choices,
        default=FileAssetPurpose.CARGO_IMPORT,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_files",
    )
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["team", "-created_at"]),
            models.Index(fields=["team", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.original_name}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
