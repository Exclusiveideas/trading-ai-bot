"""FastAPI prediction server for XGBoost trading models."""

import json
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from xgboost import XGBClassifier, XGBRegressor

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

app = FastAPI(title="Trading AI Prediction Server")

# Global model state
v1_model: XGBClassifier | None = None
v2_model: XGBClassifier | None = None
v3_model: XGBRegressor | None = None
feature_order: list[str] = []
mfe_bucket_labels: list[str] = []


def load_models() -> None:
    global v1_model, v2_model, v3_model, feature_order, mfe_bucket_labels

    # Load feature order from V1 meta
    v1_meta_path = MODELS_DIR / "xgb_v1b_multipattern_meta.json"
    with open(v1_meta_path) as f:
        v1_meta = json.load(f)
    feature_order = v1_meta["features"]

    # Load MFE bucket labels from V2/V3 meta
    v2v3_meta_path = MODELS_DIR / "xgb_v2v3_meta.json"
    with open(v2v3_meta_path) as f:
        v2v3_meta = json.load(f)
    mfe_bucket_labels = v2v3_meta["mfe_bucket_labels"]

    # Load V1 binary classifier
    v1_model = XGBClassifier()
    v1_model.load_model(str(MODELS_DIR / "xgb_v1b_multipattern.json"))

    # Load V2 multi-class classifier
    v2_model = XGBClassifier()
    v2_model.load_model(str(MODELS_DIR / "xgb_v2_multiclass.json"))

    # Load V3 regression model
    v3_model = XGBRegressor()
    v3_model.load_model(str(MODELS_DIR / "xgb_v3_regression.json"))

    print(f"Loaded 3 models with {len(feature_order)} features")
    print(f"MFE buckets: {mfe_bucket_labels}")


@app.on_event("startup")
async def startup() -> None:
    load_models()


class PredictRequest(BaseModel):
    features: dict[str, float | None]


class PredictResponse(BaseModel):
    v1_win_prob: float
    v2_mfe_bucket: str
    v2_bucket_probs: dict[str, float]
    v3_mfe_prediction: float


class BatchPredictRequest(BaseModel):
    items: list[dict[str, float | None]]


class HealthResponse(BaseModel):
    status: str
    models_loaded: int
    n_features: int


def features_to_array(features: dict[str, float | None]) -> np.ndarray:
    """Convert named feature dict to ordered numpy array matching model input."""
    row = []
    for name in feature_order:
        val = features.get(name)
        row.append(float("nan") if val is None else float(val))
    return np.array([row], dtype=np.float32)


def predict_single(features: dict[str, float | None]) -> PredictResponse:
    assert v1_model is not None and v2_model is not None and v3_model is not None

    X = features_to_array(features)

    # V1: binary win probability
    v1_proba = v1_model.predict_proba(X)[0]
    v1_win_prob = float(v1_proba[1]) if len(v1_proba) > 1 else float(v1_proba[0])

    # V2: MFE bucket probabilities
    v2_proba = v2_model.predict_proba(X)[0]
    v2_bucket_probs = {
        label: float(prob) for label, prob in zip(mfe_bucket_labels, v2_proba)
    }
    v2_predicted_idx = int(np.argmax(v2_proba))
    v2_mfe_bucket = mfe_bucket_labels[v2_predicted_idx]

    # V3: MFE regression
    v3_pred = v3_model.predict(X)[0]

    return PredictResponse(
        v1_win_prob=v1_win_prob,
        v2_mfe_bucket=v2_mfe_bucket,
        v2_bucket_probs=v2_bucket_probs,
        v3_mfe_prediction=float(v3_pred),
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    models_loaded = sum(
        1 for m in [v1_model, v2_model, v3_model] if m is not None
    )
    return HealthResponse(
        status="ok",
        models_loaded=models_loaded,
        n_features=len(feature_order),
    )


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest) -> PredictResponse:
    if v1_model is None:
        raise HTTPException(status_code=503, detail="Models not loaded")
    return predict_single(req.features)


@app.post("/predict/batch", response_model=list[PredictResponse])
async def predict_batch(req: BatchPredictRequest) -> list[PredictResponse]:
    if v1_model is None:
        raise HTTPException(status_code=503, detail="Models not loaded")
    return [predict_single(features) for features in req.items]
