"""Shipment create/update/status/report helpers."""

from __future__ import annotations

from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.calculations.models import CalculationJob
from apps.documents.models import DocumentKind, ReportFormat
from apps.documents.services import create_report, report_to_dict

from .conservation import (
    build_confirmed_invoice_lines,
    build_confirmed_packing_lines,
    validate_piece_carton_conservation,
)
from .models import (
    DocumentPurpose,
    PlanType,
    Shipment,
    ShipmentDocument,
    ShipmentEvent,
    ShipmentPlan,
    ShipmentRevision,
    ShipmentStatus,
    hash_payload,
)

STATUS_TRANSITIONS: dict[str, set[str]] = {
    ShipmentStatus.DRAFT: {ShipmentStatus.READY, ShipmentStatus.ARCHIVED},
    ShipmentStatus.READY: {
        ShipmentStatus.DRAFT,
        ShipmentStatus.CONFIRMED,
        ShipmentStatus.ARCHIVED,
    },
    ShipmentStatus.CONFIRMED: {ShipmentStatus.SHIPPED, ShipmentStatus.DRAFT},
    ShipmentStatus.SHIPPED: {ShipmentStatus.ARCHIVED},
    ShipmentStatus.ARCHIVED: set(),
}

CRITICAL_STATUSES = {
    ShipmentStatus.READY,
    ShipmentStatus.CONFIRMED,
    ShipmentStatus.SHIPPED,
}


class ShipmentVersionConflict(Exception):
    def __init__(self, *, expected: int, current: int):
        self.expected = expected
        self.current = current
        super().__init__(f"expected={expected} current={current}")


def empty_payload() -> dict:
    return {
        "parties": {
            "customer": "",
            "seller": "",
            "shipper": "",
            "consignee": "",
            "buyer": "",
            "po": "",
            "incoterms": "",
            "currency": "USD",
            "paymentTerms": "",
        },
        "productLines": [],
        "cartonBatches": [],
        "checklist": {},
    }


def normalize_payload(raw: dict | None) -> dict:
    base = empty_payload()
    if not raw:
        return base
    parties = raw.get("parties") if isinstance(raw.get("parties"), dict) else {}
    base["parties"] = {**base["parties"], **{k: ("" if v is None else v) for k, v in parties.items()}}
    base["productLines"] = list(raw.get("productLines") or [])
    base["cartonBatches"] = list(raw.get("cartonBatches") or [])
    checklist = raw.get("checklist")
    base["checklist"] = checklist if isinstance(checklist, dict) else {}
    return base


def assert_conservation(payload: dict, *, require_lines: bool = False) -> None:
    lines = payload.get("productLines") or []
    batches = payload.get("cartonBatches") or []
    if require_lines and (not lines or not batches):
        raise ValidationError(
            {
                "payload": [
                    {
                        "code": "LINES_REQUIRED",
                        "message": "productLines and cartonBatches required for this status",
                    }
                ]
            }
        )
    if not lines and not batches:
        return
    issues = validate_piece_carton_conservation(payload)
    if issues:
        raise ValidationError({"conservation": issues})


def _record_event(*, shipment: Shipment, user, event_type: str, reason: str = "", meta: dict | None = None):
    ShipmentEvent.objects.create(
        shipment=shipment,
        event_type=event_type,
        reason=reason or "",
        meta_json=meta or {},
        actor=user,
    )


def _iso(dt) -> str | None:
    if dt is None:
        return None
    return dt.isoformat().replace("+00:00", "Z")


def shipment_to_document(shipment: Shipment) -> dict:
    rev = shipment.current_revision
    payload = dict(rev.payload_json) if rev else empty_payload()
    return {
        "id": shipment.id,
        "shipmentNo": shipment.shipment_no,
        "status": shipment.status,
        "rowVersion": shipment.row_version,
        "revisionNo": rev.revision_no if rev else None,
        "contentHash": rev.content_hash if rev else None,
        "payload": payload,
        "teamId": str(shipment.team_id),
        "createdAt": _iso(shipment.created_at),
        "updatedAt": _iso(shipment.updated_at),
        "archivedAt": _iso(shipment.archived_at),
    }


@transaction.atomic
def create_shipment(
    *,
    team,
    user,
    shipment_no: str,
    payload: dict | None = None,
    locale: str = "ko",  # noqa: ARG001 — reserved for future
) -> Shipment:
    no = (shipment_no or "").strip()
    if not no:
        raise ValidationError({"shipmentNo": ["Required"]})
    if Shipment.objects.filter(team=team, shipment_no=no, deleted_at__isnull=True).exists():
        raise ValidationError({"shipmentNo": ["Already exists for this team"]})

    normalized = normalize_payload(payload)
    # Draft may be empty; if lines present they must conserve.
    if normalized["productLines"] or normalized["cartonBatches"]:
        assert_conservation(normalized)

    shipment = Shipment.objects.create(
        team=team,
        shipment_no=no,
        status=ShipmentStatus.DRAFT,
        row_version=1,
        created_by=user,
    )
    revision = ShipmentRevision.objects.create(
        shipment=shipment,
        revision_no=1,
        schema_version=1,
        payload_json=normalized,
        content_hash=hash_payload(normalized),
        creator=user,
    )
    shipment.current_revision = revision
    shipment.save(update_fields=["current_revision", "updated_at"])
    _record_event(shipment=shipment, user=user, event_type="created")
    return shipment


