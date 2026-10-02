"""Explainable result from the reference-image validation prototype."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.core.enums import DefectType


class ImageValidationResponse(BaseModel):
    valid: bool
    status: Literal["VALID", "INVALID", "REVIEW_REQUIRED"]
    image_type: Literal["road_defect", "road_scene", "non_road", "unknown"]
    defect_type: DefectType | None
    reason: str
    reference_match: bool
    reference_similarity: float | None = None
    analyzed_at: datetime
