"""
Train the hypertensive-disorder-of-pregnancy risk model on CDC natality data.

Train on 2022 births, test on 2023 births (a full year the model never saw),
compare with a logistic baseline and with TensioCare's current rules,
export the model (XGBoost JSON + reference cases) and write an honest report.

Usage: python scripts/train.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"

# Order matters: it is the input order of the TypeScript scorer in the web API.
# Chronic hypertension is not a feature: on US birth certificates "gestational
# hypertension" is never ticked when the mother already had hypertension (0.0 %),
# so the data cannot describe those women. They are excluded from training and
# the app reports the model as "not applicable" for them (the rules rate them HIGH).
FEATURES = [
    "age",
    "bmi",
    "first_pregnancy",
    "multiple_pregnancy",
    "infertility_treatment",
    "preexisting_diabetes",
    "gestational_diabetes",
]
# Risk may only rise with these (clinical plausibility); age is left free (U-shaped).
MONOTONE = {"age": 0, "bmi": 1, "first_pregnancy": 1, "multiple_pregnancy": 1, "infertility_treatment": 1,
            "preexisting_diabetes": 1, "gestational_diabetes": 1}
# Small search, judged on the 2022 validation split only (2023 stays untouched).
GRID = [
    {"max_depth": 3, "min_child_weight": 50, "learning_rate": 0.05},
    {"max_depth": 4, "min_child_weight": 20, "learning_rate": 0.05},
    {"max_depth": 6, "min_child_weight": 10, "learning_rate": 0.03},
    {"max_depth": 8, "min_child_weight": 100, "learning_rate": 0.03},
]
TARGET = "hdp"
SEED = 42
LOGISTIC_SAMPLE = 600_000
VECTOR_ROWS = 400
VECTOR_MISSING_ROWS = 100


def load(year: int) -> pd.DataFrame:
    """Births of one year with a known outcome: gestational hypertension or eclampsia."""
    df = pd.read_parquet(DATA / f"births_{year}.parquet")
    known = df["gestational_hypertension"].notna() & df["eclampsia"].notna()
    no_chronic = df["chronic_hypertension"] == 0
    df = df.loc[known & no_chronic].copy()
    df[TARGET] = ((df["gestational_hypertension"] == 1) | (df["eclampsia"] == 1)).astype("int8")
    return df


def rule_score(df: pd.DataFrame) -> np.ndarray:
    """TensioCare's initial risk rules on the same fields: 0 LOW, 1 MODERATE, 2 HIGH."""
    high = df[["preexisting_diabetes", "multiple_pregnancy"]].fillna(0).sum(axis=1)
    moderate = (
        df["first_pregnancy"].fillna(0)
        + (df["age"] >= 40).astype(int)
        + (df["bmi"] >= 35).astype(int)
        + df["infertility_treatment"].fillna(0)
    )
    return np.where((high >= 1) | (moderate >= 2), 2, np.where(moderate == 1, 1, 0))


def capture(y: np.ndarray, score: np.ndarray, share: float) -> dict:
    """Flag the riskiest `share` of women: how many real cases are caught."""
    cut = np.quantile(score, 1 - share)
    flagged = score >= cut
    tp = int((flagged & (y == 1)).sum())
    return {
        "flagged_share": round(float(flagged.mean()), 4),
        "sensitivity": round(tp / int((y == 1).sum()), 4),
        "precision": round(tp / max(int(flagged.sum()), 1), 4),
    }


def calibration(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict]:
    order = np.argsort(p)
    return [
        {"decile": i + 1, "mean_predicted": round(float(p[idx].mean()), 4), "observed": round(float(y[idx].mean()), 4), "n": int(len(idx))}
        for i, idx in enumerate(np.array_split(order, bins))
    ]


def scores(y: np.ndarray, p: np.ndarray) -> dict:
    return {
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
        "pr_auc": round(float(average_precision_score(y, p)), 4),
        "brier": round(float(brier_score_loss(y, p)), 5),
    }


