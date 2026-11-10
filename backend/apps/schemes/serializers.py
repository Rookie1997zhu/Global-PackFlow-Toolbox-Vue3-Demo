"""Scheme request validation — no silent default dimensions."""

from __future__ import annotations

from rest_framework import serializers

MAX_CARGO_ROWS = 2000
MAX_META_KEYS = 50
MAX_META_JSON_CHARS = 16_384


class CargoItemSerializer(serializers.Serializer):
    sku = serializers.CharField(allow_blank=True, max_length=200, required=False, default="")
    length = serializers.FloatField()
    width = serializers.FloatField()
    height = serializers.FloatField()
    weight = serializers.FloatField()
    qty = serializers.FloatField()
    price = serializers.FloatField(required=False, default=0)

    def validate_length(self, value: float) -> float:
        if value is None or value <= 0:
            raise serializers.ValidationError("must be > 0 (cm)")
        return value

    def validate_width(self, value: float) -> float:
        if value is None or value <= 0:
            raise serializers.ValidationError("must be > 0 (cm)")
        return value

    def validate_height(self, value: float) -> float:
        if value is None or value <= 0:
            raise serializers.ValidationError("must be > 0 (cm)")
        return value

    def validate_weight(self, value: float) -> float:
        if value is None or value < 0:
            raise serializers.ValidationError("must be >= 0 (kg)")
        return value

    def validate_qty(self, value: float) -> float:
        if value is None or value <= 0:
            raise serializers.ValidationError("must be > 0")
        return value


class SchemeWriteSerializer(serializers.Serializer):
    version = serializers.IntegerField(required=False, default=1)
    name = serializers.CharField(max_length=200)
    locale = serializers.CharField(required=False, allow_blank=True, max_length=8, default="ko")
    cargo = CargoItemSerializer(many=True)
    meta = serializers.DictField(required=False, default=dict)
    rowVersion = serializers.IntegerField(required=False)
    id = serializers.CharField(required=False, allow_blank=True, max_length=80)

    def validate_version(self, value: int) -> int:
        if value != 1:
            raise serializers.ValidationError("Only scheme version 1 is supported")
        return value

    def validate_cargo(self, value: list) -> list:
        if not value:
            raise serializers.ValidationError("cargo must not be empty")
        if len(value) > MAX_CARGO_ROWS:
            raise serializers.ValidationError(f"cargo exceeds {MAX_CARGO_ROWS} rows")
        return value

    def validate_meta(self, value: dict) -> dict:
        if value is None:
            return {}
        if len(value) > MAX_META_KEYS:
            raise serializers.ValidationError("meta has too many keys")
        # Rough size guard
        import json

        raw = json.dumps(value, ensure_ascii=False)
        if len(raw) > MAX_META_JSON_CHARS:
            raise serializers.ValidationError("meta payload too large")
        return value


class SchemeImportSerializer(SchemeWriteSerializer):
    """Same as write; id treated as legacy_id for dedupe."""

    pass
