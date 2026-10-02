"""Image validation endpoint."""

from email import policy
from email.parser import BytesParser

from fastapi import APIRouter, HTTPException, Request

from app.schemas.image_validation import ImageValidationResponse
from app.services.image_validation import MAX_IMAGE_BYTES, validate_image

router = APIRouter(prefix="/api/detection", tags=["image validation"])


def _extract_image(body: bytes, content_type: str) -> bytes:
    if content_type.lower().startswith("multipart/form-data"):
        message = BytesParser(policy=policy.default).parsebytes(
            ("Content-Type: " + content_type + "\r\nMIME-Version: 1.0\r\n\r\n").encode("utf-8") + body
        )
        for part in message.iter_parts():
            if part.get_param("name", header="content-disposition") == "image":
                return part.get_payload(decode=True) or b""
        raise HTTPException(status_code=400, detail="Multipart field 'image' is required")
    return body


@router.post("/validate-image", response_model=ImageValidationResponse)
async def validate_uploaded_image(request: Request) -> ImageValidationResponse:
    body = await request.body()
    if len(body) > MAX_IMAGE_BYTES + 64_000:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB upload limit")
    image_bytes = _extract_image(body, request.headers.get("content-type", "application/octet-stream"))
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is required")
    return ImageValidationResponse(**validate_image(image_bytes))
