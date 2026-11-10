from django.contrib import admin

from .models import DocumentSnapshot, Report


@admin.register(DocumentSnapshot)
class DocumentSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "team", "template_version", "created_at")
    list_filter = ("kind",)


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "format", "status", "locale", "team", "expires_at", "created_at")
    list_filter = ("format", "status")
