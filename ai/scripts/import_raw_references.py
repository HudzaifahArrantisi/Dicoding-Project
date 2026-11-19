"""One-time import of existing raw references into PostgreSQL."""

from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "ai" / "data" / "raw_references"
ENV = ROOT / "apps" / "api" / ".env"
ALLOWED = {".pdf", ".csv", ".json", ".md", ".txt", ".docx"}


def database_url() -> str:
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.partition("=")[2].strip().strip('"')
    raise RuntimeError("DATABASE_URL tidak ditemukan di apps/api/.env")


def main() -> None:
    files = [path for path in SOURCE.rglob("*") if path.is_file()
             and path.suffix.lower() in ALLOWED and path.name.lower() != "readme.md"]
    with psycopg.connect(database_url()) as connection:
        with connection.cursor() as cursor:
            for path in files:
                content = path.read_bytes()
                if not content or len(content) > 10 * 1024 * 1024:
                    raise ValueError(f"Ukuran referensi di luar batas: {path.name}")
                category = path.suffix.lower().lstrip(".")
                mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
                cursor.execute("""
                    insert into raw_references (category, file_name, mime_type, size_bytes, sha256, content)
                    values (%s, %s, %s, %s, %s, %s)
                    on conflict (category, file_name) do nothing
                """, (category, path.name, mime, len(content), hashlib.sha256(content).hexdigest(), content))
    print(f"Referensi lama tersedia di database: {len(files)} file")


if __name__ == "__main__":
    main()
