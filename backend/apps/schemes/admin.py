from django.contrib import admin

from .models import Scheme, SchemeRevision


class SchemeRevisionInline(admin.TabularInline):
    model = SchemeRevision
    extra = 0
    readonly_fields = (
        "revision_no",
        "schema_version",
        "content_hash",
        "creator",
        "created_at",
    )
    can_delete = False


@admin.register(Scheme)
class SchemeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "team", "row_version", "locale", "deleted_at", "updated_at")
    list_filter = ("locale",)
    search_fields = ("id", "name", "legacy_id")
    inlines = [SchemeRevisionInline]


@admin.register(SchemeRevision)
class SchemeRevisionAdmin(admin.ModelAdmin):
    list_display = ("scheme", "revision_no", "schema_version", "content_hash", "created_at")
    search_fields = ("scheme__id", "content_hash")
