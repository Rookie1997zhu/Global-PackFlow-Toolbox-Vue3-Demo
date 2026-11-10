from django.urls import path

from .views import JobCancelView, JobDetailView, JobListCreateView, JobResultView, UsageView

urlpatterns = [
    path("calculations/jobs/", JobListCreateView.as_view(), name="calc-job-create"),
    path("calculations/jobs/<uuid:job_id>/", JobDetailView.as_view(), name="calc-job-detail"),
    path(
        "calculations/jobs/<uuid:job_id>/cancel/",
        JobCancelView.as_view(),
        name="calc-job-cancel",
    ),
    path(
        "calculations/jobs/<uuid:job_id>/result/",
        JobResultView.as_view(),
        name="calc-job-result",
    ),
    path("usage/", UsageView.as_view(), name="usage-summary"),
]
