import pandas as pd

from services.cache_manager import CacheManager


class UploadService:

    @staticmethod
    def process_upload(
        daily_rows,
        summary_rows,
        config
    ):

        daily_df = pd.DataFrame(daily_rows)
        summary_df = pd.DataFrame(summary_rows)

        CacheManager.save_daily(daily_df)
        CacheManager.save_summary(summary_df)
        CacheManager.save_metadata(config)

        return {
            "daily_rows": daily_rows,
            "summary_rows": summary_rows,
            "config": config
        }