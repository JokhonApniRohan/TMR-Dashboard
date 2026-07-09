import pandas as pd

from services.cache_manager import CacheManager


class DHMasterService:

    @staticmethod
    def get_all():

        df = CacheManager.load_dh()

        if df.empty:
            return []

        df = df.sort_values("dh_code")

        return df.to_dict(orient="records")

    @staticmethod
    def get_statistics():

        df = CacheManager.load_dh()

        if df.empty:
            return {
                "total_dh": 0,
                "avg_daily_target": 0,
                "max_daily_target": 0,
                "max_target_dh": "",
                "market_types": 0,
                "total_daily_target": 0
            }

        total_target = int(df["daily_target"].sum())
        avg_target = round(df["daily_target"].mean(), 1)

        max_row = df.loc[df["daily_target"].idxmax()]

        return {
            "total_dh": len(df),
            "avg_daily_target": avg_target,
            "max_daily_target": int(max_row["daily_target"]),
            "max_target_dh": max_row["dh_code"],
            "market_types": int(df["market_type"].nunique()),
            "total_daily_target": total_target
        }

    @staticmethod
    def create(record):

        df = CacheManager.load_dh()

        if not df.empty:

            duplicate = df[
                df["dh_code"].str.lower()
                == record["dh_code"].lower()
            ]

            if not duplicate.empty:
                raise ValueError("DH Code already exists.")

        new_row = pd.DataFrame([record])

        df = pd.concat(
            [df, new_row],
            ignore_index=True
        )

        CacheManager.save_dh(df)

        return record

    @staticmethod
    def update(dh_code, record):

        df = CacheManager.load_dh()

        if df.empty:
            raise ValueError("DH not found.")

        idx = df.index[
            df["dh_code"] == dh_code
        ]

        if len(idx) == 0:
            raise ValueError("DH not found.")

        idx = idx[0]

        df.loc[idx, "dh_name"] = record["dh_name"]
        df.loc[idx, "market_type"] = record["market_type"]
        df.loc[idx, "daily_target"] = record["daily_target"]

        CacheManager.save_dh(df)

        return record

    @staticmethod
    def delete(dh_code):

        df = CacheManager.load_dh()

        original = len(df)

        df = df[
            df["dh_code"] != dh_code
        ]

        if len(df) == original:
            raise ValueError("DH not found.")

        CacheManager.save_dh(df)

        return {
            "message": "Deleted successfully."
        }

    @staticmethod
    def replace_all(rows):

        df = pd.DataFrame(rows)

        if not df.empty:

            df = df.drop_duplicates(
                subset=["dh_code"],
                keep="first"
            )

        CacheManager.save_dh(df)

        return {
            "records": len(df)
        }

    @staticmethod
    def merge(rows):

        existing = CacheManager.load_dh()

        incoming = pd.DataFrame(rows)

        if incoming.empty:
            return {
                "added": 0,
                "skipped": 0
            }

        if existing.empty:

            CacheManager.save_dh(incoming)

            return {
                "added": len(incoming),
                "skipped": 0
            }

        existing_codes = set(
            existing["dh_code"].str.lower()
        )

        new_rows = incoming[
            ~incoming["dh_code"].str.lower().isin(existing_codes)
        ]

        combined = pd.concat(
            [existing, new_rows],
            ignore_index=True
        )

        CacheManager.save_dh(combined)

        return {
            "added": len(new_rows),
            "skipped": len(incoming) - len(new_rows)
        }