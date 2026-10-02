"""Contract values. Source of truth: team/contracts/*.md and src/api/types.ts.

Values here must stay identical to the frontend contract; change both together.
"""

from enum import Enum


class UserRole(str, Enum):
    CITIZEN = "CITIZEN"
    ADMIN = "ADMIN"


class DefectType(str, Enum):
    POTHOLE = "POTHOLE"
    CRACK = "CRACK"
    RUTTING = "RUTTING"
    SURFACE_WEAR = "SURFACE_WEAR"
    OTHER = "OTHER"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    SEVERE = "SEVERE"


class LocationSource(str, Enum):
    """UNLOCATED exists in the frontend type but is never persisted: observations must be geotagged."""

    EXIF = "EXIF"
    DEVICE = "DEVICE"
    MANUAL = "MANUAL"


class DetectionStatus(str, Enum):
    """MODEL / UNAVAILABLE mirror the frontend DetectionSource.

    FAILED is a backend addition: the detector was called and errored, recorded
    explicitly instead of being disguised as a result.
    """

    MODEL = "MODEL"
    UNAVAILABLE = "UNAVAILABLE"
    FAILED = "FAILED"


class DuplicateDecision(str, Enum):
    MERGE = "MERGE"
    REVIEW = "REVIEW"
    DISTINCT = "DISTINCT"


class DefectStatus(str, Enum):
    CANDIDATE = "CANDIDATE"
    CORROBORATED = "CORROBORATED"
    VERIFIED = "VERIFIED"
    SCHEDULED = "SCHEDULED"
    REPAIRED = "REPAIRED"
    RECURRED = "RECURRED"


class PriorityTier(str, Enum):
    """Values match the frontend PriorityTier ('Critical' | 'High' | 'Medium' | 'Low')."""

    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
