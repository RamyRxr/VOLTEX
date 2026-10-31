# ml/ — learned risk of hypertension in pregnancy (experimental)

Model card and code for the **"Risque estimé par apprentissage"** card of the doctor's patient file.

> **Experimental, doctor only.** It never changes the levels, alerts or rule-based risk of SafeMaman: the rules in `packages/shared/src/domain/` decide. It is not a diagnosis and has no clinical validation.

## What it predicts

The probability that a pregnancy develops a **hypertensive disorder of pregnancy** (gestational hypertension or eclampsia), from the patient's profile only:

| Input (from the app's profile) | Encoded as |
| --- | --- |
| Age (from birth date) | < 20, 20–34 (reference), 35–39, ≥ 40 |
| BMI (from height and weight) | < 25 (reference), 25–29.9, 30–34.9, ≥ 35, not filled in |
| First pregnancy, multiple pregnancy, IVF / infertility treatment, pre-existing diabetes, gestational diabetes | yes / no |

**Not applicable with chronic hypertension** (see [Limits](#limits)); the rules already rate those patients high risk.

## Data

**CDC / NCHS natality public-use files** — every US birth certificate of the year, public domain.

| | Year | Births used | Rate of the outcome |
| --- | --- | --- | --- |
| Training | 2022 | 3,562,391 | 10.0 % |
| Test (never seen during training) | 2023 | 3,485,785 | 10.6 % |

Population: births with a known outcome, **without chronic (pre-pregnancy) hypertension** (96 % of births).

## Results on the 2023 test year

| Model | ROC-AUC | Notes |
| --- | --- | --- |
| **Logistic regression, bands (shipped)** | **0.653** | every factor readable as an odds multiplier |
| Logistic regression, continuous | 0.657 | |
| XGBoost on GPU (RTX 4050), 4 settings tried | 0.659 | 421 trees, not explainable; validation AUC 0.661–0.662 for all settings |
| SafeMaman's current profile rules | 0.603 | same patients, same fields |
| Chance | 0.500 | |

The shipped model:

- **Calibrated:** predicted vs observed risk per tenth of the test year, e.g. 4.6 % vs 4.8 % (lowest tenth), 22.6 % vs 22.8 % (highest tenth).
- **Riskiest 20 % of profiles:** 40 % of all cases, with a 19 % rate (≈ 2× the average).

Weights (odds multipliers; every one in the medically expected direction):

| Factor | × odds |
| --- | --- |
| BMI ≥ 35 | 3.47 |
| Pre-existing diabetes | 2.43 |
| BMI 30–34.9 | 2.28 |
| Multiple pregnancy | 1.98 |
| First pregnancy | 1.67 |
| BMI not filled in | 1.65 |
| Gestational diabetes | 1.64 |
| BMI 25–29.9 | 1.61 |
| IVF / infertility treatment | 1.45 |
| Age ≥ 40 | 1.32 |
| Age 35–39 | 1.13 |
| Age < 20 | 0.97 |

Full numbers: `reports/logistic.json` (shipped model) and `reports/metrics.json` (XGBoost, baselines, rules).

## Limits

- **Moderate accuracy** (AUC 0.65): profile factors alone carry limited signal; studies using only maternal history report similar values. Measured blood pressure, the strongest predictor, is not on birth certificates — in the app, readings drive the alerts through the rules.
- **Chronic hypertension is excluded:** on US birth certificates "gestational hypertension" is never ticked when the mother already had hypertension (0.0 % in 2022), so the data cannot describe these women.
- **Previous pre-eclampsia, kidney and autoimmune disease, family history** are not on birth certificates, so the model ignores them (the rules use them).
- **US population**, 2022–2023: the risk level may differ elsewhere (e.g. Algeria) and needs local validation.
- **Birth-certificate data** under-reports some conditions.

## Reproduce

```bash
cd ml
uv venv .venv --python 3.12
uv pip install --python .venv/Scripts/python.exe -r requirements.txt

# Data (≈ 450 MB zipped, not committed): CDC natality public-use files
curl -L -o data/Nat2022us.zip https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Datasets/DVS/natality/Nat2022us.zip
curl -L -o data/Nat2023us.zip https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Datasets/DVS/natality/Nat2023us.zip
unzip -q data/Nat2023us.zip -d data/nat2023      # 2023 uses Deflate64: unzip it first

.venv/Scripts/python.exe scripts/extract.py data/Nat2022us.zip data/births_2022.parquet
.venv/Scripts/python.exe scripts/extract.py data/nat2023/<file>.txt data/births_2023.parquet
.venv/Scripts/python.exe scripts/train.py            # XGBoost (GPU) + baselines + rules → reports/metrics.json
.venv/Scripts/python.exe scripts/train_logistic.py   # shipped model → models/hdp_logistic.json
```

Field positions come from the CDC *User Guide to the 2023 Natality Public Use File*.

## How the app uses it

1. `models/hdp_logistic.json` (weights) is copied to `packages/shared/src/ml/hdpLogisticModel.json`.
2. `packages/shared/src/ml/learnedRisk.ts` computes the probability and the active factors; its tests check it against Python on 500 reference cases from 2023 (difference < 1e-6).
3. The API adds `learnedRisk` to the doctor's patient file; the dashboard shows it as an experimental card. It is never sent to the patient app.

After retraining: copy the new `models/hdp_logistic.json` and `models/hdp_logistic_vectors.json` into `packages/shared/src/ml/` (and `__tests__/`), then run `pnpm --filter shared test`.

## Files

| Path | Content | In Git |
| --- | --- | --- |
| `scripts/extract.py` | CDC fixed-width file → Parquet (only the needed fields) | yes |
| `scripts/train.py` | XGBoost on GPU, logistic baseline, rules comparison | yes |
| `scripts/train_logistic.py` | the shipped explainable model | yes |
| `models/hdp_logistic.json`, `models/hdp_logistic_vectors.json` | shipped weights + reference cases | yes |
| `reports/*.json` | all metrics | yes |
| `data/`, `.venv/`, `models/hdp_risk*.json` | raw data, environment, XGBoost model (3 MB) | no |