@transaction.atomic
def append_revision(
    *,
    shipment: Shipment,
    user,
    payload: dict,
    expected_row_version: int | None = None,
    shipment_no: str | None = None,
    reason: str = "",
) -> Shipment:
    shipment = Shipment.objects.select_for_update().get(pk=shipment.pk)
    if expected_row_version is not None and expected_row_version != shipment.row_version:
        raise ShipmentVersionConflict(
            expected=expected_row_version,
            current=shipment.row_version,
        )

    normalized = normalize_payload(payload)
    if normalized["productLines"] or normalized["cartonBatches"]:
        assert_conservation(normalized)

    last = shipment.revisions.order_by("-revision_no").first()
    next_no = (last.revision_no if last else 0) + 1
    revision = ShipmentRevision.objects.create(
        shipment=shipment,
        revision_no=next_no,
        schema_version=1,
        payload_json=normalized,
        content_hash=hash_payload(normalized),
        creator=user,
    )

    status_reverted = False
    previous_status = shipment.status
    if previous_status in CRITICAL_STATUSES:
        shipment.status = ShipmentStatus.DRAFT
        status_reverted = True
        _record_event(
            shipment=shipment,
            user=user,
            event_type="status_reverted",
            reason=reason or "Critical fields changed; status reset to draft",
            meta={"from": previous_status, "to": ShipmentStatus.DRAFT},
        )

    if shipment_no is not None:
        new_no = shipment_no.strip()
        if new_no and new_no != shipment.shipment_no:
            if (
                Shipment.objects.filter(team_id=shipment.team_id, shipment_no=new_no, deleted_at__isnull=True)
                .exclude(pk=shipment.pk)
                .exists()
            ):
                raise ValidationError({"shipmentNo": ["Already exists for this team"]})
            shipment.shipment_no = new_no

    shipment.row_version = shipment.row_version + 1
    shipment.current_revision = revision
    shipment.updated_at = timezone.now()
    update_fields = ["row_version", "current_revision", "updated_at", "shipment_no"]
    if status_reverted:
        update_fields.append("status")
    shipment.save(update_fields=update_fields)
    _record_event(
        shipment=shipment,
        user=user,
        event_type="revision_appended",
        reason=reason,
        meta={"revisionNo": next_no},
    )
    return shipment


@transaction.atomic
def restore_revision(*, shipment: Shipment, user, revision_no: int) -> Shipment | None:
    shipment = Shipment.objects.select_for_update().get(pk=shipment.pk)
    source = shipment.revisions.filter(revision_no=revision_no).first()
    if source is None:
        return None
    return append_revision(
        shipment=shipment,
        user=user,
        payload=dict(source.payload_json or {}),
        expected_row_version=None,
        reason=f"Restored from revision {revision_no}",
    )


@transaction.atomic
def transition_status(
    *,
    shipment: Shipment,
    user,
    to_status: str,
    reason: str = "",
    expected_row_version: int | None = None,
) -> Shipment:
    # Avoid select_related on nullable current_revision with select_for_update
    # (Postgres: FOR UPDATE cannot be applied to the nullable side of an outer join).
    shipment = Shipment.objects.select_for_update().get(pk=shipment.pk)
    if expected_row_version is not None and expected_row_version != shipment.row_version:
        raise ShipmentVersionConflict(
            expected=expected_row_version,
            current=shipment.row_version,
        )

    current = shipment.status
    allowed = STATUS_TRANSITIONS.get(current, set())
    if to_status not in allowed:
        raise ValidationError(
            {
                "status": [
                    {
                        "code": "INVALID_TRANSITION",
                        "message": f"Cannot transition {current} → {to_status}",
                        "from": current,
                        "to": to_status,
                    }
                ]
            }
        )

    if to_status in {ShipmentStatus.READY, ShipmentStatus.CONFIRMED}:
        rev = shipment.current_revision
        payload = dict(rev.payload_json) if rev else empty_payload()
        assert_conservation(payload, require_lines=True)

    shipment.status = to_status
    if to_status == ShipmentStatus.ARCHIVED:
        shipment.archived_at = timezone.now()
    shipment.row_version = shipment.row_version + 1
    shipment.updated_at = timezone.now()
    shipment.save(update_fields=["status", "archived_at", "row_version", "updated_at"])
    _record_event(
        shipment=shipment,
        user=user,
        event_type="status_changed",
        reason=reason,
        meta={"from": current, "to": to_status},
    )
    return shipment


