from fastapi import APIRouter
from pydantic import BaseModel

from services.upload_service import UploadService


router = APIRouter()


class UploadPayload(BaseModel):

    daily_rows: list

    summary_rows: list

    config: dict = {}


@router.post("/process")
def process_upload(payload: UploadPayload):

    return UploadService.process_upload(
        payload.daily_rows,
        payload.summary_rows,
        payload.config
    )