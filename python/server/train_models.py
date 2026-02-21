"""Reusable training pipeline for V1b, V2, V3 XGBoost models.

Extracted from phase5 and phase6 Jupyter notebooks.
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2
import xgboost as xgb
from sklearn.metrics import accuracy_score, roc_auc_score, mean_absolute_error, r2_score

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

CATEGORICAL_COLS = [
    "pattern_type",
    "timeframe",
    "trend_state",
    "trading_session",
    "rsi_zone",
    "htf_d_trend_state",
    "htf_h4_trend_state",
    "htf_h1_trend_state",
]

META_COLS_TO_DROP = [
    "id",
    "pair",
    "start_timestamp",
    "end_timestamp",
    "entry_price",
    "stop_loss",
    "take_profit",
    "notes",
    "nearest_round_number",
    "nearest_support",
    "nearest_resistance",
]

ANALYSIS_COLS_TO_DROP = [
    "outcome",
    "r_multiple",
    "bars_to_outcome",
    "max_favorable_excursion",
    "quality_rating",
]

MFE_BUCKET_EDGES = [0, 0.5, 1.0, 1.5, 2.0, np.inf]
MFE_BUCKET_LABELS = ["<0.5R", "0.5-1R", "1-1.5R", "1.5-2R", "2R+"]


def export_training_data(db_url: str, output_path: str) -> int:
    """Export labeled_patterns + resolved signals to CSV for training."""
    conn = psycopg2.connect(db_url)

    # Get labeled patterns (historical training data)
    labeled_df = pd.read_sql(
        """
        SELECT * FROM labeled_patterns
        WHERE outcome IN ('win', 'loss')
        ORDER BY end_timestamp
        """,
        conn,
    )

    # Get resolved signals with feature vectors
    signals_df = pd.read_sql(
        """
        SELECT
            pair, pattern_type, timeframe, outcome,
            r_multiple, bars_to_outcome, max_favorable_excursion,
            quality_rating, feature_vector
        FROM signals
        WHERE status = 'resolved' AND outcome IN ('win', 'loss')
            AND feature_vector IS NOT NULL
        ORDER BY resolved_at
        """,
        conn,
    )
    conn.close()

    # Convert signal feature vectors from JSON to flat columns
    if len(signals_df) > 0:
        fv_rows = []
        for _, row in signals_df.iterrows():
            fv = row["feature_vector"]
            if isinstance(fv, str):
                fv = json.loads(fv)
            flat = {
                "pair": row["pair"],
                "pattern_type": row["pattern_type"],
                "timeframe": row["timeframe"],
                "outcome": row["outcome"],
                "r_multiple": row["r_multiple"],
                "bars_to_outcome": row["bars_to_outcome"],
                "max_favorable_excursion": row["max_favorable_excursion"],
                "quality_rating": row["quality_rating"],
            }
            flat.update(fv)
            fv_rows.append(flat)

        signals_flat = pd.DataFrame(fv_rows)

        # Align columns: use labeled_df as template, fill missing with NaN
        for col in labeled_df.columns:
            if col not in signals_flat.columns:
                signals_flat[col] = np.nan

        signals_flat = signals_flat[
            [c for c in labeled_df.columns if c in signals_flat.columns]
        ]

        combined = pd.concat([labeled_df, signals_flat], ignore_index=True)
    else:
        combined = labeled_df

    combined.to_csv(output_path, index=False)
    return len(combined)


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Prepare feature matrix from raw training data."""
    # Drop columns with >99% nulls
    null_pct = df.isnull().mean()
    cols_to_drop = null_pct[null_pct > 0.99].index.tolist()

    df = df.drop(columns=[c for c in cols_to_drop if c in df.columns], errors="ignore")

    # Drop meta and analysis columns
    all_drop = META_COLS_TO_DROP + ANALYSIS_COLS_TO_DROP
    df = df.drop(columns=[c for c in all_drop if c in df.columns], errors="ignore")

    # One-hot encode categoricals
    for col in CATEGORICAL_COLS:
        if col in df.columns:
            df[col] = df[col].fillna("unknown").astype(str)
            dummies = pd.get_dummies(df[col], prefix=col)
            df = pd.concat([df.drop(columns=[col]), dummies], axis=1)

    # Ensure boolean columns are numeric
    for col in df.columns:
        if df[col].dtype == "bool":
            df[col] = df[col].astype(int)

    feature_names = df.columns.tolist()
    return df, feature_names


