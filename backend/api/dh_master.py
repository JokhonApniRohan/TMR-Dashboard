from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.dh_master_service import DHMasterService


router = APIRouter()


class DHRecord(BaseModel):
    dh_code: str
    dh_name: str
    market_type: str
    daily_target: int


class ImportPayload(BaseModel):
    rows: list
    mode: str


@router.get("/")
def get_dh_master():

    return DHMasterService.get_all()


@router.get("/statistics")
def get_statistics():

    return DHMasterService.get_statistics()


@router.post("/")
def create_dh(record: DHRecord):

    try:
        return DHMasterService.create(record.model_dump())

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.put("/{dh_code}")
def update_dh(
    dh_code: str,
    record: DHRecord
):

    try:
        return DHMasterService.update(
            dh_code,
            record.model_dump()
        )

    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )


@router.delete("/{dh_code}")
def delete_dh(dh_code: str):

    try:
        return DHMasterService.delete(dh_code)

    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )


@router.post("/import")
def import_dh(payload: ImportPayload):

    if payload.mode.lower() == "replace":

        return DHMasterService.replace_all(
            payload.rows
        )

    return DHMasterService.merge(
        payload.rows
    )