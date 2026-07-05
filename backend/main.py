from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.upload import router as upload_router
from backend.api.data import router as data_router
from backend.api.dashboard import router as dashboard_router
from backend.api.cache import router as cache_router
from backend.api.dashboard import router as dashboard_router

app = FastAPI(
    title="TMR Dashboard API",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change later in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(dashboard_router)
app.include_router(upload_router)
app.include_router(data_router)
app.include_router(cache_router)



@app.get("/")
def root():
    return {
        "message": "TMR Dashboard Backend Running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }