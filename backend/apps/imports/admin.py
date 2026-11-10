from django.contrib import admin

from .models import ImportBatch


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "team", "file", "status", "created_at", "committed_at")
    list_filter = ("status",)
