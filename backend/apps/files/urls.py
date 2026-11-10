from django.urls import path

from .views import FileDownloadView, UploadCompleteView, UploadContentView, UploadInitView

urlpatterns = [
    path("files/uploads/init/", UploadInitView.as_view(), name="file-upload-init"),
    path(
        "files/uploads/<uuid:upload_id>/content/",
        UploadContentView.as_view(),
        name="file-upload-content",
    ),
    path("files/uploads/complete/", UploadCompleteView.as_view(), name="file-upload-complete"),
    path("files/<uuid:file_id>/download/", FileDownloadView.as_view(), name="file-download"),
]
