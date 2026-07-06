from services.cache_manager import CacheManager


class ReportService:

    @staticmethod
    def get_tmr_report(wallet: str):
        """
        Return all available information for a single TMR.
        """

        daily = CacheManager.load_daily()
        summary = CacheManager.load_summary()

        daily = daily[daily["tmr_wallet"].astype(str) == str(wallet)]
        summary = summary[summary["tmr_wallet"].astype(str) == str(wallet)]

        if summary.empty and daily.empty:
            return None

        basic = {}

        if not summary.empty:
            first = summary.iloc[0]

            basic = {
                "wallet": str(first.get("tmr_wallet", "")),
                "name": first.get("tmr_name", ""),
                "region": first.get("region", ""),
                "dh_code": first.get("dh_code", ""),
                "distributor": first.get("distributor_house_name", "")
            }

        return {
            "basic_information": basic,
            "summary": summary.fillna("").to_dict(orient="records"),
            "daily_activity": daily.fillna("").to_dict(orient="records")
        }