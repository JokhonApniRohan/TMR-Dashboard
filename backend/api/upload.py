from fastapi import APIRouter
from pydantic import BaseModel

from services.upload_service import UploadService


router = APIRouter()


class UploadPayload(BaseModel):

    daily_rows: list = []
    summary_rows: list = []
    target_rows: list = []
    config: dict = {}


@router.post("/process")
def process_upload(payload: UploadPayload):

    return UploadService.process_upload(
        daily_rows=payload.daily_rows,
        summary_rows=payload.summary_rows,
        target_rows=payload.target_rows,
        config=payload.config
    )