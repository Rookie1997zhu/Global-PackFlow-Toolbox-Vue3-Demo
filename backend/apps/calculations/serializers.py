from __future__ import annotations

from rest_framework import serializers


class JobCreateSerializer(serializers.Serializer):
    engine = serializers.ChoiceField(choices=["container"], default="container")
    schemeId = serializers.CharField(max_length=40)
    schemeRevision = serializers.IntegerField(required=False, min_value=1)
    params = serializers.DictField(required=False)
    teamId = serializers.UUIDField(required=False)
