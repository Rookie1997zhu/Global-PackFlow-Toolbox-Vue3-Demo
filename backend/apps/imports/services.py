"""Import preview and commit orchestration."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.files.models import FileAsset, FileAssetStatus
from apps.files.storage import LocalObjectStore
from apps.schemes.services import append_revision, create_scheme, scheme_to_document

from .mapping import (
    BLOCKING_ISSUE_CODES,
    apply_mapping,
    detect_column_mapping,
    rows_to_cargo,
    validate_mapped_rows,
)
from .models import ImportBatch, ImportBatchStatus
from .parsing import load_table, preview_table

STORE = LocalObjectStore()


def _load_file_table(asset: FileAsset) -> list[list[str]]:
    if asset.status != FileAssetStatus.READY or not asset.storage_key:
        raise ValidationError({"fileId": ["File is not ready"]})
    data = STORE.get_bytes(asset.storage_key)
    try:
        table = load_table(asset.original_name, data)
    except Exception as exc:  # noqa: BLE001 — surface as workbook error
        raise ValidationError({"fileId": [f"INVALID_WORKBOOK: {exc}"]}) from exc
    max_rows = int(getattr(settings, "PACKFLOW_MAX_IMPORT_ROWS", 2000))
    # header + data rows
    if len(table) - 1 > max_rows:
        raise ValidationError({"fileId": [f"Row count exceeds {max_rows}"]})
    return table


def build_preview(asset: FileAsset, mapping: dict | None = None) -> dict:
    table = _load_file_table(asset)
    if not table:
        raise ValidationError({"fileId": ["Workbook is empty"]})
    headers = [str(h) for h in table[0]]
    suggested = detect_column_mapping(headers)
    effective = mapping if mapping else suggested
    # coerce keys/values
    effective = {str(k): int(v) for k, v in effective.items()}
    mapped = apply_mapping(table, effective)
    issues = validate_mapped_rows(mapped)
    return {
        "headers": headers,
        "suggestedMapping": suggested,
        "mapping": effective,
        "issues": issues,
        "previewRows": preview_table(table, 10),
        "rowCount": max(0, len(table) - 1),
        "mappedSample": mapped[:10],
    }


@transaction.atomic
def create_preview_batch(*, team, user, asset: FileAsset, mapping: dict | None = None) -> ImportBatch:
    preview = build_preview(asset, mapping)
    batch = ImportBatch.objects.create(
        team=team,
        file=asset,
        mapping_json=preview["mapping"],
        status=ImportBatchStatus.PREVIEW,
        issues_json=preview["issues"],
        preview_json={
            "headers": preview["headers"],
            "suggestedMapping": preview["suggestedMapping"],
            "previewRows": preview["previewRows"],
            "rowCount": preview["rowCount"],
            "mappedSample": preview["mappedSample"],
        },
        created_by=user,
    )
    return batch


def batch_to_preview_dict(batch: ImportBatch) -> dict:
    preview = batch.preview_json or {}
    return {
        "id": str(batch.id),
        "fileId": str(batch.file_id),
        "status": batch.status,
        "mapping": batch.mapping_json,
        "suggestedMapping": preview.get("suggestedMapping") or batch.mapping_json,
        "headers": preview.get("headers") or [],
        "issues": batch.issues_json or [],
        "previewRows": preview.get("previewRows") or [],
        "rowCount": preview.get("rowCount") or 0,
        "mappedSample": preview.get("mappedSample") or [],
        "teamId": str(batch.team_id),
    }


class ImportConflictError(Exception):
    """File or batch already committed."""


@transaction.atomic
def commit_batch(
    *,
    batch: ImportBatch,
    user,
    name: str | None = None,
    mapping: dict | None = None,
    target_scheme=None,
) -> dict:
    batch = ImportBatch.objects.select_for_update().select_related("file", "team").get(pk=batch.pk)
    if batch.status == ImportBatchStatus.COMMITTED:
        raise ImportConflictError()

    # Idempotency: another batch already committed this file
    other = (
        ImportBatch.objects.select_for_update()
        .filter(file_id=batch.file_id, status=ImportBatchStatus.COMMITTED)
        .exclude(pk=batch.pk)
        .first()
    )
    if other is not None:
        raise ImportConflictError()

    asset = batch.file
    effective_mapping = mapping if mapping is not None else batch.mapping_json
    preview = build_preview(asset, effective_mapping)
    issues = preview["issues"]
    blocking = [i for i in issues if i.get("code") in BLOCKING_ISSUE_CODES]
    if blocking:
        batch.issues_json = issues
        batch.mapping_json = preview["mapping"]
        batch.status = ImportBatchStatus.FAILED
        batch.save(update_fields=["issues_json", "mapping_json", "status"])
        return {
            "ok": False,
            "code": "CARGO_DIMENSIONS_REQUIRED"
            if any(i.get("code") == "CARGO_DIMENSIONS_REQUIRED" for i in blocking)
            else "IMPORT_REQUIRED_FIELD_MISSING",
            "issues": issues,
        }

    table = _load_file_table(asset)
    mapped = apply_mapping(table, preview["mapping"])
    cargo = rows_to_cargo(mapped)
    if not cargo:
        batch.issues_json = issues
        batch.status = ImportBatchStatus.FAILED
        batch.save(update_fields=["issues_json", "status"])
        return {
            "ok": False,
            "code": "IMPORT_REQUIRED_FIELD_MISSING",
            "issues": issues,
        }

    scheme_name = (name or "").strip() or f"Import {asset.original_name}"
    meta = {
        "importBatchId": str(batch.id),
        "sourceFileId": str(asset.id),
        "sourceFilename": asset.original_name,
    }

    if target_scheme is not None:
        scheme = append_revision(
            scheme=target_scheme,
            user=user,
            name=scheme_name,
            cargo=cargo,
            meta=meta,
        )
    else:
        scheme = create_scheme(
            team=batch.team,
            user=user,
            name=scheme_name,
            locale="ko",
            cargo=cargo,
            meta=meta,
        )

    batch.mapping_json = preview["mapping"]
    batch.issues_json = issues
    batch.status = ImportBatchStatus.COMMITTED
    batch.result_scheme = scheme
    batch.target_scheme = target_scheme
    batch.committed_at = timezone.now()
    batch.save(
        update_fields=[
            "mapping_json",
            "issues_json",
            "status",
            "result_scheme",
            "target_scheme",
            "committed_at",
        ]
    )
    return {
        "ok": True,
        "batch": batch_to_preview_dict(batch),
        "scheme": scheme_to_document(scheme),
        "cargo": cargo,
    }
