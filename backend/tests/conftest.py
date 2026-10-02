import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

# Point the app at a throwaway database BEFORE any app module is imported.
_TMP_DIR = Path(tempfile.mkdtemp(prefix="road_health_test_"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.database.database import Base, init_db, make_engine  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:  # context manager runs the lifespan (init_db)
        yield c


@pytest.fixture()
def db_session() -> Iterator[Session]:
    """Isolated in-memory database per test."""
    engine = make_engine("sqlite://")
    init_db(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()
