"""Endpoint mechanics tests use synthetic pixels, not road-image accuracy claims."""

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

from app.services import image_validation


def _photo(color: tuple[int, int, int], marked: bool = False) -> bytes:
    image = Image.new("RGB", (64, 48), color)
    if marked:
        draw = ImageDraw.Draw(image)
        draw.ellipse((18, 12, 44, 38), fill=(26, 24, 25))
        draw.line((3, 8, 60, 39), fill=(125, 124, 121), width=3)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_matching_reference_returns_valid_demo_category(client, tmp_path: Path, monkeypatch) -> None:
    root = tmp_path / "reference_images" / "pothole"
    root.mkdir(parents=True)
    (root / "pothole_01.png").write_bytes(_photo((78, 77, 74), marked=True))
    monkeypatch.setattr(image_validation, "REFERENCE_ROOT", root.parent)

    response = client.post(
        "/api/detection/validate-image",
        files={"image": ("report.png", _photo((78, 77, 74), marked=True), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["status"] == "VALID"
    assert body["defect_type"] == "POTHOLE"
    assert body["reference_match"] is True
    assert body["reference_similarity"] == 1.0


def test_unmatched_image_is_invalid(client, tmp_path: Path, monkeypatch) -> None:
    root = tmp_path / "reference_images" / "pothole"
    root.mkdir(parents=True)
    (root / "pothole_01.png").write_bytes(_photo((78, 77, 74), marked=True))
    monkeypatch.setattr(image_validation, "REFERENCE_ROOT", root.parent)

    response = client.post(
        "/api/detection/validate-image",
        files={"image": ("random.png", _photo((18, 48, 205)), "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "INVALID"
    assert response.json()["valid"] is False


def test_empty_reference_set_requires_review(client, tmp_path: Path, monkeypatch) -> None:
    root = tmp_path / "reference_images"
    root.mkdir()
    monkeypatch.setattr(image_validation, "REFERENCE_ROOT", root)

    response = client.post(
        "/api/detection/validate-image",
        files={"image": ("report.png", _photo((78, 77, 74), marked=True), "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "REVIEW_REQUIRED"
    assert response.json()["valid"] is False
