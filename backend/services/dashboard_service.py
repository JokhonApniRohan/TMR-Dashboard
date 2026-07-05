from typing import Optional

import pandas as pd

from backend.services.cache_manager import CacheManager


class DashboardService:
    """
    Business logic for the TMR Dashboard.
    """

    # --------------------------------------------------
    # Private Helpers
    # --------------------------------------------------

    @staticmethod
    def _summary() -> pd.DataFrame:
        """
        Load summary cache.
        """
        return CacheManager.load_summary_cache()

    @staticmethod
    def _activity() -> pd.DataFrame:
        """
        Load activity cache.
        """
        return CacheManager.load_activity_cache()

    @staticmethod
    def _apply_filters(
        df: pd.DataFrame,
        filters: Optional[dict] = None
    ) -> pd.DataFrame:
        """
        Apply dashboard filters to a dataframe.
        """

        if df.empty or filters is None:
            return df

        result = df.copy()

        # Convert date column once
        result["date_"] = pd.to_datetime(result["date_"])

        if filters.get("start_date"):
            result = result[
                result["date_"] >= pd.to_datetime(filters["start_date"])
            ]

        if filters.get("end_date"):
            result = result[
                result["date_"] <= pd.to_datetime(filters["end_date"])
            ]

        if filters.get("region"):
            result = result[
                result["region"] == filters["region"]
            ]

        if filters.get("dh_code"):
            result = result[
                result["dh_code"] == filters["dh_code"]
            ]

        if filters.get("tmr_wallet"):
            result = result[
                result["tmr_wallet"] == filters["tmr_wallet"]
            ]

        return result

    # --------------------------------------------------
    # Dashboard Overview
    # --------------------------------------------------

    @staticmethod
    def get_overview(filters: Optional[dict] = None):

        df = DashboardService._summary()

        df = DashboardService._apply_filters(
            df,
            filters
        )

        if df.empty:
            return {
                "total_tmr": 0,
                "total_regions": 0,
                "total_dh": 0,
                "total_visits": 0,
                "avg_working_hours": "00:00:00",
                "avg_visit_per_tmr": 0,
                "under_15": 0,
                "between_15_50": 0,
                "above_50": 0,
                "no_activity": 0
            }

        working = pd.to_timedelta(df["working_time_h_m_s"])

        return {

            "total_tmr": int(
                df["tmr_wallet"].nunique()
            ),

            "total_regions": int(
                df["region"].nunique()
            ),

            "total_dh": int(
                df["dh_code"].nunique()
            ),

            "total_visits": int(
                df["agent_visit_count"].sum()
            ),

            "avg_working_hours": str(
                working.mean()
            ).split(".")[0],

            "avg_visit_per_tmr": round(
                df["agent_visit_count"].mean(),
                2
            ),

            "under_15": int(
                df["under 15 meter"].sum()
            ),

            "between_15_50": int(
                df[">15 and <50"].sum()
            ),

            "above_50": int(
                df["above 50 meter"].sum()
            ),

            "no_activity": int(
                df["no activity"].sum()
            )
        }

    # --------------------------------------------------
    # Filter Options
    # --------------------------------------------------

    @staticmethod
    def get_filter_options():

        df = DashboardService._summary()

        if df.empty:
            return {
                "regions": [],
                "dh_codes": [],
                "tmrs": [],
                "min_date": None,
                "max_date": None
            }

        df["date_"] = pd.to_datetime(df["date_"])

        return {

            "regions": sorted(
                df["region"]
                .dropna()
                .unique()
                .tolist()
            ),

            "dh_codes": sorted(
                df["dh_code"]
                .dropna()
                .unique()
                .tolist()
            ),

            "tmrs": (
                df[
                    ["tmr_wallet", "tmr_name"]
                ]
                .drop_duplicates()
                .sort_values("tmr_name")
                .to_dict("records")
            ),

            "min_date": df["date_"].min().strftime("%Y-%m-%d"),

            "max_date": df["date_"].max().strftime("%Y-%m-%d")
        }