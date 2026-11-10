from __future__ import annotations

from rest_framework import serializers


class ImportPreviewSerializer(serializers.Serializer):
    fileId = serializers.UUIDField()
    mapping = serializers.DictField(
        child=serializers.IntegerField(min_value=0),
        required=False,
    )
    teamId = serializers.UUIDField(required=False)
    sheetIndex = serializers.IntegerField(required=False, min_value=0)


class ImportCommitSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    mapping = serializers.DictField(
        child=serializers.IntegerField(min_value=0),
        required=False,
    )
    targetSchemeId = serializers.CharField(max_length=40, required=False, allow_blank=True)
    targetShipmentId = serializers.CharField(max_length=40, required=False, allow_blank=True)
    target = serializers.ChoiceField(
        choices=["scheme", "shipment"],
        required=False,
        default="scheme",
    )
    shipmentNo = serializers.CharField(max_length=64, required=False, allow_blank=True)
    sheetIndex = serializers.IntegerField(required=False, min_value=0)


class MappingTemplateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    mapping = serializers.DictField(child=serializers.IntegerField(min_value=0))
    sheetHint = serializers.CharField(max_length=120, required=False, allow_blank=True)
    teamId = serializers.UUIDField(required=False)
