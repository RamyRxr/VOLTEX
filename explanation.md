# SafeMaman — how it works and why

A complete walkthrough of the project: what it does, how each part works, why each technical choice was made, how the AI was trained, and how to answer the questions a jury is likely to ask.

For installation and commands, see the [README](README.md). This document explains the **reasons**.

---

## Contents

1. [The project in one minute](#1-the-project-in-one-minute)
2. [The problem](#2-the-problem)
3. [Who uses what](#3-who-uses-what)
4. [The main loop, step by step](#4-the-main-loop-step-by-step)
5. [Architecture and technical choices](#5-architecture-and-technical-choices)
6. [The database](#6-the-database)
7. [The medical rules engine](#7-the-medical-rules-engine)
8. [AI part 1 — the learned risk (machine learning)](#8-ai-part-1--the-learned-risk-machine-learning)
9. [AI part 2 — the AI texts (language model)](#9-ai-part-2--the-ai-texts-language-model)
10. [Security and privacy](#10-security-and-privacy)
11. [Speed: what we did and what is left](#11-speed-what-we-did-and-what-is-left)
12. [Quality: tests and checks](#12-quality-tests-and-checks)
13. [Demo data and demo mode](#13-demo-data-and-demo-mode)
14. [Honest limits and next steps](#14-honest-limits-and-next-steps)
15. [Questions the jury may ask — with answers](#15-questions-the-jury-may-ask--with-answers)
16. [Glossary](#16-glossary)

---

## 1. The project in one minute

**SafeMaman follows high blood pressure during pregnancy between two doctor visits.**

- The **pregnant patient** uses a mobile app: she records her blood pressure and answers a short daily questionnaire. She immediately gets a clear answer, including *"go to the maternity emergency room or call 14 now"* when it is dangerous.
- Her **doctor** uses a web dashboard: all her patients sorted from most urgent to most stable, with the reason, updated every 3 seconds. The doctor opens a file, sees **why** the patient is at that level, and acts (chat, note).
- Between the two, **one rules engine** decides levels, alerts and risk. It is explainable: every decision comes with the rule that triggered it.
- **AI helps but never decides**: a learned risk estimate (trained on 7 million real births) and AI-written texts (summary, message suggestion, information assistant), all shown to the doctor as aids.

**Principle:** *the app assists, the doctor decides.* It never diagnoses, prescribes or changes a treatment.

---

## 2. The problem

- **Hypertensive disorders of pregnancy** (gestational hypertension, pre-eclampsia, eclampsia) are among the leading causes of maternal and fetal complications. In the 7 million US births we used, about **1 pregnancy in 10** had one.
- They can become dangerous **within hours or days**, often **between two prenatal visits** (usually one month apart).
- Patients can measure their blood pressure at home, but they don't know **when a value or a symptom is urgent**, and the doctor **sees nothing** of what happens between visits.

SafeMaman closes that gap: the patient gets an immediate, safe answer, and the doctor sees the patients who need attention first.

---

## 3. Who uses what

| User | Tool | Main features |
| --- | --- | --- |
| **Patient** | Mobile app (Expo, Android/iOS) | Account + consent, medical profile, initial risk with its reasons, add her doctor with a code, guided blood-pressure entry, daily questionnaire, result screen (emergency / re-measure / status), history chart, chat with her doctor, reminders, information assistant |
| **Doctor** | Web dashboard (Next.js) | Patients sorted by urgency, patient file (why this level, chart, questionnaires, alerts, risk + learned risk, AI summary, notes, chat with AI suggestion), alerts inbox, Messages tab sorted by urgency with live notifications, invite codes and link requests |
| **Doctor (on the go)** | Same mobile app, "doctor mode" | Open alerts sorted by urgency, "mark as seen", notifications. The full file stays on the web. |

**Why the dashboard is doctor-only:** patients use only the phone (that's what they have with them). The web is a work tool for the doctor at the desk: a large screen to compare patients and read a full file.

---

## 4. The main loop, step by step

This is the loop that must always work. Example: a patient enters **165/112**.

1. **Phone** — she fills the steppers and taps "Enregistrer". The app sends `POST /api/patient/sessions` with her login token.
2. **API (Next.js)** — checks the token, finds her patient record, and validates the body with a shared **Zod** schema (sys/dia/pulse ranges, date not in the future).
3. **Rules (packages/shared)** — the API calls the pure rule functions:
   - 165/112 is ≥ 160/110 → **severe, not yet confirmed** (`SEVERE_PENDING`).
   - The rule asks her to **re-measure in 15 minutes** (10 seconds in demo mode).
   - Risk is re-estimated; alerts are opened or updated (never duplicated).
4. **Database** — the reading, the risk assessment and the alert are saved in one transaction, with a **per-patient lock** so two readings sent at the same time can't break the confirmation logic.
5. **Phone** — shows the result screen: "Reposez-vous et mesurez à nouveau" with a countdown.
6. **Second reading** within 60 minutes:
   - still ≥ 160/110 → **confirmed severe** → full-screen "go to the maternity emergency room or call 14 now" + call button, and an urgent alert for the doctor;
   - below → "not confirmed", the reading stays visible to the doctor.
7. **Dashboard** — it asks the API every 3 seconds; the patient jumps to the top of the list with the reason ("Mesure sévère non confirmée : 165/112").
8. **Doctor** — opens the file, sees every rule that fired, the chart with the 140/90 and 160/110 lines, and writes to her in the chat or adds a note.

Same idea for the questionnaire: **any danger sign answered "yes" → emergency immediately**, whatever the blood pressure, no re-measure.

---

## 5. Architecture and technical choices

```
apps/web         Next.js: doctor dashboard + the API used by both apps
apps/mobile      Expo (React Native): patient app + light doctor mode
packages/shared  Rules, risk, learned-risk model, Zod schemas, types (pure TypeScript, tested)
ml/              Python: data extraction and model training (not part of the running app)
docs/            Screenshots, video, logo
```

```
Patient phone ──HTTPS + token──▶ Next.js API ──Prisma──▶ Supabase Postgres
Doctor browser ──poll every 3 s─▶      │
                                       └──calls──▶ packages/shared (rules, risk, learned risk)
Phone ◀──── chat (Supabase Realtime + RLS) ────▶ Browser
```

### Why one repository (monorepo) instead of separate repos?

- The phone, the API and the dashboard must agree on **the same data shapes** and **the same rules**. In one repo, a change to a schema in `packages/shared` is seen by all three at once, and TypeScript shows every place that breaks.
- One `pnpm install`, one set of commands, one pull request for a feature that touches both apps.
- Tool: **pnpm workspaces** (fast, saves disk space, links the shared package into each app).

### Why Next.js for the dashboard **and** the API?

- Next.js serves pages **and** API routes (`apps/web/src/app/api/...`) from the same project. For a small team under a deadline, that means **one server to run, one deployment (Vercel), one language (TypeScript)**.
- The dashboard and the API live side by side, so the dashboard calls its own API with no extra setup (same address, no cross-site configuration).
- It deploys in one click on Vercel and scales automatically.
- React is what the team knows, and the mobile app is React Native, so both apps share the same way of writing UI.

### Why didn't we split frontend and backend into separate folders/projects?

They **are** separated, just inside one Next.js app:

| Layer | Folder | Rule |
| --- | --- | --- |
| Pages and components (frontend) | `apps/web/src/app/d/`, `src/components/` | Never touch the database |
| API routes (thin) | `apps/web/src/app/api/` | Check the token, validate input, call a service |
| Services (backend logic) | `apps/web/src/server/` | Database queries, scoped to the current user |
| Business rules | `packages/shared/src/domain/` | Pure functions, no database, fully tested |

So the separation is by **layer**, not by repository. A separate backend project would add a second server, a second deployment, CORS configuration and duplicated types, with no benefit at this size. If the project grows, `src/server/` and `packages/shared` can move to their own service without rewriting the rules.

### Why a shared package (`packages/shared`)?

**One engine.** The medical rules exist **only once**. The phone and the dashboard never recompute a level: they display what the API returns. This avoids the worst bug possible in a health app: the phone saying "OK" while the dashboard says "urgent". The package also holds the **Zod schemas** (the API contract), so both apps validate the same shapes.

### Why Expo (React Native) for the mobile app?

- One code base for **Android and iOS**.
- **Expo Go** lets anyone run the app by scanning a QR code: no store, no native build, perfect for a hackathon demo.
- Local notifications (reminders, re-measure alarm) work in Expo Go.
- Same language and same React style as the dashboard.

### Why Supabase?

Supabase gives three services we need, all on one free project:

| Service | Used for |
| --- | --- |
| **PostgreSQL** database | All the data |
| **Auth** | Email + password accounts for patients and doctors (both apps) |
| **Realtime** | The live chat: new messages arrive instantly on both sides |

Postgres is a standard, reliable relational database: patients, readings, alerts and links are naturally tables with relations.

### Why Prisma if we already have Supabase?

Supabase **is** the database; **Prisma is how the API talks to it**:

- Typed queries: TypeScript knows every table and field, so mistakes are caught before running.
- **Migrations**: the database structure is written in `apps/web/prisma/schema.prisma` and versioned in Git.
- Transactions and locks, needed for the severe-reading confirmation.

The Supabase client is still used where it is best: **login** and the **live chat**.

**The two URLs in `schema.prisma`:** `DATABASE_URL` is Supabase's **pooler** (port 6543), used by the running app; it shares a few database connections between many requests. `DIRECT_URL` (port 5432) is used only for migrations, which the pooler can't run. (VS Code may underline them in red: that's the Prisma 7 editor extension; the project uses Prisma 6, where they are correct.)

### Why does the dashboard poll every 3 seconds instead of using realtime everywhere?

- Polling (asking the API every 3 s) is **simple and robust**: no lost events, works through any network, and the API stays the only place that computes levels.
- The spec asks for "visible within a few seconds", and 3 s meets it.
- Realtime is used where instant matters most: the **chat** and the **new-message notifications** on the dashboard.

### Other tools

| Tool | Why |
| --- | --- |
| **TypeScript (strict)** everywhere | Catches errors at writing time; shared types between apps |
| **Zod** | Validates every API input and output; one schema shared by both apps |
| **TanStack Query** | Caching, polling and refreshing of server data in both apps |
| **Recharts** | Blood-pressure charts with threshold lines on the dashboard |
| **Vitest** | Fast unit tests for the rules |
| **DM Sans** | The dashboard's single typeface (readable, calm) |
| **French UI** through one dictionary file per app (`i18n/fr.ts`) | Every text in one place; easy to add Arabic later |

---

## 6. The database

Defined in `apps/web/prisma/schema.prisma`.

| Table | What it holds |
| --- | --- |
| `Profile` | One per account: role (PATIENT / DOCTOR), name, phone. Its id = the Supabase Auth user id |
| `Patient` | Birth date, due date or last period, medical history (first pregnancy, twins, chronic hypertension, previous pre-eclampsia, diabetes, kidney / autoimmune disease, family history, IVF), height, weight, treatments, consent date, stored AI summary |
| `Doctor` | Link to the profile |
| `InviteCode` | 6-character codes, 24 h, single use |
| `LinkRequest` | Patient ↔ doctor link: PENDING, ACCEPTED or REFUSED. An accepted link is also the chat conversation |
| `BpSession` | One blood-pressure reading + its status (normal, hypertensive, severe pending / confirmed / not confirmed / expired) |
| `Questionnaire` | Answers (yes/no per item) and date |
| `RiskAssessment` | Every risk estimate with its factors and what triggered it → the **risk timeline** |
| `Alert` | Level, evidence, reason in French, status (open / acknowledged / closed) |
| `DoctorNote` | The doctor's notes and decisions |
| `Message` | Chat messages (Realtime, protected by RLS) |

---

## 7. The medical rules engine

Code: `packages/shared/src/domain/`. All numbers in **one file**, `config.ts`, each marked *to validate with a doctor or midwife*.

### Blood pressure thresholds

"≥" means **systolic ≥ OR diastolic ≥**.

| Range | Threshold |
| --- | --- |
| Hypertensive | ≥ 140/90 |
| Severe | ≥ 160/110 → must be **confirmed** by a second reading within 60 min (re-measure after 15 min) |

**Why confirm a severe reading?** A single high value is often a measuring error (patient stressed, just walked, bad cuff position). International guidelines confirm with a second measurement. But nothing is hidden: an unconfirmed severe reading is shown to the doctor right after the emergencies.

### The levels (checked in a fixed order, the most severe wins)

| Level | When | Patient sees |
| --- | --- | --- |
| **EMERGENCY** | a danger sign answered "yes": severe headache, vision problems, upper abdominal pain, sudden swelling of face/hands, breathing difficulty, reduced fetal movement | "Urgent — go to the maternity emergency room or call 14 now" |
| **SEVERE** | a confirmed reading ≥ 160/110 | Same message |
| **HIGH** | 2 of the last 3 valid readings ≥ 140/90 | Attention |
| **WATCH** | rising systolic over 14 days, risk raised, or a watch sign (mild headache, leg swelling, nausea, unusual fatigue) | À surveiller |
| **SILENT** | no reading for 2 × the expected interval (default 2 per day → 24 h) | À suivre |
| **OK** | none of the above | Bon |

- **Trend:** a straight line fitted through the systolic values of the last 14 days (at least 5 readings); "rising" if it goes up by 2 mmHg per week or more.
- **Alerts are never duplicated:** one open alert per patient per level and evidence; a new event updates it.
- **Triage order on the dashboard:** Emergency → Severe → unconfirmed severe → High → Watch → Silent → OK; most recent first inside a group.
- **Status is never colour alone:** always icon + colour + word (accessibility, colour blindness).

### The rule-based risk (explainable)

From the profile:

- **Major factors:** previous pre-eclampsia, chronic hypertension, pre-existing diabetes, kidney disease, autoimmune disease, twins.
- **Moderate factors:** first pregnancy, age ≥ 40, BMI ≥ 35, family history of pre-eclampsia, IVF.
- **HIGH** if ≥ 1 major or ≥ 2 moderate factors, **MODERATE** if 1 moderate, **LOW** otherwise.
- Then raised by what is observed: hypertensive readings (→ at least HIGH), a rising trend, watch signs in the last 7 days. **Never lowered** below the starting category.
- Every estimate is saved, and the screen always shows the **factors**, never a bare "high".

These factors come from the usual obstetric guidelines (the same family of factors used to decide low-dose aspirin prevention).

### Why rules and not AI for the decisions?

- **Safety and trust:** a doctor must be able to check every decision. A rule says exactly why ("2 of the last 3 readings ≥ 140/90").
- **Predictable:** the same input always gives the same output; it can be tested exhaustively.
- **No data needed:** these thresholds come from medical guidelines, not from training.
- **Pure functions with tests:** they take the current time as a parameter, so tests can simulate any day and hour.

---

## 8. AI part 1 — the learned risk (machine learning)

Code: `ml/` (training, Python) and `packages/shared/src/ml/` (running it, TypeScript). Full model card: [ml/README.md](ml/README.md).

### What it does

It estimates the **probability that a pregnancy develops a hypertensive disorder** (gestational hypertension, including pre-eclampsia, or eclampsia), from the patient's **profile only**. It appears as an **experimental card in the doctor's patient file**, next to the rule-based risk. It **never** changes levels, alerts or the rule risk, and it is **never shown to the patient**.

### Where the data comes from

**CDC / NCHS natality public-use files**: every birth certificate in the United States for one year, published by the US National Center for Health Statistics. They are **public domain**, free, anonymous (no names), and huge.

| | Year | Births used | Share with the disorder |
| --- | --- | --- | --- |
| Training | 2022 | 3,562,391 | 10.0 % |
| Test | 2023 | 3,485,785 | 10.6 % |

Downloaded from `ftp.cdc.gov` (about 450 MB zipped). The raw files are not in Git; anyone can download them again with the commands in `ml/README.md`.

**Why this data?**

- It is the **largest real dataset of pregnancies** available for free: about 3.6 million births a year.
- It is about **pregnant women** (the first model we had was trained on general adults; see below).
- It contains exactly the fields our app collects: age, BMI, first pregnancy, twins, IVF, diabetes, and the outcome (gestational hypertension / eclampsia).

### How the data was prepared (`ml/scripts/extract.py`)

1. The CDC file is **fixed-width text**: each birth is one line, and each field sits at fixed character positions described in the CDC *User Guide* (for example, mother's age = characters 75–76, BMI = 283–286).
2. The script reads the file **in chunks of 500,000 lines** (to keep memory low), keeps only the 11 needed fields, and converts the codes: Y → 1, N → 0, U (unknown) → missing; BMI 99.9 → missing; birth order 1 → first pregnancy; plurality ≥ 2 → twins.
3. It saves a compact **Parquet** file per year (fast to load).

### What the model learns from (inputs)

Only what the app's profile already asks, so the model can run on every patient:

- Age in bands: < 20, 20–34 (reference), 35–39, ≥ 40
- BMI in bands: < 25 (reference), 25–29.9, 30–34.9, ≥ 35, or not filled in
- First pregnancy, twins, IVF / infertility treatment, pre-existing diabetes, gestational diabetes (yes / no)

**Outcome to predict:** gestational hypertension **or** eclampsia ticked on the certificate.

**Excluded: women with chronic hypertension.** On US certificates, when a woman already had hypertension before pregnancy, "gestational hypertension" is never ticked (0.0 % in 2022). The data therefore can't describe these women, so we exclude them and the card says "not applicable". Our rules already rate them high risk.

### How the training works (in simple words)

Training is **not** "install a model and let it read". It is fitting numbers:

1. The model starts with one weight per factor (all zero).
2. It looks at the 3.56 million births of 2022 and adjusts the weights so that its predicted probability is as close as possible to what really happened (disorder or not). This is an optimisation done by **scikit-learn**, a standard Python library.
3. The result is **13 numbers**: one base value (the intercept) + one weight per factor. That's the whole model.
4. Then we **test it on 2023**, a year it **never saw**. This is the honest check: it shows how it would do on future patients.

**Why split by year (2022 train, 2023 test) instead of randomly?** Because in real life the model is used on *future* patients. Testing on the next year is closer to reality than mixing the same year.

### Models we tried (`ml/scripts/train.py`, `train_logistic.py`)

| Model | Test AUC (2023) | Kept? |
| --- | --- | --- |
| **Logistic regression with bands** | **0.653** | **Yes, shipped** |
| Logistic regression, continuous values | 0.657 | No |
| **XGBoost on the GPU** (RTX 4050, 4 settings tried) | 0.659 | No |
| Our profile rules alone | 0.603 | (baseline) |
| Random guess | 0.500 | (baseline) |

**Why we shipped logistic regression and not XGBoost:**

- The difference is tiny (0.653 vs 0.659).
- Logistic regression is **explainable**: each factor is a multiplier the doctor can read ("BMI ≥ 35 multiplies the odds by 3.5"). XGBoost is hundreds of decision trees: no doctor can check why it says what it says.
- It is **13 numbers**: it runs in a few lines of TypeScript in the app, with no Python server and no extra cost.

**What the GPU was used for:** training XGBoost (thousands of trees on 3.5 million rows) is much faster on a graphics card. We used the RTX 4050 to compare, then chose the simpler model.

### Results, explained simply

- **AUC 0.65:** if you take one woman who developed the disorder and one who didn't, the model gives the higher risk to the right one **65 % of the time** (50 % = coin toss, 100 % = perfect). Our rules alone get 60 %.
- **Calibrated:** when it says "5 %", about 5 % of those women really develop it (checked for every tenth of the population: e.g. predicted 4.6 % vs observed 4.8 %; predicted 22.6 % vs observed 22.8 %).
- **Useful for prioritising:** the 20 % riskiest profiles contain **40 % of all cases**, with a rate of 19 % (about 2× the average).

**Is 0.65 good?** It is **moderate, and expected**: profile factors alone carry limited signal. Published studies using only maternal history report similar values. The strongest predictor, the measured blood pressure, is not on birth certificates. In the app, blood pressure is handled by the rules, which is why the learned risk is only an extra, experimental indication.

### The weights (each one in the medically expected direction)

| Factor | Multiplies the odds by |
| --- | --- |
| BMI ≥ 35 | 3.47 |
| Pre-existing diabetes | 2.43 |
| BMI 30–34.9 | 2.28 |
| Twins | 1.98 |
| First pregnancy | 1.67 |
| BMI not filled in | 1.65 |
| Gestational diabetes | 1.64 |
| BMI 25–29.9 | 1.61 |
| IVF / infertility treatment | 1.45 |
| Age ≥ 40 | 1.32 |
| Age 35–39 | 1.13 |
| Age < 20 | 0.97 |

### How the app uses the model

1. Training writes the weights to `ml/models/hdp_logistic.json`.
2. That file is copied to `packages/shared/src/ml/hdpLogisticModel.json`.
3. `learnedRisk.ts` computes the probability and lists the factors that raise it.
4. **Its tests compare it with Python on 500 real 2023 cases**: the results match to the sixth decimal.
5. The API adds it to the doctor's patient file; the dashboard shows it as "Risque estimé par apprentissage — Expérimental".

### The first model, and why it was replaced

A first model (Seryne's first experiment) is kept in `ml/archive/adult_hypertension/` for the record. It was an XGBoost model trained on about 10,000 **general adults** (not pregnant women), using 19 inputs (cholesterol, sleep, stress…), 14 of which the app doesn't collect. Its test AUC was **0.50 (chance level)**, and its own metadata disabled predictions. Wrong population, inputs we don't have, no signal: so we replaced it with the CDC model.

### Limits to say out loud

- Moderate accuracy (AUC 0.65), profile only.
- US population, 2022–2023: must be validated on local (e.g. Algerian) data before any clinical use.
- Previous pre-eclampsia, kidney / autoimmune disease and family history are not on birth certificates, so the model ignores them (the rules use them).
- Birth certificates under-report some conditions.
- No clinical validation: that's why it is labelled experimental and is doctor-only.

---

## 9. AI part 2 — the AI texts (language model)

Code: `apps/web/src/lib/llm/`.

| Feature | Who sees it | What it does |
| --- | --- | --- |
| **Summary** | Doctor | One French paragraph about the patient, on demand; labelled "Synthèse générée par IA — à vérifier" |
| **Message suggestion** | Doctor | A short draft message to the patient, put in the chat box; **the doctor edits and sends it himself**, it is never sent automatically |
| **Information assistant** | Patient | General information about hypertension in pregnancy and how the app works |

**How it is built:**

- **Any OpenAI-compatible provider** (Ollama on the computer, Groq, OpenAI, Mistral, Gemini…), chosen with 3 variables: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Plain `fetch`, no vendor library.
- **Never blocks the app:** 10-second timeout. With no key, a timeout or an error, each feature returns a **built-in text made from the same facts**, honestly labelled ("Synthèse automatique (IA indisponible)"). Demo patients have **pre-written summaries**, so the demo never depends on a live AI.
- **Privacy:** the model receives only **computed facts** (readings, averages, trend, reasons, symptoms, risk factors), **never the patient's name** or her own words.
- **Safety enforced by code, not trusted to the model:**
  - The assistant refuses diagnosis and treatment advice.
  - If a question mentions a symptom or a high reading, the answer **always** contains "Si vous avez ce symptôme, allez aux urgences de la maternité ou appelez le 14", added by code if the model forgot it.
  - For an urgent patient, the suggested message always tells her to go now.
- **The language model never computes a risk, a threshold or an alert.**

---

## 10. Security and privacy

| Topic | What we do |
| --- | --- |
| **Login** | Supabase Auth (email + password). Each API call carries the login token (`Authorization: Bearer …`), checked on the server against Supabase's public keys |
| **Who sees what** | Every query is filtered by the logged-in user: a patient sees only her data; a doctor sees only patients with an **accepted** link to him |
| **Doctor ↔ patient link** | The doctor generates a 6-character code (no 0/O/1/I, to avoid confusion), valid 24 h, single use. The patient enters it → request "pending" → the doctor accepts or refuses. **No health data is visible before acceptance** |
| **Code guessing** | Max 5 attempts per 10 minutes per patient; wrong, expired and used codes give the same generic message (doesn't reveal which) |
| **Chat** | Direct database access from the apps, protected by **Row Level Security (RLS)**: Postgres itself refuses to show a message to anyone who is not the patient or the doctor of that accepted link |
| **Secrets** | The Supabase service key exists only in the server code. The phone gets only the public URL and public key. `.env` files are never committed |
| **Input validation** | Every API body is checked with Zod (types, ranges, dates) |
| **Consent** | Required at sign-up; the date is stored |
| **Logs** | Never log clinical values together with names or phone numbers |
| **AI** | Never receives the patient's name; never decides anything |

---

## 11. Speed: what we did and what is left

**Done:**

- **Live notifications** on the dashboard when a patient writes (Supabase Realtime): a card appears in about **0.5 s**; the tab title shows the waiting count, e.g. "(2) SafeMaman".
- Token check done locally (`getClaims`) instead of calling the Auth server on every request.
- The doctor's profile is cached for 30 s on the server.
- Independent database reads run **in parallel**.
- **Prefetch:** pointing at a patient starts loading her file before the click.
- **One SQL query per page** instead of one per related table (Prisma `relationJoins`): the patient file went from 2.5–3.4 s to 1.6 s.

**Left (known):** each database query costs about **600 ms** because of the distance between this computer and Supabase's servers. A questionnaire submission makes about a dozen of them (8–15 s). The fix is to **deploy the API on Vercel in the same region as Supabase**: each query then takes a few milliseconds. As a backup, the submission code can be reworked to make 2–3 database trips instead of about 12.

---

## 12. Quality: tests and checks

| Part | Tests |
| --- | --- |
| `packages/shared` (rules, schemas, learned risk) | 68 tests, including the learned risk compared with Python on 500 real cases |
| `apps/web` (AI texts, safety, fallbacks) | 28 tests |
| `apps/mobile` | 8 tests (profile date helpers) |

Before every commit: `pnpm -r typecheck`, `pnpm -r lint` and the tests. Rule functions take the current time as a parameter, so tests can check "what happens 61 minutes after a severe reading" without waiting.

---

## 13. Demo data and demo mode

- **Seed** (`apps/web/prisma/seed.ts`): fictional data only. 9 doctors and 57 patients, including the demo doctor `docteur@demo.dz` / `Demo1234!` and patients built to show each level: Amina (stable, live demo), Sarah (high initial risk), Lina (rising trend → watch), Meriem (twins, 2 of 3 readings high → high), Yasmine (no reading for 3 days → silent), Nour (one severe reading never re-measured → "non confirmée").
- **Each patient reaches her level through the rules**, not by writing the level directly: the seed inserts readings and questionnaires, and the rules compute the result.
- **Demo mode** (`DEMO_MODE=true`): the 15-minute re-measure becomes 10 seconds, so the full emergency scenario fits in a 2-minute demo. A banner "Mode démo : délais raccourcis" shows on both apps. It never hides or fakes a rule.

---

## 14. Honest limits and next steps

**Limits:**

- Thresholds, danger signs and risk factors come from common guidelines and **must be validated by a doctor or midwife**.
- The learned risk is experimental (US data, AUC 0.65, no clinical validation).
- Manual entry: the patient types her readings (no connected device yet).
- French only for now.
- Not a medical device; no regulatory certification.

**Next steps (roadmap):** import from connected blood-pressure monitors, SMS channel for patients without a smartphone, Arabic (right-to-left), a model trained and validated on local data, server push notifications, teams of several doctors.

---

## 15. Questions the jury may ask — with answers

**Product**

- **Who is this for?** Pregnant women with or at risk of high blood pressure, and the doctor or midwife who follows them between visits.
- **What happens if the patient has a danger sign?** The app immediately shows a full-screen "go to the maternity emergency room or call 14 now" with a call button, and the doctor gets an urgent alert. No waiting, no re-measure.
- **Can the app tell a patient she's fine and miss something?** The app never tells a patient not to seek help. Danger signs always trigger the emergency screen, a low risk never hides an alert, and the chat repeats "not for emergencies, call 14".
- **Does the app diagnose?** No. It applies explicit guideline thresholds and shows the reasons; the doctor decides.
- **What if the doctor doesn't look at the dashboard?** The patient's emergency instructions don't depend on the doctor: she gets them instantly on her phone. The doctor's view is for follow-up and prioritisation.
- **Why a 15-minute re-measure?** One high value is often a measuring error. Confirming avoids false alarms, and the unconfirmed reading is still shown to the doctor.

**Technical**

- **Why Next.js?** Dashboard and API in one TypeScript project: one server, one deployment, shared types. See [section 5](#5-architecture-and-technical-choices).
- **Why not a separate backend?** Separation is by layer inside the app (pages / API routes / services / shared rules). A second project would add deployment and duplication with no benefit at this size.
- **Why Supabase?** Postgres + login + realtime chat in one free service.
- **Why Prisma on top of Supabase?** Typed queries, versioned migrations, transactions and locks.
- **Why are the rules in a shared package?** So there is only one engine: phone and dashboard can never disagree.
- **How does the dashboard update?** It polls the API every 3 seconds; chat and new-message notifications use realtime.
- **How do you prevent a doctor from seeing other doctors' patients?** Every API query is filtered by the logged-in user and an accepted link; the chat is protected by RLS in the database itself.
- **How are concurrent readings handled?** A per-patient database lock inside a transaction, so two readings sent together can't both think they "confirm" the same severe reading.

**AI**

- **Where does your data come from?** CDC (US government) birth certificates: every US birth in 2022 and 2023, public domain, anonymous.
- **How many records?** 3.56 million births for training (2022) and 3.49 million for testing (2023).
- **How did you train it?** We extracted the needed fields, encoded age and BMI in bands, then fitted a logistic regression with scikit-learn on 2022, and tested on 2023, which it never saw.
- **Why not deep learning / XGBoost?** We tried XGBoost on the GPU: AUC 0.659 vs 0.653. Not worth losing explainability; doctors must see why.
- **Is AUC 0.65 enough?** For profile-only prediction it is in line with published results, and it beats our rules (0.60). That's why it is labelled experimental and never decides anything; blood pressure readings drive the alerts.
- **Is it valid in Algeria?** Not proven: it is US data. It needs validation on local data; that's on the roadmap.
- **Why exclude chronic hypertension?** The US certificate never ticks "gestational hypertension" for those women, so the data can't describe them. Our rules already classify them high risk.
- **What does the language model do?** Writes a summary for the doctor, suggests a message the doctor edits, and answers general questions for the patient. It never computes a risk or an alert.
- **What if the AI is down or wrong?** Each feature has a built-in text from the same facts; safety sentences are added by code, not trusted to the model; summaries are labelled "à vérifier".
- **What data is sent to the AI?** Computed facts only, never names.

**Team and process**

- **Who did what?** Ramy: web dashboard, API, database, shared rules, the CDC learned-risk model and the AI texts. Yasser: mobile app. Seryne: AI, starting with the first model experiment (archived).
- **How do you work together?** One branch per person, pull requests into `main`, shared contract in `packages/shared`.

---

## 16. Glossary

| Term | Meaning |
| --- | --- |
| **Pre-eclampsia** | High blood pressure in pregnancy with signs of organ damage; can become dangerous quickly |
| **Eclampsia** | Seizures caused by pre-eclampsia; an emergency |
| **Systolic / diastolic** | The high / low number of a blood-pressure reading (e.g. 140/90) |
| **SA** (*semaines d'aménorrhée*) | Pregnancy weeks counted from the last period |
| **Monorepo** | Several apps in one Git repository |
| **API** | The server endpoints the apps call to read and write data |
| **ORM** (Prisma) | A library that turns database tables into typed code |
| **Migration** | A versioned change to the database structure |
| **Pooler** | A service that shares a few database connections between many requests |
| **RLS** (Row Level Security) | Postgres rules that decide, row by row, who can read or write |
| **Realtime** | Supabase service that pushes new rows to the apps instantly |
| **Polling** | Asking the server again at a fixed interval (here every 3 s) |
| **Zod** | A library that checks data has the expected shape |
| **Logistic regression** | A simple model: a base value plus one weight per factor, turned into a probability |
| **XGBoost** | A powerful model made of hundreds of decision trees; accurate but hard to explain |
| **ROC-AUC** | Chance that the model ranks a real case above a non-case (0.5 = random, 1 = perfect) |
| **Calibration** | Whether predicted probabilities match observed rates |
| **Odds multiplier** | How much a factor multiplies the odds of the outcome (×2 = twice the odds) |
| **Train / test split** | Learn on one part of the data, check on another part it never saw |
| **LLM** | Large language model (the AI that writes text) |
| **Fallback** | The built-in text used when the AI is unavailable |
