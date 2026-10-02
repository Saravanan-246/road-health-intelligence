"""MaintenanceEvent: append-only audit trail of lifecycle status changes."""

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DefectStatus
from app.database.database import Base
from app.models.common import UtcDateTime, enum_type
from app.utils.ids import new_id, utc_now


class MaintenanceEvent(Base):
    __tablename__ = "maintenance_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("ME"))
    defect_id: Mapped[str] = mapped_column(ForeignKey("canonical_defects.id"), nullable=False, index=True)
    # NULL for the event that records the defect's creation.
    previous_status: Mapped[DefectStatus | None] = mapped_column(enum_type(DefectStatus), nullable=True)
    new_status: Mapped[DefectStatus] = mapped_column(enum_type(DefectStatus), nullable=False)
    changed_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utc_now, nullable=False)

    defect: Mapped["CanonicalDefect"] = relationship(back_populates="maintenance_events")  # noqa: F821
