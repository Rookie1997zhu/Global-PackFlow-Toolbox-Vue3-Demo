from django.urls import path

from .views import (
    SchemeDetailView,
    SchemeImportDemoView,
    SchemeListCreateView,
    SchemeRevisionListView,
    SchemeRevisionRestoreView,
)

urlpatterns = [
    path("schemes/", SchemeListCreateView.as_view(), name="scheme-list-create"),
    path(
        "schemes/import-demo/",
        SchemeImportDemoView.as_view(),
        name="scheme-import-demo",
    ),
    path("schemes/<str:scheme_id>/", SchemeDetailView.as_view(), name="scheme-detail"),
    path(
        "schemes/<str:scheme_id>/revisions/",
        SchemeRevisionListView.as_view(),
        name="scheme-revisions",
    ),
    path(
        "schemes/<str:scheme_id>/revisions/<int:rev>/restore/",
        SchemeRevisionRestoreView.as_view(),
        name="scheme-revision-restore",
    ),
]
