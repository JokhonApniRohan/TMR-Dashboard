from fastapi import APIRouter
from backend.services.cache_manager import CacheManager

router = APIRouter(
    prefix="/cache",
    tags=["Cache"]
)


@router.get("/activity")
def get_activity():

    df = CacheManager.load_activity_cache()

    return {
        "rows": len(df),
        "columns": list(df.columns),
        "data": df.to_dict(orient="records")
    }


@router.get("/summary")
def get_summary():

    df = CacheManager.load_summary_cache()

    return {
        "rows": len(df),
        "columns": list(df.columns),
        "data": df.to_dict(orient="records")
    }


@router.post("/rebuild")
def rebuild_cache():

    activity_result = CacheManager.build_activity_cache()

    summary_result = CacheManager.build_summary_cache()

    return {
        "activity": activity_result,
        "summary": summary_result
    }


@router.get("/status")
def cache_status():

    activity = CacheManager.load_activity_cache()

    summary = CacheManager.load_summary_cache()

    return {
        "activity_rows": len(activity),
        "summary_rows": len(summary),
        "activity_columns": len(activity.columns),
        "summary_columns": len(summary.columns)
    }