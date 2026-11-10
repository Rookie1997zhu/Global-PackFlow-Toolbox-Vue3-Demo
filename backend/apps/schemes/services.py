"""Scheme create/update/restore helpers."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import Scheme, SchemeRevision, hash_cargo_meta


@transaction.atomic
def create_scheme(
    *,
    team,
    user,
    name: str,
    locale: str,
    cargo: list,
    meta: dict | None = None,
    legacy_id: str = "",
) -> Scheme:
    scheme = Scheme.objects.create(
        team=team,
        name=name,
        locale=locale or "ko",
        row_version=1,
        legacy_id=legacy_id or "",
    )
    revision = SchemeRevision.objects.create(
        scheme=scheme,
        revision_no=1,
        schema_version=1,
        cargo_json=cargo,
        meta_json=meta or {},
        content_hash=hash_cargo_meta(cargo, meta),
        creator=user,
    )
    scheme.current_revision = revision
    scheme.save(update_fields=["current_revision", "updated_at"])
    return scheme


@transaction.atomic
def append_revision(
    *,
    scheme: Scheme,
    user,
    name: str | None = None,
    locale: str | None = None,
    cargo: list,
    meta: dict | None = None,
) -> Scheme:
    scheme = Scheme.objects.select_for_update().get(pk=scheme.pk)
    next_no = (scheme.current_revision.revision_no if scheme.current_revision_id else 0) + 1
    if scheme.current_revision_id:
        # Prefer max revision_no in case of restore races
        last = scheme.revisions.order_by("-revision_no").first()
        if last:
            next_no = last.revision_no + 1

    revision = SchemeRevision.objects.create(
        scheme=scheme,
        revision_no=next_no,
        schema_version=1,
        cargo_json=cargo,
        meta_json=meta if meta is not None else {},
        content_hash=hash_cargo_meta(cargo, meta),
        creator=user,
    )
    if name is not None:
        scheme.name = name
    if locale is not None:
        scheme.locale = locale
    scheme.row_version = scheme.row_version + 1
    scheme.current_revision = revision
    scheme.updated_at = timezone.now()
    scheme.save(
        update_fields=["name", "locale", "row_version", "current_revision", "updated_at"]
    )
    return scheme


@transaction.atomic
def restore_revision(*, scheme: Scheme, user, revision_no: int) -> Scheme:
    scheme = Scheme.objects.select_for_update().get(pk=scheme.pk)
    source = scheme.revisions.filter(revision_no=revision_no).first()
    if source is None:
        return None  # type: ignore[return-value]
    return append_revision(
        scheme=scheme,
        user=user,
        name=scheme.name,
        locale=scheme.locale,
        cargo=list(source.cargo_json),
        meta=dict(source.meta_json or {}),
    )


def _iso(dt) -> str | None:
    if dt is None:
        return None
    return dt.isoformat().replace("+00:00", "Z")


def scheme_to_document(scheme: Scheme) -> dict:
    rev = scheme.current_revision
    cargo = list(rev.cargo_json) if rev else []
    meta = dict(rev.meta_json) if rev and rev.meta_json else {}
    return {
        "version": 1,
        "id": scheme.id,
        "name": scheme.name,
        "updatedAt": _iso(scheme.updated_at),
        "locale": scheme.locale or None,
        "cargo": cargo,
        "meta": meta,
        "rowVersion": scheme.row_version,
        "revisionNo": rev.revision_no if rev else None,
        "teamId": str(scheme.team_id),
    }
