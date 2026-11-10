from django.contrib import admin

from .models import FileAsset


@admin.register(FileAsset)
class FileAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "original_name", "team", "status", "size", "created_at")
    list_filter = ("status", "purpose")
    search_fields = ("original_name", "sha256")
