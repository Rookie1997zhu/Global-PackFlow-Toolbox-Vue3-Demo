"""Team-scoped shipments with immutable revisions."""

from __future__ import annotations

import hashlib
import json
import uuid

from django.conf import settings
from django.db import models


def new_shipment_id() -> str:
    return f"shp_{uuid.uuid4().hex[:16]}"


def hash_payload(payload: dict | None) -> str:
    raw = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ShipmentStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    READY = "ready", "Ready"
    CONFIRMED = "confirmed", "Confirmed"
    SHIPPED = "shipped", "Shipped"
    ARCHIVED = "archived", "Archived"


class DocumentPurpose(models.TextChoices):
    PL = "pl", "Packing List"
    CI = "ci", "Commercial Invoice"
    DIFF = "diff", "Diff"


class PlanType(models.TextChoices):
    CONTAINER = "container", "Container"
    PALLET = "pallet", "Pallet"
    OTHER = "other", "Other"


class Shipment(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=new_shipment_id, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="shipments",
    )
    shipment_no = models.CharField(max_length=64)
    status = models.CharField(
        max_length=16,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.DRAFT,
    )
    row_version = models.PositiveIntegerField(default=1)
    current_revision = models.ForeignKey(
        "ShipmentRevision",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipments_created",
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "shipment_no"],
                name="uniq_team_shipment_no",
            )
        ]
        indexes = [
            models.Index(fields=["team", "-updated_at"]),
            models.Index(fields=["team", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.shipment_no}"


class ShipmentRevision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="revisions")
    revision_no = models.PositiveIntegerField()
    schema_version = models.PositiveSmallIntegerField(default=1)
    payload_json = models.JSONField(default=dict)
    content_hash = models.CharField(max_length=64)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipment_revisions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-revision_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["shipment", "revision_no"],
                name="uniq_shipment_revision_no",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shipment_id}#r{self.revision_no}"


class ShipmentDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="documents")
    revision = models.ForeignKey(
        ShipmentRevision,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    snapshot = models.ForeignKey(
        "documents.DocumentSnapshot",
        on_delete=models.CASCADE,
        related_name="shipment_links",
    )
    purpose = models.CharField(max_length=16, choices=DocumentPurpose.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["shipment", "-created_at"])]


class ShipmentPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="plans")
    revision = models.ForeignKey(
        ShipmentRevision,
        on_delete=models.CASCADE,
        related_name="plans",
    )
    calculation_job = models.ForeignKey(
        "calculations.CalculationJob",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipment_plans",
    )
    plan_type = models.CharField(max_length=32, choices=PlanType.choices, default=PlanType.CONTAINER)
    label = models.CharField(max_length=200, blank=True, default="")
    parameters_json = models.JSONField(default=dict, blank=True)
    input_hash = models.CharField(max_length=64, blank=True, default="")
    result_hash = models.CharField(max_length=64, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipment_plans_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["shipment", "-created_at"])]


class ShipmentEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=64)
    reason = models.TextField(blank=True, default="")
    meta_json = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipment_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["shipment", "-created_at"])]
