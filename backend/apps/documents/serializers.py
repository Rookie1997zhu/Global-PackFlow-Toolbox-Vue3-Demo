from __future__ import annotations

from rest_framework import serializers

from .models import DocumentKind, ReportFormat


class ReportCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=DocumentKind.choices)
    format = serializers.ChoiceField(choices=ReportFormat.choices)
    locale = serializers.CharField(max_length=8, required=False, default="ko")
    schemeId = serializers.CharField(max_length=40, required=False, allow_blank=True)
    revisionNo = serializers.IntegerField(required=False, min_value=1)
    teamId = serializers.UUIDField(required=False)

    # packing / invoice headers
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    shipper = serializers.CharField(max_length=200, required=False, allow_blank=True)
    consignee = serializers.CharField(max_length=200, required=False, allow_blank=True)
    po = serializers.CharField(max_length=120, required=False, allow_blank=True)
    seller = serializers.CharField(max_length=200, required=False, allow_blank=True)
    buyer = serializers.CharField(max_length=200, required=False, allow_blank=True)
    invoiceNo = serializers.CharField(max_length=120, required=False, allow_blank=True)
    currency = serializers.CharField(max_length=8, required=False, allow_blank=True)
    incoterms = serializers.CharField(max_length=40, required=False, allow_blank=True)
    paymentTerms = serializers.CharField(max_length=200, required=False, allow_blank=True)

    # diff
    matchMode = serializers.ChoiceField(
        choices=["sku+carton", "sku", "carton", "po+sku"],
        required=False,
        default="sku+carton",
    )
    expected = serializers.ListField(child=serializers.DictField(), required=False)
    actual = serializers.ListField(child=serializers.DictField(), required=False)

    def validate(self, attrs):
        kind = attrs["kind"]
        if kind in {DocumentKind.PACKING_LIST, DocumentKind.COMMERCIAL_INVOICE}:
            if not attrs.get("schemeId"):
                raise serializers.ValidationError({"schemeId": "Required"})
        if kind == DocumentKind.DIFF:
            if not attrs.get("expected") and not attrs.get("actual"):
                raise serializers.ValidationError(
                    {"expected": "expected and actual rows are required for diff"}
                )
        return attrs
