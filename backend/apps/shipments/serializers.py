"""Shipment request validation."""

from __future__ import annotations

from rest_framework import serializers

from apps.documents.models import DocumentKind, ReportFormat

from .models import PlanType, ShipmentStatus

MAX_LINES = 2000


class ShipmentWriteSerializer(serializers.Serializer):
    shipmentNo = serializers.CharField(max_length=64, required=False, allow_blank=True)
    payload = serializers.DictField(required=False)
    rowVersion = serializers.IntegerField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_payload(self, value: dict) -> dict:
        if value is None:
            return {}
        for key in ("productLines", "cartonBatches"):
            rows = value.get(key)
            if rows is None:
                continue
            if not isinstance(rows, list):
                raise serializers.ValidationError({key: "must be an array"})
            if len(rows) > MAX_LINES:
                raise serializers.ValidationError({key: f"exceeds {MAX_LINES} rows"})
        return value


class ShipmentCreateSerializer(ShipmentWriteSerializer):
    shipmentNo = serializers.CharField(max_length=64)
    teamId = serializers.UUIDField(required=False)


class ShipmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ShipmentStatus.choices)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
    rowVersion = serializers.IntegerField(required=False)


class ShipmentReportSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(
        choices=[DocumentKind.PACKING_LIST, DocumentKind.COMMERCIAL_INVOICE]
    )
    format = serializers.ChoiceField(choices=ReportFormat.choices)
    locale = serializers.CharField(required=False, default="ko", max_length=8)
    formal = serializers.BooleanField(required=False, default=True)


class ShipmentPlanSerializer(serializers.Serializer):
    calculationJobId = serializers.UUIDField(required=False, allow_null=True)
    planType = serializers.ChoiceField(choices=PlanType.choices, required=False, default=PlanType.CONTAINER)
    label = serializers.CharField(required=False, allow_blank=True, max_length=200)
    parameters = serializers.DictField(required=False)
