"""Block until Postgres accepts connections."""

from __future__ import annotations

import os
import time

import psycopg


def main() -> None:
    host = os.environ.get("POSTGRES_HOST", "postgres")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    dbname = os.environ["POSTGRES_DB"]
    user = os.environ["POSTGRES_USER"]
    password = os.environ["POSTGRES_PASSWORD"]

    deadline = time.time() + 60
    while True:
        try:
            with psycopg.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                connect_timeout=3,
            ) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
            return
        except Exception as exc:  # noqa: BLE001
            if time.time() >= deadline:
                raise SystemExit(f"Database not ready: {exc}") from exc
            time.sleep(1)


if __name__ == "__main__":
    main()
