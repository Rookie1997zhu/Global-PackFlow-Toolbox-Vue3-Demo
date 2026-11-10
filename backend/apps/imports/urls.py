from django.urls import path

from .views import (
    ImportCommitView,
    ImportPreviewView,
    MappingTemplateDetailView,
    MappingTemplateListCreateView,
)

urlpatterns = [
    path("imports/preview/", ImportPreviewView.as_view(), name="import-preview"),
    path(
        "imports/<uuid:import_id>/commit/",
        ImportCommitView.as_view(),
        name="import-commit",
    ),
    path(
        "import-mapping-templates/",
        MappingTemplateListCreateView.as_view(),
        name="import-mapping-templates",
    ),
    path(
        "import-mapping-templates/<uuid:template_id>/",
        MappingTemplateDetailView.as_view(),
        name="import-mapping-template-detail",
    ),
]
