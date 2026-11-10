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
    rows_to_shipment_payload,
    validate_mapped_rows,
)
from .models import ImportBatch, ImportBatchStatus, MappingTemplate
from .parsing import list_xlsx_sheets, load_table, preview_table

STORE = LocalObjectStore()


def _asset_bytes(asset: FileAsset) -> bytes:
    if asset.status != FileAssetStatus.READY or not asset.storage_key:
        raise ValidationError({"fileId": ["File is not ready"]})
    return STORE.get_bytes(asset.storage_key)


def _sheet_catalog(filename: str, data: bytes) -> list[dict]:
    lower = filename.lower()
    if lower.endswith(".xlsx"):
        try:
            return list_xlsx_sheets(data)
        except Exception as exc:  # noqa: BLE001
            raise ValidationError({"fileId": [f"INVALID_WORKBOOK: {exc}"]}) from exc
    if lower.endswith(".csv"):
        return [{"index": 0, "name": filename or "CSV"}]
    return [{"index": 0, "name": filename or "file"}]


def _resolve_sheet_index(filename: str, data: bytes, sheet_index: int | None) -> int:
    sheets = _sheet_catalog(filename, data)
    if not sheets:
        raise ValidationError({"sheetIndex": ["Workbook has no sheets"]})
    idx = 0 if sheet_index is None else int(sheet_index)
    if idx < 0 or idx >= len(sheets):
        raise ValidationError({"sheetIndex": [f"Invalid sheetIndex {idx}"]})
    return idx


def _load_file_table(asset: FileAsset, sheet_index: int | None = None) -> tuple[list[list[str]], int, list[dict]]:
    data = _asset_bytes(asset)
    sheets = _sheet_catalog(asset.original_name, data)
    idx = _resolve_sheet_index(asset.original_name, data, sheet_index)
    try:
        # CSV ignores sheet; xlsx uses idx
        table = load_table(
            asset.original_name,
            data,
            sheet_index=None if asset.original_name.lower().endswith(".csv") else idx,
        )
    except ValueError as exc:
        raise ValidationError({"sheetIndex": [str(exc)]}) from exc
    except Exception as exc:  # noqa: BLE001 — surface as workbook error
        raise ValidationError({"fileId": [f"INVALID_WORKBOOK: {exc}"]}) from exc
    max_rows = int(getattr(settings, "PACKFLOW_MAX_IMPORT_ROWS", 2000))
    if len(table) - 1 > max_rows:
        raise ValidationError({"fileId": [f"Row count exceeds {max_rows}"]})
    return table, idx, sheets


def build_preview(
    asset: FileAsset,
    mapping: dict | None = None,
    sheet_index: int | None = None,
) -> dict:
    table, idx, sheets = _load_file_table(asset, sheet_index=sheet_index)
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
        "sheetIndex": idx,
        "sheets": sheets,
    }


@transaction.atomic
def create_preview_batch(
    *,
    team,
    user,
    asset: FileAsset,
    mapping: dict | None = None,
    sheet_index: int | None = None,
) -> ImportBatch:
    preview = build_preview(asset, mapping, sheet_index=sheet_index)
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
            "sheetIndex": preview["sheetIndex"],
            "sheets": preview["sheets"],
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
        "sheetIndex": preview.get("sheetIndex", 0),
        "sheets": preview.get("sheets") or [],
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
    target_shipment=None,
    target: str = "scheme",
    shipment_no: str | None = None,
    sheet_index: int | None = None,
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
    preview_meta = batch.preview_json or {}
    stored_sheet = preview_meta.get("sheetIndex")
    if stored_sheet is None:
        stored_sheet = 0
    stored_sheet = int(stored_sheet)
    if sheet_index is not None and int(sheet_index) != stored_sheet:
        raise ValidationError(
            {
                "sheetIndex": [
                    f"Commit sheetIndex {sheet_index} must match preview sheetIndex {stored_sheet}"
                ]
            }
        )
    effective_sheet = stored_sheet

    effective_mapping = mapping if mapping is not None else batch.mapping_json
    preview = build_preview(asset, effective_mapping, sheet_index=effective_sheet)
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

    table, _, _ = _load_file_table(asset, sheet_index=effective_sheet)
    mapped = apply_mapping(table, preview["mapping"])
    # Surface skipped rows explicitly (never silent drop)
    accepted_cargo_preview = rows_to_cargo(mapped)
    skipped = max(0, len(mapped) - len(accepted_cargo_preview))
    if skipped:
        issues = list(issues) + [
            {
                "rawIndex": -1,
                "code": "IMPORT_ROWS_SKIPPED",
                "message": f"{skipped} row(s) skipped due to missing dimensions/qty",
                "count": skipped,
            }
        ]

    if target == "shipment" or target_shipment is not None:
        payload = rows_to_shipment_payload(mapped)
        if not payload["productLines"]:
            batch.issues_json = issues
            batch.status = ImportBatchStatus.FAILED
            batch.save(update_fields=["issues_json", "status"])
            return {
                "ok": False,
                "code": "IMPORT_REQUIRED_FIELD_MISSING",
                "issues": issues,
            }
        from apps.shipments.services import append_revision as ship_append
        from apps.shipments.services import create_shipment
        from apps.shipments.services import shipment_to_document

        if target_shipment is not None:
            parties = dict((target_shipment.current_revision.payload_json or {}).get("parties") or {})
            if parties:
                payload["parties"] = {**payload["parties"], **parties}
            shipment = ship_append(
                shipment=target_shipment,
                user=user,
                payload=payload,
                reason=f"Import {asset.original_name}",
            )
        else:
            no = (shipment_no or "").strip() or f"IMP-{str(batch.id)[:8].upper()}"
            shipment = create_shipment(
                team=batch.team,
                user=user,
                shipment_no=no,
                payload=payload,
            )

        batch.mapping_json = preview["mapping"]
        batch.issues_json = issues
        batch.status = ImportBatchStatus.COMMITTED
        batch.result_shipment = shipment
        batch.target_shipment = target_shipment
        batch.committed_at = timezone.now()
        batch.save(
            update_fields=[
                "mapping_json",
                "issues_json",
                "status",
                "result_shipment",
                "target_shipment",
                "committed_at",
            ]
        )
        return {
            "ok": True,
            "batch": batch_to_preview_dict(batch),
            "shipment": shipment_to_document(shipment),
            "skippedRows": skipped,
            "issues": issues,
        }

    cargo = accepted_cargo_preview
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
        "skippedRows": skipped,
        "issues": issues,
    }


def template_to_dict(tpl: MappingTemplate) -> dict:
    return {
        "id": str(tpl.id),
        "name": tpl.name,
        "mapping": tpl.mapping_json or {},
        "sheetHint": tpl.sheet_hint or "",
        "teamId": str(tpl.team_id),
        "createdAt": tpl.created_at.isoformat().replace("+00:00", "Z"),
        "updatedAt": tpl.updated_at.isoformat().replace("+00:00", "Z"),
    }


@transaction.atomic
def upsert_mapping_template(*, team, user, name: str, mapping: dict, sheet_hint: str = "") -> MappingTemplate:
    tpl, _created = MappingTemplate.objects.update_or_create(
        team=team,
        name=name.strip(),
        defaults={
            "mapping_json": mapping,
            "sheet_hint": sheet_hint or "",
            "created_by": user,
        },
    )
    return tpl
