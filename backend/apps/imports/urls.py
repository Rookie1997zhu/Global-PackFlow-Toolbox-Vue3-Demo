from django.urls import path

from .views import ImportCommitView, ImportPreviewView

urlpatterns = [
    path("imports/preview/", ImportPreviewView.as_view(), name="import-preview"),
    path(
        "imports/<uuid:import_id>/commit/",
        ImportCommitView.as_view(),
        name="import-commit",
    ),
]
