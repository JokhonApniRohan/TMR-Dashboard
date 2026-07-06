import pandas as pd

from services.cache_manager import CacheManager


class UploadService:

    @staticmethod
    def process_upload(
        daily_rows,
        summary_rows,
        target_rows,
        config
    ):

        existing_daily_df = CacheManager.load_daily()
        daily_df = pd.DataFrame(daily_rows)
        combined_daily_df = pd.concat([existing_daily_df, daily_df], 
                             ignore_index=True)
        

        existing_summary_df = CacheManager.load_summary()
        summary_df = pd.DataFrame(summary_rows)
        combined_summary_df = pd.concat([existing_summary_df, summary_df], 
                                ignore_index=True)
        combined_summary_df.drop_duplicates(subset=['date_', 'tmr_wallet'], keep='last', inplace=True)

        existing_target_df = CacheManager.load_target()
        target_df = pd.DataFrame(target_rows)
        combined_target_df = pd.concat(
            [existing_target_df, target_df],
            ignore_index=True
        )

        # Keep only one record for each DH.
        combined_target_df.drop_duplicates(
            subset=["DH Code"],
            keep="last",
            inplace=True
        )

        CacheManager.save_daily(combined_daily_df)
        CacheManager.save_summary(combined_summary_df)
        CacheManager.save_target(combined_target_df)
        CacheManager.save_metadata(config)

        return {
            "daily_rows": daily_rows,
            "summary_rows": summary_rows,
            "target_rows": target_rows,
            "config": config
        }