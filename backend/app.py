from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.upload import router as upload_router
from api.data import router as data_router
from api.report import router as report_router



app = FastAPI(
    title="TMR Dashboard API",
    version="1.0.0"
)
app.include_router(report_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    upload_router,
    prefix="/api/upload",
    tags=["Upload"]
)

app.include_router(
    data_router,
    prefix="/api",
    tags=["Data"]
)

@app.get("/")
def root():
    return {
        "status": "Running"
    }