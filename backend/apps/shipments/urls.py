from django.urls import path

from .views import (
    ShipmentDetailView,
    ShipmentDocumentListView,
    ShipmentEventListView,
    ShipmentListCreateView,
    ShipmentPlanListCreateView,
    ShipmentReportView,
    ShipmentRevisionListView,
    ShipmentRevisionRestoreView,
    ShipmentStatusView,
)

urlpatterns = [
    path("shipments/", ShipmentListCreateView.as_view(), name="shipment-list-create"),
    path("shipments/<str:shipment_id>/", ShipmentDetailView.as_view(), name="shipment-detail"),
    path(
        "shipments/<str:shipment_id>/revisions/",
        ShipmentRevisionListView.as_view(),
        name="shipment-revisions",
    ),
    path(
        "shipments/<str:shipment_id>/revisions/<int:rev>/restore/",
        ShipmentRevisionRestoreView.as_view(),
        name="shipment-revision-restore",
    ),
    path(
        "shipments/<str:shipment_id>/status/",
        ShipmentStatusView.as_view(),
        name="shipment-status",
    ),
    path(
        "shipments/<str:shipment_id>/reports/",
        ShipmentReportView.as_view(),
        name="shipment-reports",
    ),
    path(
        "shipments/<str:shipment_id>/documents/",
        ShipmentDocumentListView.as_view(),
        name="shipment-documents",
    ),
    path(
        "shipments/<str:shipment_id>/plans/",
        ShipmentPlanListCreateView.as_view(),
        name="shipment-plans",
    ),
    path(
        "shipments/<str:shipment_id>/events/",
        ShipmentEventListView.as_view(),
        name="shipment-events",
    ),
]
