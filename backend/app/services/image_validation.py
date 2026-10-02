"""Conservative image-to-reference comparison; replaceable by a trained CV model later."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

REFERENCE_ROOT = Path(__file__).resolve().parents[2] / "data" / "reference_images"
SUPPORTED_CATEGORIES = {
    "pothole": "POTHOLE",
    "crack": "CRACK",
    "rutting": "RUTTING",
    "surface_wear": "SURFACE_WEAR",
    "other": "OTHER",
}
ROAD_SCENE_CATEGORY = "road"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MIN_REFERENCE_SIMILARITY = 0.88
FEATURE_SIZE = (16, 16)


class InvalidImage(ValueError):
    """The uploaded bytes are not a supported, safely decodable image."""


@dataclass(frozen=True)
class ReferenceSample:
    category: str
    path: Path
    features: tuple[float, ...]


def _features(image_bytes: bytes) -> tuple[float, ...]:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise InvalidImage("Image dimensions are too large.")
            image.load()
            rgb = image.convert("RGB").resize(FEATURE_SIZE, Image.Resampling.BILINEAR)
    except InvalidImage:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImage("Uploaded file is not a supported image.") from exc

    pixels = [component / 255 for pixel in rgb.getdata() for component in pixel]
    histogram = [0.0] * 48
    for pixel in rgb.getdata():
        for channel, component in enumerate(pixel):
            histogram[channel * 16 + min(component // 16, 15)] += 1
    pixel_count = FEATURE_SIZE[0] * FEATURE_SIZE[1]
    histogram = [value / pixel_count for value in histogram]

    gray = rgb.convert("L")
    gray_values = list(gray.getdata())
    width, height = FEATURE_SIZE
    edges = 0
    edge_count = 0
    for y in range(height):
        for x in range(width):
            current = gray_values[y * width + x]
            if x + 1 < width:
                edges += abs(current - gray_values[y * width + x + 1]) > 24
                edge_count += 1
            if y + 1 < height:
                edges += abs(current - gray_values[(y + 1) * width + x]) > 24
                edge_count += 1
    return tuple(pixels + histogram + [edges / edge_count if edge_count else 0.0])


def _similarity(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    pixel_count = FEATURE_SIZE[0] * FEATURE_SIZE[1] * 3
    pixel_error = sum(abs(a - b) for a, b in zip(left[:pixel_count], right[:pixel_count])) / pixel_count
    hist_end = pixel_count + 48
    histogram_error = sum(abs(a - b) for a, b in zip(left[pixel_count:hist_end], right[pixel_count:hist_end])) / 48
    edge_error = abs(left[-1] - right[-1])
    return max(0.0, 1.0 - (pixel_error * 0.65 + histogram_error * 0.30 + edge_error * 0.05))


def _load_references() -> list[ReferenceSample]:
    samples: list[ReferenceSample] = []
    categories = {**SUPPORTED_CATEGORIES, ROAD_SCENE_CATEGORY: ROAD_SCENE_CATEGORY}
    for folder, category in categories.items():
        directory = REFERENCE_ROOT / folder
        if not directory.is_dir():
            continue
        for path in sorted(directory.iterdir()):
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS or not path.is_file():
                continue
            try:
                if path.stat().st_size > MAX_IMAGE_BYTES:
                    continue
                samples.append(ReferenceSample(category, path, _features(path.read_bytes())))
            except (OSError, InvalidImage):
                continue
    return samples


def validate_image(image_bytes: bytes) -> dict[str, object]:
    """Compare a photo to curated demo references; never infer category from reporter input."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    def result(status: str, image_type: str, defect_type: str | None, reason: str,
               reference_match: bool, similarity: float | None) -> dict[str, object]:
        return {
            "valid": status == "VALID",
            "status": status,
            "image_type": image_type,
            "defect_type": defect_type,
            "reason": reason,
            "reference_match": reference_match,
            "reference_similarity": round(similarity, 4) if similarity is not None else None,
            "analyzed_at": now,
        }

    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        return result("INVALID", "non_road", None, "Image is empty or exceeds the 10 MB upload limit.", False, None)
    try:
        uploaded_features = _features(image_bytes)
    except InvalidImage as exc:
        return result("INVALID", "non_road", None, str(exc), False, None)

    samples = _load_references()
    if not samples:
        return result(
            "REVIEW_REQUIRED", "unknown", None,
            "Demo reference samples are not configured, so this image cannot be validated yet.", False, None,
        )

    matches = sorted(
        ((_similarity(uploaded_features, sample.features), sample) for sample in samples),
        key=lambda item: item[0],
        reverse=True,
    )
    similarity, best = matches[0]
    defect_samples = [sample for _, sample in matches if sample.category in SUPPORTED_CATEGORIES.values()]
    if not defect_samples:
        return result(
            "REVIEW_REQUIRED", "unknown", None,
            "No supported road-defect category reference samples are available.", False, similarity,
        )

    defect_similarity, defect_sample = max(
        ((score, sample) for score, sample in matches if sample.category in SUPPORTED_CATEGORIES.values()),
        key=lambda item: item[0],
    )
    if defect_similarity >= MIN_REFERENCE_SIMILARITY:
        label = next(name.replace("_", " ") for name, value in SUPPORTED_CATEGORIES.items() if value == defect_sample.category)
        return result(
            "VALID", "road_defect", defect_sample.category,
            "Image is visually similar to the " + label + " demo reference samples.", True, defect_similarity,
        )

    if best.category == ROAD_SCENE_CATEGORY and similarity >= MIN_REFERENCE_SIMILARITY:
        return result(
            "REVIEW_REQUIRED", "road_scene", None,
            "Image matches a road-scene sample but no supported defect category sample.", True, similarity,
        )
    return result(
        "INVALID", "non_road", None,
        "Image did not match a supported road-defect reference sample.", False, defect_similarity,
    )
