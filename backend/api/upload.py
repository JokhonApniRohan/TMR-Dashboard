from pathlib import Path
import shutil

from fastapi import APIRouter, UploadFile, File

from backend.services.file_manager import FileManager

router = APIRouter(
    prefix="/upload",
    tags=["Upload"]
)

TEMP_FOLDER = Path("uploads/temp")
TEMP_FOLDER.mkdir(parents=True, exist_ok=True)


@router.post("/")
async def upload_file(file: UploadFile = File(...)):

    temp_file = TEMP_FOLDER / file.filename

    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        saved = FileManager.save_file(temp_file)

        return {
            "status": "success",
            "saved_to": str(saved)
        }

    finally:
        if temp_file.exists():
            temp_file.unlink()