@transaction.atomic
def link_plan(
    *,
    shipment: Shipment,
    user,
    calculation_job_id: str | None,
    plan_type: str = PlanType.CONTAINER,
    label: str = "",
    parameters: dict | None = None,
) -> ShipmentPlan:
    shipment = Shipment.objects.select_related("current_revision", "team").get(pk=shipment.pk)
    rev = shipment.current_revision
    if rev is None:
        raise ValidationError({"revision": ["Shipment has no revision"]})

    job = None
    input_hash = ""
    result_hash = ""
    if calculation_job_id:
        job = CalculationJob.objects.filter(id=calculation_job_id).first()
        if job is None:
            raise Http404()
        if str(job.team_id) != str(shipment.team_id):
            raise Http404()
        input_hash = job.input_hash or ""
        result_hash = hash_payload(job.result_json or {})

    plan = ShipmentPlan.objects.create(
        shipment=shipment,
        revision=rev,
        calculation_job=job,
        plan_type=plan_type or PlanType.CONTAINER,
        label=label or "",
        parameters_json=parameters or {},
        input_hash=input_hash,
        result_hash=result_hash,
        created_by=user,
    )
    _record_event(
        shipment=shipment,
        user=user,
        event_type="plan_linked",
        meta={"planId": str(plan.id), "jobId": str(job.id) if job else None},
    )
    return plan


@transaction.atomic
def create_shipment_report(
    *,
    shipment: Shipment,
    user,
    kind: str,
    fmt: str,
    locale: str = "ko",
    formal: bool = True,
) -> dict:
    shipment = Shipment.objects.select_related("current_revision", "team").get(pk=shipment.pk)
    rev = shipment.current_revision
    if rev is None:
        raise ValidationError({"revision": ["Shipment has no revision"]})
    payload = dict(rev.payload_json or {})
    assert_conservation(payload, require_lines=True)

    parties = payload.get("parties") or {}
    if kind == DocumentKind.PACKING_LIST:
        lines = build_confirmed_packing_lines(payload)
        purpose = DocumentPurpose.PL
        data = {
            "sourceMode": "confirmed_lines",
            "lines": lines,
            "formal": formal,
            "shipper": str(parties.get("shipper") or ""),
            "consignee": str(parties.get("consignee") or ""),
            "po": str(parties.get("po") or ""),
            "title": f"Packing List — {shipment.shipment_no}",
        }
    elif kind == DocumentKind.COMMERCIAL_INVOICE:
        lines = build_confirmed_invoice_lines(payload)
        purpose = DocumentPurpose.CI
        data = {
            "sourceMode": "confirmed_lines",
            "lines": lines,
            "formal": formal,
            "seller": str(parties.get("seller") or ""),
            "buyer": str(parties.get("buyer") or parties.get("customer") or ""),
            "invoiceNo": shipment.shipment_no,
            "po": str(parties.get("po") or ""),
            "currency": str(parties.get("currency") or "USD"),
            "incoterms": str(parties.get("incoterms") or ""),
            "paymentTerms": str(parties.get("paymentTerms") or ""),
            "title": f"Commercial Invoice — {shipment.shipment_no}",
        }
    else:
        raise ValidationError({"kind": ["Only packing_list and commercial_invoice supported"]})

    if not lines:
        raise ValidationError({"lines": ["No lines derived from shipment revision"]})

    report = create_report(
        team=shipment.team,
        user=user,
        kind=kind,
        fmt=fmt,
        locale=locale or "ko",
        scheme_id=None,
        revision_no=None,
        data=data,
    )
    link = ShipmentDocument.objects.create(
        shipment=shipment,
        revision=rev,
        snapshot=report.snapshot,
        purpose=purpose,
    )
    _record_event(
        shipment=shipment,
        user=user,
        event_type="report_created",
        meta={
            "reportId": str(report.id),
            "documentId": str(link.id),
            "purpose": purpose,
            "revisionNo": rev.revision_no,
        },
    )
    dto = report_to_dict(report)
    dto["shipmentRevision"] = {"shipmentId": shipment.id, "revisionNo": rev.revision_no}
    dto["shipmentDocumentId"] = str(link.id)
    return dto


def plan_to_dict(plan: ShipmentPlan) -> dict:
    return {
        "id": str(plan.id),
        "planType": plan.plan_type,
        "label": plan.label,
        "revisionNo": plan.revision.revision_no if plan.revision_id else None,
        "calculationJobId": str(plan.calculation_job_id) if plan.calculation_job_id else None,
        "inputHash": plan.input_hash,
        "resultHash": plan.result_hash,
        "parameters": plan.parameters_json or {},
        "createdAt": _iso(plan.created_at),
    }


def document_link_to_dict(link: ShipmentDocument) -> dict:
    return {
        "id": str(link.id),
        "purpose": link.purpose,
        "revisionNo": link.revision.revision_no if link.revision_id else None,
        "snapshotId": str(link.snapshot_id),
        "createdAt": _iso(link.created_at),
    }
