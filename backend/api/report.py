from fastapi import APIRouter, HTTPException

from services.report_service import ReportService

router = APIRouter(
    prefix="/api/report",
    tags=["Report"]
)


@router.get("/{wallet}")
def get_tmr_report(wallet: str):
    """
    Return complete report for a single TMR.
    """

    report = ReportService.get_tmr_report(wallet)

    if report is None:
        raise HTTPException(
            status_code=404,
            detail="TMR not found."
        )

    return report