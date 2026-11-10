from django.urls import path

from .views import ReportDetailView, ReportDownloadView, ReportListCreateView

urlpatterns = [
    path("reports/", ReportListCreateView.as_view(), name="report-list-create"),
    path("reports/<uuid:report_id>/", ReportDetailView.as_view(), name="report-detail"),
    path(
        "reports/<uuid:report_id>/download/",
        ReportDownloadView.as_view(),
        name="report-download",
    ),
]
