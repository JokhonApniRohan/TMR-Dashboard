from pathlib import Path
import json
import pandas as pd


# ==========================
# Directories
# ==========================

BASE_DIR = Path(__file__).resolve().parent.parent

CACHE_DIR = BASE_DIR / "cache"

CACHE_DIR.mkdir(exist_ok=True)


DAILY_CACHE = CACHE_DIR / "daily_master.parquet"
SUMMARY_CACHE = CACHE_DIR / "summary_master.parquet"
METADATA_FILE = CACHE_DIR / "metadata.json"


class CacheManager:

    @staticmethod
    def load_daily():

        if not DAILY_CACHE.exists():
            return pd.DataFrame()

        if DAILY_CACHE.stat().st_size == 0:
            return pd.DataFrame()

        return pd.read_parquet(DAILY_CACHE)
    
    @staticmethod
    def load_summary():

        if not SUMMARY_CACHE.exists():
            return pd.DataFrame()

        if SUMMARY_CACHE.stat().st_size == 0:
            return pd.DataFrame()

        return pd.read_parquet(SUMMARY_CACHE)

    @staticmethod
    def save_daily(df: pd.DataFrame):

        df.to_parquet(
            DAILY_CACHE,
            index=False
        )

    @staticmethod
    def save_summary(df: pd.DataFrame):

        df.to_parquet(
            SUMMARY_CACHE,
            index=False
        )

    @staticmethod
    def load_metadata():

        if not METADATA_FILE.exists():
            return {}

        if METADATA_FILE.stat().st_size == 0:
            return {}

        try:
            with open(METADATA_FILE, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def save_metadata(data):

        with open(METADATA_FILE, "w") as f:
            json.dump(
                data,
                f,
                indent=4
            )

    @staticmethod
    def clear():

        if DAILY_CACHE.exists():
            DAILY_CACHE.unlink()

        if SUMMARY_CACHE.exists():
            SUMMARY_CACHE.unlink()

        if METADATA_FILE.exists():
            METADATA_FILE.unlink()