from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import UserRole
from app.database.database import Base
from app.models.common import UtcDateTime, enum_type
from app.utils.ids import new_id, utc_now


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("USR"))
    role: Mapped[UserRole] = mapped_column(enum_type(UserRole), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utc_now, nullable=False)

    observations: Mapped[list["Observation"]] = relationship(back_populates="reporter")  # noqa: F821
