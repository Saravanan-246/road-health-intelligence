from enum import Enum

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum


def enum_type(enum_cls: type[Enum]) -> SAEnum:
    """Store enum *values* (e.g. 'Critical') as validated strings, portable across databases."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        values_callable=lambda cls: [m.value for m in cls],
        validate_strings=True,
        length=20,
    )


UtcDateTime = DateTime(timezone=True)
