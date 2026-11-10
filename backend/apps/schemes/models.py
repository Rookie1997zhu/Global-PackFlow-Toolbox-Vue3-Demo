"""Team-scoped cargo schemes with immutable revisions."""

from __future__ import annotations

import hashlib
import json
import uuid

from django.conf import settings
from django.db import models


def new_scheme_id() -> str:
    return f"sch_{uuid.uuid4().hex[:16]}"


def hash_cargo_meta(cargo: list, meta: dict | None) -> str:
    payload = json.dumps(
        {"cargo": cargo, "meta": meta or {}},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class Scheme(models.Model):
    id = models.CharField(primary_key=True, max_length=40, default=new_scheme_id, editable=False)
    team = models.ForeignKey(
        "organizations.Team",
        on_delete=models.CASCADE,
        related_name="schemes",
    )
    name = models.CharField(max_length=200)
    locale = models.CharField(max_length=8, blank=True, default="ko")
    row_version = models.PositiveIntegerField(default=1)
    current_revision = models.ForeignKey(
        "SchemeRevision",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    legacy_id = models.CharField(max_length=80, blank=True, default="", db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["team", "-updated_at"]),
            models.Index(fields=["team", "legacy_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.id}:{self.name}"


class SchemeRevision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme = models.ForeignKey(Scheme, on_delete=models.CASCADE, related_name="revisions")
    revision_no = models.PositiveIntegerField()
    schema_version = models.PositiveSmallIntegerField(default=1)
    cargo_json = models.JSONField(default=list)
    meta_json = models.JSONField(default=dict, blank=True)
    content_hash = models.CharField(max_length=64)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheme_revisions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-revision_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["scheme", "revision_no"],
                name="uniq_scheme_revision_no",
            )
        ]

    def __str__(self) -> str:
        return f"{self.scheme_id}#r{self.revision_no}"
