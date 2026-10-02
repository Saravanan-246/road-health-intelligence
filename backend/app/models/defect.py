"""CanonicalDefect: the one persistent record of one physical road defect."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DefectStatus, DefectType, PriorityTier, Severity
from app.database.database import Base
from app.models.common import UtcDateTime, enum_type
from app.utils.ids import new_id, utc_now


class CanonicalDefect(Base):
    __tablename__ = "canonical_defects"
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_def_latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_def_longitude"),
        CheckConstraint("confidence IS NULL OR (confidence >= 0 AND confidence <= 1)", name="ck_def_confidence"),
        CheckConstraint("evidence_count >= 0", name="ck_def_evidence_count"),
        CheckConstraint(
            "priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100)",
            name="ck_def_priority",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("RD"))
    defect_type: Mapped[DefectType] = mapped_column(enum_type(DefectType), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[Severity] = mapped_column(enum_type(Severity), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # NULL until the priority engine (Phase 2+) has computed them — never a placeholder score.
    priority_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    priority_tier: Mapped[PriorityTier | None] = mapped_column(enum_type(PriorityTier), nullable=True)

    status: Mapped[DefectStatus] = mapped_column(
        enum_type(DefectStatus), default=DefectStatus.CANDIDATE, nullable=False, index=True
    )

    first_reported_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    last_reported_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    repaired_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utc_now, nullable=False)

    observations: Mapped[list["Observation"]] = relationship(  # noqa: F821
        back_populates="canonical_defect", order_by="Observation.captured_at"
    )
    maintenance_events: Mapped[list["MaintenanceEvent"]] = relationship(  # noqa: F821
        back_populates="defect", order_by="MaintenanceEvent.created_at"
    )
