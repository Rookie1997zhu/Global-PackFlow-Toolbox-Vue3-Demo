"""Create document snapshots and render reports into private storage."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.files.models import FileAsset, FileAssetPurpose, FileAssetStatus
from apps.files.storage import LocalObjectStore, sha256_bytes
from apps.schemes.models import Scheme, SchemeRevision

from .builders import (
    CI_DISCLAIMER_EN,
    CI_DISCLAIMER_KO,
    invoice_from_cargo,
    invoice_totals,
    packing_from_cargo,
    packing_totals,
)
from .diffing import match_checker_rows
from .models import (
    TEMPLATE_VERSION,
    DocumentKind,
    DocumentSnapshot,
    Report,
    ReportFormat,
    ReportStatus,
)
from .renderers import render_pdf, render_xlsx

STORE = LocalObjectStore()
REPORT_TTL_DAYS = 7


def _get_scheme_revision(scheme_id: str, revision_no: int | None) -> tuple[Scheme, SchemeRevision]:
    scheme = (
        Scheme.objects.select_related("current_revision", "team")
        .filter(id=scheme_id, deleted_at__isnull=True)
        .first()
    )
    if scheme is None:
        raise Http404()
    if revision_no is None:
        rev = scheme.current_revision
    else:
        rev = scheme.revisions.filter(revision_no=revision_no).first()
    if rev is None:
        raise ValidationError({"revisionNo": ["Revision not found"]})
    return scheme, rev


def _build_payload(kind: str, *, rev: SchemeRevision | None, data: dict, locale: str) -> dict:
    if kind == DocumentKind.PACKING_LIST:
        cargo = list(rev.cargo_json) if rev else []
        lines = packing_from_cargo(cargo)
        meta = {
            "shipper": str(data.get("shipper") or ""),
            "consignee": str(data.get("consignee") or ""),
            "po": str(data.get("po") or ""),
        }
        return {
            "kind": kind,
            "title": str(data.get("title") or "패킹리스트 / Packing List"),
            "meta": meta,
            "lines": lines,
            "totals": packing_totals(lines),
            "templateVersion": TEMPLATE_VERSION,
        }

    if kind == DocumentKind.COMMERCIAL_INVOICE:
        cargo = list(rev.cargo_json) if rev else []
        lines = invoice_from_cargo(cargo)
        meta = {
            "seller": str(data.get("seller") or ""),
            "buyer": str(data.get("buyer") or ""),
            "invoiceNo": str(data.get("invoiceNo") or ""),
            "po": str(data.get("po") or ""),
            "currency": str(data.get("currency") or "USD"),
            "incoterms": str(data.get("incoterms") or ""),
            "paymentTerms": str(data.get("paymentTerms") or ""),
        }
        disclaimer = CI_DISCLAIMER_KO if locale.startswith("ko") else CI_DISCLAIMER_EN
        return {
            "kind": kind,
            "title": str(data.get("title") or "상업송장 / Commercial Invoice"),
            "meta": meta,
            "lines": lines,
            "totals": invoice_totals(lines),
            "disclaimer": disclaimer,
            "templateVersion": TEMPLATE_VERSION,
        }

    # diff
    expected = data.get("expected") or []
    actual = data.get("actual") or []
    if not isinstance(expected, list) or not isinstance(actual, list):
        raise ValidationError({"expected": ["expected and actual must be arrays"]})
    mode = str(data.get("matchMode") or "sku+carton")
    diffs = match_checker_rows(expected, actual, mode)
    return {
        "kind": kind,
        "title": str(data.get("title") or "서류 대조 / Document Diff"),
        "matchMode": mode,
        "expected": expected,
        "actual": actual,
        "diffs": diffs,
        "templateVersion": TEMPLATE_VERSION,
    }


def _store_report_bytes(
    *,
    team,
    user,
    filename: str,
    content: bytes,
    mime: str,
) -> FileAsset:
    expires = timezone.now() + timedelta(days=REPORT_TTL_DAYS)
    asset = FileAsset.objects.create(
        team=team,
        original_name=filename,
        declared_size=len(content),
        size=len(content),
        mime=mime,
        status=FileAssetStatus.READY,
        purpose=FileAssetPurpose.REPORT,
        uploaded_by=user,
        expires_at=expires,
        sha256=sha256_bytes(content),
    )
    key = f"reports/{team.id}/{asset.id}/{filename}"
    STORE.put_bytes(key, content)
    asset.storage_key = key
    asset.save(update_fields=["storage_key", "updated_at"])
    return asset


@transaction.atomic
def create_report(
    *,
    team,
    user,
    kind: str,
    fmt: str,
    locale: str,
    scheme_id: str | None,
    revision_no: int | None,
    data: dict,
) -> Report:
    rev = None
    scheme = None
    if kind in {DocumentKind.PACKING_LIST, DocumentKind.COMMERCIAL_INVOICE}:
        if not scheme_id:
            raise ValidationError({"schemeId": ["Required for this report kind"]})
        scheme, rev = _get_scheme_revision(scheme_id, revision_no)
        if str(scheme.team_id) != str(team.id):
            raise Http404()
    elif kind == DocumentKind.DIFF:
        if scheme_id:
            scheme, rev = _get_scheme_revision(scheme_id, revision_no)
            if str(scheme.team_id) != str(team.id):
                raise Http404()
    else:
        raise ValidationError({"kind": ["Unsupported kind"]})

    try:
        payload = _build_payload(kind, rev=rev, data=data, locale=locale)
    except ValidationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ValidationError({"payload": [f"REPORT_RENDER_FAILED: {exc}"]}) from exc

    snapshot = DocumentSnapshot.objects.create(
        team=team,
        scheme_revision=rev,
        kind=kind,
        payload_json=payload,
        template_version=TEMPLATE_VERSION,
        created_by=user,
    )

    source_rev_label = None
    if rev is not None:
        source_rev_label = f"{rev.scheme_id}#r{rev.revision_no}"

    try:
        if fmt == ReportFormat.PDF:
            content = render_pdf(
                kind, payload, locale=locale, source_revision=source_rev_label
            )
            mime = "application/pdf"
            filename = f"{kind}.pdf"
        elif fmt == ReportFormat.XLSX:
            content = render_xlsx(kind, payload)
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{kind}.xlsx"
        else:
            raise ValidationError({"format": ["Unsupported format"]})
    except ValidationError:
        raise
    except Exception as exc:  # noqa: BLE001
        report = Report.objects.create(
            team=team,
            snapshot=snapshot,
            locale=locale,
            format=fmt,
            status=ReportStatus.FAILED,
            error_code="REPORT_RENDER_FAILED",
            expires_at=timezone.now() + timedelta(days=REPORT_TTL_DAYS),
            created_by=user,
        )
        report.error_code = "REPORT_RENDER_FAILED"
        report.save(update_fields=["error_code"])
        raise ValidationError({"render": [f"REPORT_RENDER_FAILED: {exc}"]}) from exc

    asset = _store_report_bytes(team=team, user=user, filename=filename, content=content, mime=mime)
    return Report.objects.create(
        team=team,
        snapshot=snapshot,
        file_asset=asset,
        locale=locale,
        format=fmt,
        status=ReportStatus.SUCCEEDED,
        expires_at=asset.expires_at,
        created_by=user,
    )


def report_to_dict(report: Report) -> dict:
    snap = report.snapshot
    rev = snap.scheme_revision
    return {
        "id": str(report.id),
        "kind": snap.kind,
        "format": report.format,
        "locale": report.locale,
        "status": report.status,
        "templateVersion": snap.template_version,
        "sourceRevision": (
            {"schemeId": rev.scheme_id, "revisionNo": rev.revision_no} if rev else None
        ),
        "fileId": str(report.file_asset_id) if report.file_asset_id else None,
        "expiresAt": report.expires_at.isoformat().replace("+00:00", "Z"),
        "createdAt": report.created_at.isoformat().replace("+00:00", "Z"),
        "teamId": str(report.team_id),
        "downloadUrl": f"/api/v1/reports/{report.id}/download/",
        "diffSummary": _diff_summary(snap) if snap.kind == DocumentKind.DIFF else None,
    }


def _diff_summary(snap: DocumentSnapshot) -> dict | None:
    diffs = (snap.payload_json or {}).get("diffs") or []
    failed = [d for d in diffs if d.get("kind") != "ok"]
    return {"total": len(diffs), "failed": len(failed)}
