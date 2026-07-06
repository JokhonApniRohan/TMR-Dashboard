from fastapi import APIRouter

from services.cache_manager import CacheManager


router = APIRouter()


@router.get("/data")
def get_data():

    daily = CacheManager.load_daily()

    summary = CacheManager.load_summary()

    config = CacheManager.load_metadata()

    return {

        "daily_rows": daily.to_dict(orient="records"),

        "summary_rows": summary.to_dict(orient="records"),

        "config": config
    }


@router.delete("/data")
def clear_data():

    CacheManager.clear()

    return {
        "success": True
    }