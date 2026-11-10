from __future__ import annotations

from rest_framework import serializers


class ImportPreviewSerializer(serializers.Serializer):
    fileId = serializers.UUIDField()
    mapping = serializers.DictField(
        child=serializers.IntegerField(min_value=0),
        required=False,
    )
    teamId = serializers.UUIDField(required=False)


class ImportCommitSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    mapping = serializers.DictField(
        child=serializers.IntegerField(min_value=0),
        required=False,
    )
    targetSchemeId = serializers.CharField(max_length=40, required=False, allow_blank=True)
