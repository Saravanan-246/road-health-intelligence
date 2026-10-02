from datetime import datetime, timezone

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, StatementError

from app.core.enums import (
    DefectStatus,
    DefectType,
    DetectionStatus,
    DuplicateDecision,
    LocationSource,
    PriorityTier,
    Severity,
    UserRole,
)
from app.database.database import engine
from app.models import CanonicalDefect, ImmutableObservationError, MaintenanceEvent, Observation, User

NOW = datetime(2026, 9, 29, 10, 0, tzinfo=timezone.utc)
TABLES = {"users", "observations", "canonical_defects", "maintenance_events"}


def make_observation(user: User, **overrides) -> Observation:
    fields = dict(
        reporter_id=user.id,
        image_ref="uploads/test.jpg",
        latitude=11.0168,
        longitude=76.9558,
        gps_accuracy_m=6.5,
        location_source=LocationSource.DEVICE,
        captured_at=NOW,
        defect_type=DefectType.POTHOLE,
        severity=Severity.HIGH,
        detection_confidence=None,
        detection_status=DetectionStatus.UNAVAILABLE,
    )
    fields.update(overrides)
    return Observation(**fields)


def test_app_database_initialises(client):
    # The client fixture ran the lifespan, which called init_db() on the app database.
    assert TABLES <= set(inspect(engine).get_table_names())


def test_tables_created(db_session):
    assert TABLES <= set(inspect(db_session.get_bind()).get_table_names())


def test_create_full_chain(db_session):
    citizen = User(role=UserRole.CITIZEN)
    admin = User(role=UserRole.ADMIN)
    db_session.add_all([citizen, admin])
    db_session.flush()

    defect = CanonicalDefect(
        defect_type=DefectType.POTHOLE,
        latitude=11.0168,
        longitude=76.9558,
        severity=Severity.HIGH,
        first_reported_at=NOW,
        last_reported_at=NOW,
    )
    db_session.add(defect)
    db_session.flush()

    obs1 = make_observation(citizen, canonical_defect_id=defect.id, duplicate_decision=DuplicateDecision.DISTINCT)
    obs2 = make_observation(citizen, canonical_defect_id=defect.id, duplicate_decision=DuplicateDecision.MERGE)
    event = MaintenanceEvent(
        defect_id=defect.id,
        previous_status=DefectStatus.CANDIDATE,
        new_status=DefectStatus.VERIFIED,
        changed_by=admin.id,
        note="Inspected on site",
    )
    db_session.add_all([obs1, obs2, event])
    db_session.commit()
    db_session.refresh(defect)

    assert citizen.id.startswith("USR-") and defect.id.startswith("RD-") and obs1.id.startswith("OB-")
    assert defect.status == DefectStatus.CANDIDATE  # default
    assert defect.priority_score is None and defect.priority_tier is None  # not computed yet
    assert {o.id for o in defect.observations} == {obs1.id, obs2.id}
    assert defect.maintenance_events[0].new_status == DefectStatus.VERIFIED
    assert obs1.reporter.role == UserRole.CITIZEN


def test_priority_tier_stored_as_contract_value(db_session):
    defect = CanonicalDefect(
        defect_type=DefectType.CRACK, latitude=0, longitude=0, severity=Severity.LOW,
        priority_score=80, priority_tier=PriorityTier.CRITICAL,
        first_reported_at=NOW, last_reported_at=NOW,
    )
    db_session.add(defect)
    db_session.commit()
    raw = db_session.get_bind().connect().exec_driver_sql(
        "SELECT priority_tier FROM canonical_defects"
    ).scalar_one()
    assert raw == "Critical"


def test_observation_evidence_is_immutable(db_session):
    user = User(role=UserRole.CITIZEN)
    db_session.add(user)
    db_session.flush()
    obs = make_observation(user)
    db_session.add(obs)
    db_session.commit()

    obs.latitude = 12.0
    with pytest.raises(ImmutableObservationError):
        db_session.commit()
    db_session.rollback()


def test_observation_link_fields_can_be_set(db_session):
    user = User(role=UserRole.CITIZEN)
    db_session.add(user)
    db_session.flush()
    obs = make_observation(user)
    db_session.add(obs)
    db_session.commit()

    obs.duplicate_decision = DuplicateDecision.REVIEW
    db_session.commit()
    assert obs.duplicate_decision == DuplicateDecision.REVIEW


def test_invalid_coordinates_rejected(db_session):
    user = User(role=UserRole.CITIZEN)
    db_session.add(user)
    db_session.flush()
    db_session.add(make_observation(user, latitude=123.0))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_invalid_confidence_rejected(db_session):
    user = User(role=UserRole.CITIZEN)
    db_session.add(user)
    db_session.flush()
    db_session.add(make_observation(user, detection_confidence=1.5))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_foreign_keys_enforced(db_session):
    db_session.add(make_observation(User(id="USR-missing", role=UserRole.CITIZEN)))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_invalid_enum_value_rejected(db_session):
    db_session.add(User(role="SUPERUSER"))
    with pytest.raises(StatementError):
        db_session.commit()
    db_session.rollback()
