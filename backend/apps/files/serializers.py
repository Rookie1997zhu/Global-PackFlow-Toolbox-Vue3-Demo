"""Upload init / complete serializers."""

from __future__ import annotations

from rest_framework import serializers

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
ALLOWED_PURPOSES = {"cargo_import"}


class UploadInitSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    size = serializers.IntegerField(min_value=1)
    contentType = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    purpose = serializers.CharField(max_length=32, default="cargo_import")
    teamId = serializers.UUIDField(required=False)

    def validate_filename(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("filename is required")
        lower = name.lower()
        if lower.endswith(".xls") and not lower.endswith(".xlsx"):
            raise serializers.ValidationError("Legacy .xls is not supported")
        ext = ""
        if "." in lower:
            ext = "." + lower.rsplit(".", 1)[-1]
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Only .csv and .xlsx are allowed")
        return name

    def validate_purpose(self, value: str) -> str:
        if value not in ALLOWED_PURPOSES:
            raise serializers.ValidationError("Unsupported purpose")
        return value


class UploadCompleteSerializer(serializers.Serializer):
    uploadId = serializers.UUIDField()
