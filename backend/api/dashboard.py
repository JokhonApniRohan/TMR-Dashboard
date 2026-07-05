from fastapi import APIRouter, Query

from backend.services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/overview")
def dashboard_overview(

    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    region: str | None = Query(None),
    dh_code: str | None = Query(None),
    tmr_wallet: str | None = Query(None)

):

    filters = {
        "start_date": start_date,
        "end_date": end_date,
        "region": region,
        "dh_code": dh_code,
        "tmr_wallet": tmr_wallet
    }

    return DashboardService.get_overview(filters)

@router.get("/filter-options")
def filter_options():

    return DashboardService.get_filter_options()