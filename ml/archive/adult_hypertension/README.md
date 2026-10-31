# Archived: adult hypertension model (first experiment)

**Not used by the app.** Kept as a record of the first ML experiment of the project.

| | |
| --- | --- |
| Model | XGBoost (`adult-hypertension-xgb-v1.0.0`), exported to ONNX |
| Data | `heart_disease.csv`, ~10,000 adults (licence not verified) |
| Predicts | high blood pressure in general adults — **pregnancy excluded** |
| Inputs | 19 lifestyle and blood-test values (cholesterol, CRP, homocysteine, sleep, stress…), 14 of which SafeMaman does not collect |
| Test ROC-AUC | **0.50** (chance level); its own metadata sets `prediction_enabled: false` |

Why it was replaced: no predictive signal, wrong population (not pregnant women), and inputs the app does not have. The model in use is the learned risk described in [../../README.md](../../README.md), trained on 7 million US births.

Security note: `adult_hypertension_pipeline.joblib` is a Python pickle, which can run code when loaded. Do not load it unless you trust its source.
