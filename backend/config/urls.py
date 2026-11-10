"""Root URL configuration."""

from __future__ import annotations

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.health.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.organizations.urls")),
    path("api/v1/", include("apps.schemes.urls")),
    path("api/v1/", include("apps.files.urls")),
    path("api/v1/", include("apps.imports.urls")),
    path("api/v1/", include("apps.documents.urls")),
    path("api/v1/", include("apps.calculations.urls")),
    path("api/v1/", include("apps.shipments.urls")),
]