def train_all_models(
    csv_path: str,
    output_dir: str,
    version: str,
) -> dict:
    """Train V1b, V2, V3 models from CSV. Returns metrics dict."""
    df = pd.read_csv(csv_path)

    # Filter to win/loss only
    df = df[df["outcome"].isin(["win", "loss"])].copy()
    total_rows = len(df)

    # Prepare targets before dropping outcome columns
    y_binary = (df["outcome"] == "win").astype(int)
    y_mfe = df["max_favorable_excursion"].copy()
    y_v2 = pd.cut(
        y_mfe,
        bins=MFE_BUCKET_EDGES,
        labels=range(len(MFE_BUCKET_LABELS)),
        right=False,
    ).astype(int)

    # Prepare features (drops outcome, r_multiple, etc.)
    X, feature_names = prepare_features(df)

    # Time-based 80/20 split (data already sorted by timestamp)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_bin_train, y_bin_test = y_binary.iloc[:split_idx], y_binary.iloc[split_idx:]
    y_v2_train, y_v2_test = y_v2.iloc[:split_idx], y_v2.iloc[split_idx:]
    y_mfe_train, y_mfe_test = y_mfe.iloc[:split_idx], y_mfe.iloc[split_idx:]

    output = Path(output_dir)

    # === V1b: Binary classifier ===
    loss_count = (y_bin_train == 0).sum()
    win_count = (y_bin_train == 1).sum()
    spw = loss_count / max(win_count, 1)

    model_v1 = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        scale_pos_weight=spw,
        eval_metric="logloss",
        random_state=42,
        enable_categorical=False,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
    )
    model_v1.fit(X_train, y_bin_train)

    v1_proba = model_v1.predict_proba(X_test)[:, 1]
    v1_auc = roc_auc_score(y_bin_test, v1_proba)
    v1_acc = accuracy_score(y_bin_test, (v1_proba > 0.5).astype(int))

    model_v1.save_model(str(output / "xgb_v1b_multipattern.json"))

    # === V2: Multi-class MFE bucket classifier ===
    class_counts = np.bincount(y_v2_train, minlength=5)
    class_weights = len(y_v2_train) / (5 * np.maximum(class_counts, 1))
    sample_weights_train = class_weights[y_v2_train]

    model_v2 = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        objective="multi:softprob",
        num_class=5,
        eval_metric="mlogloss",
        random_state=42,
        enable_categorical=False,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
    )
    model_v2.fit(X_train, y_v2_train, sample_weight=sample_weights_train)

    v2_pred = model_v2.predict(X_test)
    v2_acc = accuracy_score(y_v2_test, v2_pred)

    model_v2.save_model(str(output / "xgb_v2_multiclass.json"))

    # === V3: Regression MFE ===
    model_v3 = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        objective="reg:squarederror",
        eval_metric="rmse",
        random_state=42,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
    )
    model_v3.fit(X_train, y_mfe_train)

    v3_pred = np.clip(model_v3.predict(X_test), 0, None)
    v3_mae = mean_absolute_error(y_mfe_test, v3_pred)
    v3_r2 = r2_score(y_mfe_test, v3_pred)

    model_v3.save_model(str(output / "xgb_v3_regression.json"))

    # Save metadata
    v1_meta = {
        "features": feature_names,
        "n_features": len(feature_names),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "class_balance": {"loss": int(loss_count), "win": int(win_count)},
        "scale_pos_weight": float(spw),
        "version": version,
    }
    with open(output / "xgb_v1b_multipattern_meta.json", "w") as f:
        json.dump(v1_meta, f, indent=2)

    v2v3_meta = {
        "features": feature_names,
        "n_features": len(feature_names),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "mfe_bucket_edges": [0, 0.5, 1.0, 1.5, 2.0, 999],
        "mfe_bucket_labels": MFE_BUCKET_LABELS,
        "version": version,
    }
    with open(output / "xgb_v2v3_meta.json", "w") as f:
        json.dump(v2v3_meta, f, indent=2)

    return {
        "version": version,
        "training_size": total_rows,
        "v1_auc": float(v1_auc),
        "v1_accuracy": float(v1_acc),
        "v2_accuracy": float(v2_acc),
        "v3_r2": float(v3_r2),
        "v3_mae": float(v3_mae),
    }


def bump_version(current: str) -> str:
    """Increment version string: v1.0 -> v1.1, v1.9 -> v1.10."""
    parts = current.lstrip("v").split(".")
    major = parts[0]
    minor = int(parts[1]) if len(parts) > 1 else 0
    return f"v{major}.{minor + 1}"
