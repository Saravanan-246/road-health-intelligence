"""Prefixed IDs. RD- / OB- follow the examples in team/contracts/api.contract.md."""

import uuid
from datetime import datetime, timezone


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
