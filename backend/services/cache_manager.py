from pathlib import Path
import json

import pandas as pd

from backend.services.file_manager import FileManager
from backend.services.excel_loader import ExcelLoader


CACHE_DIR = Path("backend/cache")

CACHE_DIR.mkdir(parents=True, exist_ok=True)

METADATA_FILE = CACHE_DIR / "metadata.json"

ACTIVITY_CACHE = CACHE_DIR / "activity_master.parquet"

SUMMARY_CACHE = CACHE_DIR / "summary_master.parquet"


class CacheManager:

    @staticmethod
    def _load_metadata():

        default_metadata = {
            "processed_activity_files": [],
            "processed_summary_files": []
        }

        if not METADATA_FILE.exists():
            CacheManager._save_metadata(default_metadata)
            return default_metadata

        try:
            with open(METADATA_FILE, "r") as f:
                return json.load(f)

        except (json.JSONDecodeError, FileNotFoundError):
            CacheManager._save_metadata(default_metadata)
            return default_metadata

    @staticmethod
    def _save_metadata(metadata):

        with open(METADATA_FILE, "w") as f:
            json.dump(metadata, f, indent=4)
    


    @staticmethod
    def build_activity_cache():

        metadata = CacheManager._load_metadata()

        processed = set(metadata["processed_activity_files"])

        files = FileManager.get_activity_files()

        new_files = [
            file for file in files
            if file.name not in processed
        ]

        if not new_files:
            return "No new activity files."

        new_df = ExcelLoader.load_multiple(new_files)

        if ACTIVITY_CACHE.exists():

            old_df = pd.read_parquet(ACTIVITY_CACHE)

            new_df = pd.concat(
                [old_df, new_df],
                ignore_index=True
            )

        new_df.to_parquet(
            ACTIVITY_CACHE,
            index=False
        )

        metadata["processed_activity_files"].extend(
            file.name
            for file in new_files
        )

        CacheManager._save_metadata(metadata)

        return f"Imported {len(new_files)} activity file(s)."
        
    @staticmethod
    def build_summary_cache():

        metadata = CacheManager._load_metadata()

        processed = set(metadata["processed_summary_files"])

        files = FileManager.get_summary_files()

        new_files = [
            file for file in files
            if file.name not in processed
        ]

        if not new_files:
            return "No new summary files."

        new_df = ExcelLoader.load_multiple(new_files)

        if SUMMARY_CACHE.exists():

            old_df = pd.read_parquet(SUMMARY_CACHE)

            new_df = pd.concat(
                [old_df, new_df],
                ignore_index=True
            )

        new_df.to_parquet(
            SUMMARY_CACHE,
            index=False
        )

        metadata["processed_summary_files"].extend(
            file.name
            for file in new_files
        )

        CacheManager._save_metadata(metadata)

        return f"Imported {len(new_files)} summary file(s)."

    @staticmethod
    def load_activity_cache():

        if not ACTIVITY_CACHE.exists():
            return pd.DataFrame()

        return pd.read_parquet(ACTIVITY_CACHE)


    @staticmethod
    def load_summary_cache():

        if not SUMMARY_CACHE.exists():
            return pd.DataFrame()

        return pd.read_parquet(SUMMARY_CACHE)