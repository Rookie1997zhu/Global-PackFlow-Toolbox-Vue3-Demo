"""Private local filesystem object store (no public URLs)."""

from __future__ import annotations

import hashlib
from pathlib import Path

from django.conf import settings


def media_root() -> Path:
    return Path(settings.MEDIA_ROOT)


class LocalObjectStore:
    def put_bytes(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get_bytes(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def _path(self, key: str) -> Path:
        # Prevent path traversal outside MEDIA_ROOT
        root = media_root().resolve()
        full = (root / key).resolve()
        if root != full and root not in full.parents:
            raise ValueError("Invalid storage key")
        return full


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def quarantine_key(team_id: str, file_id: str, filename: str) -> str:
    safe = Path(filename).name.replace("..", "_")
    return f"quarantine/{team_id}/{file_id}/{safe}"
