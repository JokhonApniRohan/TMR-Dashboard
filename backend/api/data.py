from fastapi import APIRouter

from backend.services.file_manager import FileManager
from backend.services.excel_loader import ExcelLoader

router = APIRouter(
    prefix="/data",
    tags=["Data"]
)


@router.get("/summary")

def load_summary():

    files = FileManager.get_summary_files()

    df = ExcelLoader.load_multiple(files)

    return {
        "rows": len(df),
        "columns": list(df.columns)
    }


@router.get("/activity")

def load_activity():

    files = FileManager.get_activity_files()

    df = ExcelLoader.load_multiple(files)

    return {
        "rows": len(df),
        "columns": list(df.columns)
    }