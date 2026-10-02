"""Observation: one immutable piece of evidence (one report, one image, one location fix)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Float, ForeignKey, String, event, inspect
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import DefectType, DetectionStatus, DuplicateDecision, LocationSource, Severity
from app.database.database import Base
from app.models.common import UtcDateTime, enum_type
from app.utils.ids import new_id, utc_now

# The only columns that may change after insert: the result of linking this
# evidence to a canonical defect. Everything else is the captured evidence.
MUTABLE_LINK_FIELDS = frozenset({"duplicate_decision", "canonical_defect_id"})


class ImmutableObservationError(ValueError):
    pass


class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_obs_latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_obs_longitude"),
        CheckConstraint("gps_accuracy_m IS NULL OR gps_accuracy_m >= 0", name="ck_obs_accuracy"),
        CheckConstraint(
            "detection_confidence IS NULL OR (detection_confidence >= 0 AND detection_confidence <= 1)",
            name="ck_obs_confidence",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("OB"))
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    image_ref: Mapped[str] = mapped_column(String(512), nullable=False)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    gps_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_source: Mapped[LocationSource] = mapped_column(enum_type(LocationSource), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)

    defect_type: Mapped[DefectType] = mapped_column(enum_type(DefectType), nullable=False)
    severity: Mapped[Severity] = mapped_column(enum_type(Severity), nullable=False)
    # NULL when no real detector produced a confidence (never a fabricated value).
    detection_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    detection_status: Mapped[DetectionStatus] = mapped_column(enum_type(DetectionStatus), nullable=False)

    # Set once by duplicate analysis (Phase 2); NULL until analysed.
    duplicate_decision: Mapped[DuplicateDecision | None] = mapped_column(
        enum_type(DuplicateDecision), nullable=True
    )
    canonical_defect_id: Mapped[str | None] = mapped_column(
        ForeignKey("canonical_defects.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utc_now, nullable=False)

    reporter: Mapped["User"] = relationship(back_populates="observations")  # noqa: F821
    canonical_defect: Mapped["CanonicalDefect | None"] = relationship(  # noqa: F821
        back_populates="observations"
    )


@event.listens_for(Observation, "before_update")
def _enforce_immutability(_mapper, _connection, target: Observation) -> None:
    state = inspect(target)
    changed = {
        attr.key
        for attr in state.mapper.column_attrs
        if state.attrs[attr.key].history.has_changes()
    }
    forbidden = changed - MUTABLE_LINK_FIELDS
    if forbidden:
        raise ImmutableObservationError(
            f"Observation evidence is immutable; attempted to change: {sorted(forbidden)}"
        )
