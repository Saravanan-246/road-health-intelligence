"""Application settings, read from environment / .env. No secrets are hardcoded."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_DATABASE_URL = f"sqlite:///{(BACKEND_DIR / 'road_health.db').as_posix()}"


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: list[str]
    app_name: str = "Road Health Intelligence API"


def get_settings() -> Settings:
    origins = os.getenv("CORS_ORIGINS", "*")
    return Settings(
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
    )
