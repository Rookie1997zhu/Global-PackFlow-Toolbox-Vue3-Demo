from __future__ import annotations

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

# Mirrors global-toolbox-vue3/public/samples/kr-container-cargo.csv
KR_CSV_BYTES = (
    "품명,규격,수량,단위,총중량,가로,세로,높이,박스수\n"
    "SKU-A 선물박스,Gift box,60,PCS,7.5,42,32,28,60\n"
    "SKU-B 액세서리,Accessories,40,PCS,5.2,36,28,22,40\n"
    "SKU-C 부품,Parts,20,PCS,11.4,52,38,34,20\n"
).encode("utf-8")

MISSING_DIMS_CSV = (
    "품명,수량,단위,총중량\n"
    "SKU-X,10,PCS,5\n"
).encode("utf-8")


class FilesImportsApiTests(TestCase):
    def setUp(self) -> None:
        import tempfile

        self.client = APIClient(enforce_csrf_checks=True)
        self._media = tempfile.TemporaryDirectory()
        self._override = override_settings(MEDIA_ROOT=self._media.name)
        self._override.enable()
        self.addCleanup(self._override.disable)
        self.addCleanup(self._media.cleanup)

    def _csrf(self) -> dict:
        r = self.client.get(reverse("auth-csrf"))
        return {"HTTP_X_CSRFTOKEN": r.json()["data"]["csrfToken"]}

    def _register(self, email: str) -> None:
        self.client.post(
            reverse("auth-register"),
            {"email": email, "password": "Passw0rd!xyz", "locale": "ko"},
            format="json",
            **self._csrf(),
        )

    def _upload_bytes(self, filename: str, content: bytes) -> str:
        init = self.client.post(
            reverse("file-upload-init"),
            {
                "filename": filename,
                "size": len(content),
                "contentType": "text/csv",
                "purpose": "cargo_import",
            },
            format="json",
            **self._csrf(),
        )
        self.assertEqual(init.status_code, 201, init.content)
        upload_id = init.json()["data"]["uploadId"]
        put = self.client.put(
            reverse("file-upload-content", kwargs={"upload_id": upload_id}),
            data=content,
            content_type="application/octet-stream",
            **self._csrf(),
        )
        self.assertEqual(put.status_code, 200, put.content)
        complete = self.client.post(
            reverse("file-upload-complete"),
            {"uploadId": upload_id},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(complete.status_code, 200, complete.content)
        self.assertEqual(complete.json()["data"]["status"], "ready")
        return upload_id

    def test_korean_csv_preview_and_commit(self) -> None:
        self._register("owner@import.test")
        file_id = self._upload_bytes("kr-container-cargo.csv", KR_CSV_BYTES)

        preview = self.client.post(
            reverse("import-preview"),
            {"fileId": file_id},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(preview.status_code, 201, preview.content)
        pdata = preview.json()["data"]
        self.assertEqual(pdata["suggestedMapping"].get("sku"), 0)
        self.assertEqual(pdata["suggestedMapping"].get("lengthCm"), 5)
        self.assertEqual(pdata["suggestedMapping"].get("widthCm"), 6)
        self.assertEqual(pdata["suggestedMapping"].get("heightCm"), 7)
        self.assertEqual(pdata["rowCount"], 3)
        blocking = [
            i for i in pdata["issues"] if i.get("code") == "CARGO_DIMENSIONS_REQUIRED"
        ]
        self.assertEqual(blocking, [])

        commit = self.client.post(
            reverse("import-commit", kwargs={"import_id": pdata["id"]}),
            {"name": "KR container import"},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(commit.status_code, 200, commit.content)
        cdata = commit.json()["data"]
        self.assertEqual(cdata["scheme"]["name"], "KR container import")
        self.assertEqual(len(cdata["cargo"]), 3)
        self.assertEqual(cdata["cargo"][0]["length"], 42.0)
        self.assertEqual(cdata["cargo"][0]["width"], 32.0)
        self.assertEqual(cdata["cargo"][0]["height"], 28.0)
        self.assertEqual(cdata["cargo"][0]["weight"], 7.5)
        # No demo defaults
        for row in cdata["cargo"]:
            self.assertNotEqual(
                (row["length"], row["width"], row["height"], row["weight"]),
                (40, 30, 20, 5),
            )

        schemes = self.client.get(reverse("scheme-list-create"))
        self.assertEqual(schemes.status_code, 200)
        self.assertGreaterEqual(len(schemes.json()["data"]["items"]), 1)

    def test_missing_dimensions_blocks_commit(self) -> None:
        self._register("owner2@import.test")
        file_id = self._upload_bytes("missing-dims.csv", MISSING_DIMS_CSV)
        preview = self.client.post(
            reverse("import-preview"),
            {"fileId": file_id},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(preview.status_code, 201, preview.content)
        pdata = preview.json()["data"]
        codes = {i["code"] for i in pdata["issues"]}
        self.assertIn("CARGO_DIMENSIONS_REQUIRED", codes)

        commit = self.client.post(
            reverse("import-commit", kwargs={"import_id": pdata["id"]}),
            {"name": "Should fail"},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(commit.status_code, 400, commit.content)
        body = commit.json()
        self.assertFalse(body["ok"])
        self.assertEqual(body["code"], "CARGO_DIMENSIONS_REQUIRED")

        schemes = self.client.get(reverse("scheme-list-create"))
        items = schemes.json()["data"]["items"]
        self.assertEqual(items, [])

    def test_cross_team_file_404(self) -> None:
        self._register("a@import.test")
        file_id = self._upload_bytes("a.csv", KR_CSV_BYTES)
        self.client.logout()
        self._register("b@import.test")
        preview = self.client.post(
            reverse("import-preview"),
            {"fileId": file_id},
            format="json",
            **self._csrf(),
        )
        self.assertEqual(preview.status_code, 404)

        download = self.client.get(
            reverse("file-download", kwargs={"file_id": file_id})
        )
        self.assertEqual(download.status_code, 404)
