from importlib.metadata import files
from pathlib import Path
import shutil

from backend.utils.filename_parser import FilenameParser

# Root data directory
DATA_DIR = Path("data")

ACTIVITY_DIR = DATA_DIR / "activity"
SUMMARY_DIR = DATA_DIR / "summary"

# Create folders if they don't exist
ACTIVITY_DIR.mkdir(parents=True, exist_ok=True)
SUMMARY_DIR.mkdir(parents=True, exist_ok=True)


class FileManager:

    @staticmethod
    def save_file(source_file: Path) -> Path:
        """
        Save an uploaded file to the correct data folder
        based on its filename.

        Returns the destination path.
        """

        file_info = FilenameParser.parse(source_file.name)

        if not file_info["valid"]:
            raise ValueError(file_info["error"])

        if file_info["file_type"] == "activity":
            destination = ACTIVITY_DIR / source_file.name

        elif file_info["file_type"] == "summary":
            destination = SUMMARY_DIR / source_file.name

        else:
            raise ValueError("Unknown file type.")

        shutil.copy2(source_file, destination)

        return destination

    @staticmethod
    def get_activity_files():
        files = list(ACTIVITY_DIR.glob("*.xlsx"))
        files.extend(ACTIVITY_DIR.glob("*.xls"))

        return sorted(files)

    @staticmethod
    def get_summary_files():

        files = list(SUMMARY_DIR.glob("*.xlsx"))
        files.extend(SUMMARY_DIR.glob("*.xls"))

        return sorted(files)