from pathlib import Path
from contextlib import asynccontextmanager
from typing import List

import json
import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

with open(
    MODEL_DIR / "deployment_metadata.json",
    "r",
    encoding="utf-8"
) as f:
    METADATA = json.load(f)

FEATURES = METADATA["feature_names"]
THRESHOLD = float(METADATA["threshold"])

model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = joblib.load(
        MODEL_DIR / "haorshield_random_forest.joblib"
    )
    if hasattr(model, "named_steps") and "imputer" in model.named_steps:
        imputer = model.named_steps["imputer"]
        if not hasattr(imputer, "_fill_dtype") and hasattr(imputer, "_fit_dtype"):
            imputer._fill_dtype = imputer._fit_dtype
    yield
    model = None

app = FastAPI(
    title="HaorShield API",
    description="Retrospective flood classification API",
    version="1.0.0",
    lifespan=lifespan
)

# Deployed Cloudflare Pages, Cloudflare preview subdomains, and local Vite.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://haorshield.pages.dev",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https://[a-zA-Z0-9-]+\.haorshield\.pages\.dev$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

class PredictionRequest(BaseModel):
    VV_pre: float
    VH_pre: float
    VV_during: float
    VH_during: float
    VV_change: float
    VH_change: float
    rain_1d_mm: float = Field(ge=0)
    rain_3d_mm: float = Field(ge=0)
    rain_7d_mm: float = Field(ge=0)
    rain_30d_mm: float = Field(ge=0)
    temperature_24h_c: float
    soil_moisture_24h: float
    elevation_m: float
    slope_deg: float = Field(ge=0)

@app.get("/")
def home():
    return {
        "project": "HaorShield",
        "status": "running",
        "task": METADATA["task"]
    }

@app.get("/health")
def health():
    return {
        "status": "ok" if model is not None else "unavailable",
        "model_loaded": model is not None
    }

@app.get("/features")
def features():
    return {
        "feature_names": FEATURES,
        "feature_count": len(FEATURES),
        "threshold": THRESHOLD,
        "class_mapping": METADATA["class_mapping"]
    }

@app.post("/predict")
def predict(payload: PredictionRequest):

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )

    values = payload.model_dump()

    if not all(np.isfinite(v) for v in values.values()):
        raise HTTPException(
            status_code=422,
            detail="All features must be finite numbers"
        )

    # Preserve the exact training feature order.
    row = pd.DataFrame(
        [[values[name] for name in FEATURES]],
        columns=FEATURES
    )

    probability = float(
        model.predict_proba(row)[0, 1]
    )

    predicted_class = int(
        probability >= THRESHOLD
    )

    return {
        "predicted_class": predicted_class,
        "classification": METADATA[
            "class_mapping"
        ][str(predicted_class)],
        "flood_detection_probability": round(
            probability, 6
        ),
        "threshold": THRESHOLD,
        "model": "Random Forest",
        "interpretation": (
            "Retrospective MODIS flood-detection "
            "classification, not advance forecasting."
        )
    }
