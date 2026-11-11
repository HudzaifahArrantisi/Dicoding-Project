"""Apply the additive analysis-run migration using the existing AI database settings."""
from pathlib import Path
import os

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "apps" / "api" / ".env")
load_dotenv(ROOT / "ai" / ".env", override=False)

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL belum tersedia")

migration = (ROOT / "neon" / "migrations" / "20261111_analysis_runs.sql").read_text(encoding="utf-8")
with psycopg.connect(database_url, autocommit=True, connect_timeout=10) as connection:
    connection.execute(migration)
print("Migrasi analysis_runs selesai")