def logistic_baseline(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    sample = train.sample(min(LOGISTIC_SAMPLE, len(train)), random_state=SEED)
    medians = sample[FEATURES].median()

    def prep(df: pd.DataFrame) -> np.ndarray:
        filled = df[FEATURES].fillna(medians)
        missing = df[FEATURES].isna().astype("float32").add_suffix("_missing")
        return np.hstack([filled.to_numpy("float32"), missing.to_numpy("float32")])

    model = LogisticRegression(max_iter=2000).fit(prep(sample), sample[TARGET])
    return scores(test[TARGET].to_numpy(), model.predict_proba(prep(test))[:, 1])


def train_xgb(train: pd.DataFrame) -> tuple[xgb.XGBClassifier, list[dict]]:
    """Each GRID setting on the GPU; the best validation AUC (2022 hold-out) wins."""
    fit, val = train_test_split(train, test_size=0.1, stratify=train[TARGET], random_state=SEED)
    trials: list[dict] = []
    best: xgb.XGBClassifier | None = None
    best_auc = -1.0
    for params in GRID:
        model = xgb.XGBClassifier(
            n_estimators=4000,
            subsample=0.8,
            tree_method="hist",
            device="cuda",
            eval_metric="logloss",
            early_stopping_rounds=150,
            monotone_constraints=tuple(MONOTONE[f] for f in FEATURES),
            random_state=SEED,
            **params,
        )
        model.fit(fit[FEATURES], fit[TARGET], eval_set=[(val[FEATURES], val[TARGET])], verbose=False)
        auc = float(roc_auc_score(val[TARGET], model.predict_proba(val[FEATURES])[:, 1]))
        trials.append({**params, "trees": int(model.best_iteration) + 1, "validation_roc_auc": round(auc, 4)})
        if auc > best_auc:
            best, best_auc = model, auc
    assert best is not None
    return best, trials


def export_model(model: xgb.XGBClassifier, test: pd.DataFrame) -> dict:
    """XGBoost's own JSON format (read by the TypeScript scorer in the web API),
    plus reference cases so that scorer can be checked against Python."""
    path = MODELS / "hdp_risk.json"
    model.get_booster().save_model(str(path))

    sample = test.sample(VECTOR_ROWS, random_state=SEED)
    with_missing = test[test[FEATURES].isna().any(axis=1)].sample(VECTOR_MISSING_ROWS, random_state=SEED)
    rows = pd.concat([sample, with_missing])[FEATURES]
    expected = model.predict_proba(rows)[:, 1]
    vectors = [
        {"input": [None if np.isnan(v) else float(v) for v in row], "probability": float(p)}
        for row, p in zip(rows.to_numpy("float64"), expected)
    ]
    (MODELS / "hdp_risk_vectors.json").write_text(json.dumps(vectors), encoding="utf-8")
    return {
        "path": "models/hdp_risk.json",
        "bytes": path.stat().st_size,
        "trees": int(model.get_booster().num_boosted_rounds()),
        "reference_vectors": len(vectors),
    }


def main() -> None:
    MODELS.mkdir(exist_ok=True)
    REPORTS.mkdir(exist_ok=True)
    train, test = load(2022), load(2023)
    y_test = test[TARGET].to_numpy()

    model, trials = train_xgb(train)
    p = model.predict_proba(test[FEATURES])[:, 1]
    rules = rule_score(test)

    report = {
        "model": "hdp-risk-xgboost-v1",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "task": "risk of a hypertensive disorder of pregnancy (gestational hypertension or eclampsia)",
        "data": {
            "source": "CDC / NCHS natality public-use files (US birth certificates), public domain",
            "train": {"year": 2022, "births": int(len(train)), "prevalence": round(float(train[TARGET].mean()), 4)},
            "test": {"year": 2023, "births": int(len(test)), "prevalence": round(float(y_test.mean()), 4)},
        },
        "features": FEATURES,
        "population": "pregnancies without chronic (pre-pregnancy) hypertension",
        "monotone_constraints": MONOTONE,
        "search": trials,
        "chosen": {k: model.get_params()[k] for k in ("max_depth", "min_child_weight", "learning_rate")},
        "best_iteration": int(model.best_iteration),
        "test_2023": {
            "xgboost": {**scores(y_test, p), "top10": capture(y_test, p, 0.10), "top20": capture(y_test, p, 0.20)},
            "logistic_baseline": logistic_baseline(train, test),
            "current_rules": {
                "roc_auc": round(float(roc_auc_score(y_test, rules)), 4),
                "by_category": {
                    name: {"share": round(float((rules == k).mean()), 4), "observed_rate": round(float(y_test[rules == k].mean()), 4)}
                    for k, name in enumerate(["LOW", "MODERATE", "HIGH"])
                },
            },
            "calibration_deciles": calibration(y_test, p),
        },
        "feature_importance_gain": {
            k: round(v, 2) for k, v in sorted(model.get_booster().get_score(importance_type="gain").items(), key=lambda kv: -kv[1])
        },
    }
    (REPORTS / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["test_2023"], indent=2)[:3000])
    report["export"] = export_model(model, test)
    (REPORTS / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["export"], indent=2))


if __name__ == "__main__":
    main()
