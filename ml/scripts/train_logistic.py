"""
Explainable risk model for hypertensive disorders of pregnancy (logistic regression).

Same data and split as train.py: CDC natality 2022 for training, 2023 for the test,
pregnancies without chronic hypertension. Inputs are bands and yes/no factors the
patient profile already collects, so every weight reads as "this factor adds N points".

Usage: python scripts/train_logistic.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MODELS = ROOT / "models"
REPORTS = ROOT / "reports"
TARGET = "hdp"
SEED = 42
VECTOR_ROWS = 500

# code -> French label shown to the doctor. Reference bands (no weight): age 20-34, BMI < 25.
FACTORS: dict[str, str] = {
    "age_under_20": "Âge < 20 ans",
    "age_35_39": "Âge 35–39 ans",
    "age_40_plus": "Âge ≥ 40 ans",
    "bmi_25_30": "IMC 25–29,9 (surpoids)",
    "bmi_30_35": "IMC 30–34,9 (obésité)",
    "bmi_35_plus": "IMC ≥ 35 (obésité sévère)",
    "bmi_unknown": "IMC non renseigné (taille ou poids manquant)",
    "first_pregnancy": "Première grossesse",
    "multiple_pregnancy": "Grossesse multiple",
    "infertility_treatment": "Grossesse après traitement de l'infertilité (FIV…)",
    "preexisting_diabetes": "Diabète avant la grossesse",
    "gestational_diabetes": "Diabète gestationnel",
}


def load(year: int) -> pd.DataFrame:
    """Births with a known outcome, without chronic hypertension (see train.py)."""
    df = pd.read_parquet(DATA / f"births_{year}.parquet")
    keep = df["gestational_hypertension"].notna() & df["eclampsia"].notna() & (df["chronic_hypertension"] == 0)
    df = df.loc[keep].copy()
    df[TARGET] = ((df["gestational_hypertension"] == 1) | (df["eclampsia"] == 1)).astype("int8")
    return df


def encode(df: pd.DataFrame) -> pd.DataFrame:
    """Profile -> 0/1 columns in FACTORS order (unknown yes/no counts as no)."""
    age, bmi = df["age"], df["bmi"]
    flag = lambda col: (df[col] == 1).astype("float32")  # noqa: E731
    return pd.DataFrame(
        {
            "age_under_20": (age < 20).astype("float32"),
            "age_35_39": ((age >= 35) & (age < 40)).astype("float32"),
            "age_40_plus": (age >= 40).astype("float32"),
            "bmi_25_30": ((bmi >= 25) & (bmi < 30)).astype("float32"),
            "bmi_30_35": ((bmi >= 30) & (bmi < 35)).astype("float32"),
            "bmi_35_plus": (bmi >= 35).astype("float32"),
            "bmi_unknown": bmi.isna().astype("float32"),
            "first_pregnancy": flag("first_pregnancy"),
            "multiple_pregnancy": flag("multiple_pregnancy"),
            "infertility_treatment": flag("infertility_treatment"),
            "preexisting_diabetes": flag("preexisting_diabetes"),
            "gestational_diabetes": flag("gestational_diabetes"),
        }
    )[list(FACTORS)]


def scores(y: np.ndarray, p: np.ndarray) -> dict:
    return {
        "roc_auc": round(float(roc_auc_score(y, p)), 4),
        "pr_auc": round(float(average_precision_score(y, p)), 4),
        "brier": round(float(brier_score_loss(y, p)), 5),
    }


def capture(y: np.ndarray, p: np.ndarray, share: float) -> dict:
    cut = np.quantile(p, 1 - share)
    flagged = p >= cut
    tp = int((flagged & (y == 1)).sum())
    return {
        "flagged_share": round(float(flagged.mean()), 4),
        "sensitivity": round(tp / int((y == 1).sum()), 4),
        "precision": round(tp / max(int(flagged.sum()), 1), 4),
    }


def calibration(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict]:
    order = np.argsort(p)
    return [
        {"decile": i + 1, "mean_predicted": round(float(p[idx].mean()), 4), "observed": round(float(y[idx].mean()), 4)}
        for i, idx in enumerate(np.array_split(order, bins))
    ]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # French labels on the Windows console
    train, test = load(2022), load(2023)
    x_train, x_test = encode(train), encode(test)
    y_train, y_test = train[TARGET].to_numpy(), test[TARGET].to_numpy()

    model = LogisticRegression(max_iter=1000, C=1.0).fit(x_train, y_train)
    p = model.predict_proba(x_test)[:, 1]
    intercept = float(model.intercept_[0])
    weights = {code: float(w) for code, w in zip(FACTORS, model.coef_[0])}

    export = {
        "model": "hdp-risk-logistic-v1",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "task": "Risk of a hypertensive disorder of pregnancy (gestational hypertension or eclampsia), from the profile",
        "population": "pregnancies without chronic hypertension; not applicable when chronic hypertension is present",
        "source": "CDC / NCHS natality public-use files 2022 (train) and 2023 (test), US birth certificates, public domain",
        "average_risk": round(float(y_train.mean()), 4),
        "intercept": intercept,
        "factors": [{"code": c, "label": FACTORS[c], "weight": weights[c]} for c in FACTORS],
        "test_2023": {
            "births": int(len(test)),
            **scores(y_test, p),
            "top10": capture(y_test, p, 0.10),
            "top20": capture(y_test, p, 0.20),
        },
    }
    MODELS.mkdir(exist_ok=True)
    (MODELS / "hdp_logistic.json").write_text(json.dumps(export, indent=2, ensure_ascii=False), encoding="utf-8")

    sample = test.sample(VECTOR_ROWS, random_state=SEED)
    vectors = [
        {
            "age": float(r.age),
            "bmi": None if np.isnan(r.bmi) else float(r.bmi),
            "firstPregnancy": r.first_pregnancy == 1,
            "multiplePregnancy": r.multiple_pregnancy == 1,
            "ivfPregnancy": r.infertility_treatment == 1,
            "preexistingDiabetes": r.preexisting_diabetes == 1,
            "gestationalDiabetes": r.gestational_diabetes == 1,
            "probability": float(prob),
        }
        for r, prob in zip(sample.itertuples(), model.predict_proba(encode(sample))[:, 1])
    ]
    (MODELS / "hdp_logistic_vectors.json").write_text(json.dumps(vectors), encoding="utf-8")

    report = {**export, "calibration_deciles": calibration(y_test, p)}
    (REPORTS / "logistic.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: export[k] for k in ("average_risk", "test_2023")}, indent=2))
    for f in export["factors"]:
        print(f"  {f['weight']:+.3f}  odds x{np.exp(f['weight']):.2f}  {f['label']}")
    print("calibration (pred/obs):", [(c["mean_predicted"], c["observed"]) for c in report["calibration_deciles"]])


if __name__ == "__main__":
    main()
