# TensioCare

**Follow-up of hypertension during pregnancy between two consultations.**
A mobile app for the pregnant patient, a web dashboard for her doctor, and one rules engine in between.

> The app assists, the doctor decides. It never diagnoses, prescribes or changes a treatment, and a low risk estimate never tells a patient not to seek help.

Built for **Hackathon SolveX 3.0 · Problem 2**. The interface is in French.

---

## Contents

1. [The problem](#the-problem)
2. [What it does](#what-it-does)
3. [How it works](#how-it-works)
4. [Tech stack and repository layout](#tech-stack-and-repository-layout)
5. [Medical rules](#medical-rules)
6. [Getting started](#getting-started)
7. [Run the web dashboard and the API](#run-the-web-dashboard-and-the-api)
8. [Run the mobile app](#run-the-mobile-app)
9. [Demo accounts](#demo-accounts)
10. [Testing](#testing)
11. [API reference](#api-reference)
12. [Troubleshooting](#troubleshooting)
13. [Team and Git workflow](#team-and-git-workflow)
14. [Security and privacy](#security-and-privacy)
15. [Roadmap](#roadmap)

---

## The problem

Gestational hypertension and pre-eclampsia can turn dangerous within hours, often between two prenatal visits. Patients measure their blood pressure at home but have no simple way to know when a reading or a symptom is urgent, and doctors have no view of what happens between visits.

TensioCare closes that gap:

- the **patient** records her blood pressure and a short daily questionnaire on her phone, and gets a clear answer (including "go to the maternity emergency room now" when needed);
- the **doctor** sees all her patients sorted by urgency, with the reason, within seconds, and acts (chat, note).

## What it does

### Mobile app (Expo) — for the patient

| Screen | What it does |
| --- | --- |
| Sign up / log in | Email + password (Supabase Auth) |
| Profile + consent | Name, birth date (age computed), due date or last period (pregnancy week computed daily), medical history (first pregnancy, twins, chronic hypertension, previous pre-eclampsia, diabetes, kidney / autoimmune disease, family history, IVF), height, weight, treatments |
| Initial risk | Low / moderate / high **with every contributing factor**, "estimation indicative, pas un diagnostic" |
| Add my doctor | One-time 6-character code given by the doctor, then "pending" until the doctor accepts |
| Add blood pressure | Large +/− steppers with guidance (rest 5 min, seated, arm at heart level) |
| Daily questionnaire | 6 danger signs and 4 watch signs, yes / no |
| Result screen | Status (icon + colour + word) and message; full-screen emergency with a `tel:14` button, or a re-measure countdown for a severe reading |
| History | Blood pressure chart with the 140/90 and 160/110 lines, past questionnaires |
| Chat | Live chat with her doctor ("Le chat n'est pas pour les urgences.") |
| Reminders | Local notifications for measurements and the questionnaire |

### Mobile app — light doctor mode

Patient list sorted by urgency, patient summary, invite-code generator, link requests.

### Web dashboard (Next.js) — for the doctor only

| Page | What it does |
| --- | --- |
| Login | Doctor accounts only (patients are refused and sent to the app) |
| **Patientes** (triage) | All linked patients sorted from most urgent to most stable, filters by level with counts, search, pending-request banner. Each row: status (icon + colour + word), name, pregnancy week, last reading and time, risk, reason. Refreshes every 3 s. |
| **Patient file** | Why this level (every rule that fired), BP chart with threshold lines (unconfirmed readings shown hollow), full reading history, every questionnaire answer, alerts, risk factors and risk timeline, **learned risk (experimental)**, profile, AI summary box, doctor notes, live chat |
| **Alertes** | Open / acknowledged / closed alerts; acknowledge, close |
| **Codes et demandes** | Generate one-time invite codes (24 h), accept or refuse link requests (only the name and date are visible before acceptance) |

## How it works

```mermaid
flowchart LR
  P["Patient<br/>mobile app"] -- "BP / questionnaire<br/>(Bearer token)" --> API["Next.js API<br/>apps/web"]
  API -- "shared rules<br/>evaluate · estimateRisk" --> R["packages/shared"]
  API -- Prisma --> DB[("Supabase<br/>Postgres")]
  D["Doctor<br/>web dashboard"] -- "poll every 3 s" --> API
  P <-- "chat (Realtime + RLS)" --> DB
  D <-- "chat (Realtime + RLS)" --> DB
```

1. The patient records a reading or a questionnaire on her phone.
2. The API runs the **shared rules** (`packages/shared`): it confirms or expires severe readings, estimates the risk, decides the level and opens or updates alerts.
3. The phone shows the result (emergency, re-measure, or status).
4. The doctor's dashboard shows the change within 3 seconds; the doctor opens the file, sees **why**, and acts (chat, note).

**One engine:** risk and alert rules exist only in `packages/shared/src/domain/` as pure, tested functions. The apps only display what the API returns.

## Tech stack and repository layout

| Part | Choice |
| --- | --- |
| Monorepo | pnpm workspaces |
| Web + API | Next.js 15 (App Router), TypeScript strict, TanStack Query |
| Mobile | React Native + Expo (Expo Router), TanStack Query |
| Database | Supabase Postgres + Prisma (migrations in `apps/web`) |
| Auth | Supabase Auth on both apps; the API verifies the access token server-side |
| Chat | Supabase Realtime on the `Message` table, protected by Row Level Security |
| Validation | Zod schemas shared by the API and both apps |
| Tests | Vitest |

```
apps/
  web/            Next.js: doctor dashboard + the API used by both apps + Prisma
    prisma/         schema, migrations, sql/rls.sql, seed (demo data)
    src/server/     API services: auth, pipeline (rules on DB data), patient, doctor, linking
    src/app/api/    API routes (spec §8)
    src/app/d/      dashboard pages
  mobile/         Expo app: patient space + light doctor space
packages/
  shared/         rules (evaluate, estimateRisk, triage…) + Zod schemas + learned-risk scorer, with tests
ml/               learned risk model: CDC data extraction, training (GPU), model card, reports
docs/
  MOBILE-GUIDE.md every mobile screen → its API route → its shared schema
idea.md           the product: what we build, for whom, the expected demo
```

## Medical rules

All values are initial values from common obstetric guidelines and **must be validated by a doctor or midwife**. They live in one file: `packages/shared/src/domain/config.ts`.

**Blood pressure** ("≥" means systolic ≥ OR diastolic ≥):

| Range | Threshold |
| --- | --- |
| Hypertensive | ≥ 140/90 |
| Severe | ≥ 160/110, must be confirmed by a second reading within 60 min (re-measure after 15 min, 10 s in demo mode) |

**Levels** (detection order is fixed; the most severe wins):

| Level | Trigger | Patient sees |
| --- | --- | --- |
| Emergency | a danger sign answered yes (severe headache, vision problems, upper abdominal pain, sudden swelling of face or hands, breathing difficulty, reduced fetal movement) | Urgent — go to the maternity emergency room or call 14 |
| Severe | confirmed reading ≥ 160/110 | Urgent — same message |
| High | 2 of the last 3 valid readings ≥ 140/90 | Attention |
| Watch | systolic rising over 14 days, risk raised, or a watch sign (mild headache, leg swelling, nausea, unusual fatigue) | À surveiller |
| Silent | no reading for 2 × the expected interval | À suivre |
| OK | none of the above | Bon |

An unconfirmed severe reading is never hidden: the doctor sees it ("Sévère non confirmée"), right after Emergency and Severe in the triage order.

**Risk** (explainable, rule-based): high-weight factors (previous pre-eclampsia, chronic hypertension, pre-existing diabetes, kidney disease, autoimmune disease, multiple pregnancy) and moderate ones (first pregnancy, age ≥ 40, BMI ≥ 35, family history of pre-eclampsia, IVF). HIGH if ≥ 1 high-weight or ≥ 2 moderate factors, MODERATE if 1 moderate, LOW otherwise; raised by hypertensive readings, a rising trend or recent watch signs; never lowered below the initial category. Every estimate is stored, so the doctor sees the risk timeline.

**Learned risk (experimental, doctor only).** Next to the rule-based risk, the patient file shows a probability learned from **7 million real US births** (CDC natality files: trained on 2022, tested on 2023), from the same profile factors. It is an explainable logistic model: the doctor sees each factor's multiplier (e.g. BMI ≥ 35 ×3.5, pre-existing diabetes ×2.4, twins ×2.0). On 3.5 million births it never saw, it reaches ROC-AUC 0.65 (current rules: 0.60; a GPU XGBoost model reached 0.66 but was kept out because it is not explainable), and its predicted risk matches the observed rates. It is not applicable with chronic hypertension and **never changes levels, alerts or the rule-based risk**. Data, results and limits: [ml/README.md](ml/README.md).

## Getting started

### Prerequisites

- **Node.js 20+** and **pnpm 9.15** (`npm install -g pnpm@9.15.0`)
- **Expo Go** on an Android or iOS phone (for the mobile app)
- A **Supabase** project (database, auth, realtime) — already set up for the team

### 1. Install

```bash
git clone https://github.com/RamyRxr/VOLTEX.git
cd VOLTEX
pnpm install
```

### 2. Environment files

Secrets are **never committed**: every `.env` file is ignored by Git. Copy the templates and fill them; team members get the values privately from the project owner.

```bash
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

**`apps/web/.env`** (server only):

| Variable | Where to find it |
| --- | --- |
| `DATABASE_URL` | Supabase → **Connect** → pooler connection string (port 6543, add `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase → **Connect** → direct connection string (port 5432), used by migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → **API Keys** → project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → **API Keys** → publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → **API Keys** → secret / service-role key (**server only**) |
| `CRON_SECRET` | any random string of 32+ characters (for `/api/jobs/silence`) |
| `LLM_API_KEY` | the AI provider key (coming with the AI features) |
| `DEMO_MODE` | `true` shortens the severe re-measure delay to 10 s and shows a banner |
| `ALLOW_DEMO_SEED` | `true` only on a demo project, to allow the seed to run |

**`apps/mobile/.env`** (public values only — never the secret key or database URLs):

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://<the IP of the PC running the API>:3000` — see [Run the mobile app](#run-the-mobile-app) |
| `EXPO_PUBLIC_SUPABASE_URL` | same project URL as above |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same publishable / anon key as above |
| `EXPO_PUBLIC_DEMO_MODE` | `true` |

### 3. Database (project owner only, once)

The team database is already created and seeded. To set up a **new** Supabase project:

```bash
pnpm --filter web db:deploy   # create the tables (Prisma migrations)
pnpm --filter web db:rls      # Row Level Security on every table + chat policies + Realtime on Message
pnpm --filter web db:seed     # demo doctors and patients (needs ALLOW_DEMO_SEED=true)
```

Then, for testing, turn off email confirmation: Supabase → **Authentication → Sign In / Providers → Email → Confirm email** off (otherwise new accounts must click the link sent by email before logging in).

> Never run migrations or the seed against a production project. The seed refuses to run without `ALLOW_DEMO_SEED=true` or with `NODE_ENV=production`.

## Run the web dashboard and the API

```bash
pnpm --filter web dev
```

- The terminal must print `Local: http://localhost:3000` (if it says **3001**, an old server still holds port 3000 — see [Troubleshooting](#troubleshooting)).
- Open **http://localhost:3000** and log in as a doctor (`docteur@demo.dz` / `Demo1234!`).
- The same server is the **API** used by the mobile app: keep it running while you use the app.
- Quick health check: http://localhost:3000/api/me must answer `{"error":"UNAUTHORIZED","message":"Connexion requise"}` (correct: the browser is not logged in).

## Run the mobile app

You need **two terminals**: the API (above) and Expo.

1. Find the IPv4 address of the PC running the API:
   - Windows: `ipconfig` → "Wi-Fi" → IPv4 Address
   - macOS: `ipconfig getifaddr en0`
2. Put it in `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=http://<that IP>:3000` (`http`, no `localhost`, no trailing `/`).
3. Start Expo (the `-c` clears its cache so the new `.env` is used):
   ```bash
   pnpm --filter mobile start -c
   ```
4. Scan the QR code with **Expo Go**. The phone and the PC must be on the **same network** (same Wi-Fi, or the PC connected to the phone's hotspot).
5. Check from the phone's browser: `http://<that IP>:3000/api/me` must show `{"error":"UNAUTHORIZED",…}`. If it does not load, see [Troubleshooting](#troubleshooting).

You can log in with an existing account or create a new one (see [Demo accounts](#demo-accounts)).

## Demo accounts

All fictional. Password for every account: **`Demo1234!`**

| Account | Role | Situation |
| --- | --- | --- |
| `docteur@demo.dz` | Doctor | Dr Karima Benali, 16 linked patients + 1 pending request |
| `dr.haddad@demo.dz`, `dr.mebarki@demo.dz`, `dr.kherbache@demo.dz`, `dr.boukhalfa@demo.dz`, `dr.taleb@demo.dz`, `dr.guerroudj@demo.dz`, `dr.belaid@demo.dz`, `dr.ouali@demo.dz` | Doctors | 5 patients each, mixed levels |
| `amina@demo.dz` | Patient | 29 y, 31 weeks, first pregnancy, stable — **the live demo patient** |
| `sarah@demo.dz` | Patient | previous pre-eclampsia + chronic hypertension → high risk |
| `lina@demo.dz` | Patient | systolic rising over 14 days → Watch, risk raised |
| `meriem@demo.dz` | Patient | twins, 2 of the last 3 readings ≥ 140/90 → High |
| `yasmine@demo.dz` | Patient | no reading for 3 days → Silent |
| `nour@demo.dz` | Patient | one 165/112 never re-measured → "Sévère non confirmée" |
| `khadija@demo.dz` | Patient | link request still pending |
| `patiente01@demo.dz` … `patiente40@demo.dz` | Patients | the extra doctors' patients |

Every level comes from the rules applied to the seeded readings, never from a hardcoded value. Re-run `pnpm --filter web db:seed` to reset the demo (takes several minutes).

## Testing

### Automated checks

```bash
pnpm -r typecheck            # every package
pnpm -r lint
pnpm --filter shared test    # rules + schemas + learned risk (68 tests)
pnpm --filter web test       # dashboard helpers (11 tests)
```

### Manual end-to-end test (the demo loop)

With the API and Expo running:

1. **Dashboard:** log in as `docteur@demo.dz`. Nour is first ("Sévère non confirmée"), then Meriem (Élevée), Lina (À surveiller), Yasmine (Sans nouvelles), then the stable patients.
2. **Phone:** log in as `amina@demo.dz`, add a reading of **165/112** → the app asks to re-measure (10 s in demo mode).
3. Add **163/111** → full-screen emergency with the `tel:14` button.
4. **Dashboard:** within 3 s, **Amina moves to the top as "Sévère"** and a new alert appears in **Alertes**.
5. Open Amina's file → the chart, readings, alert and "why" are there. Send a chat message → it appears on the phone instantly; reply from the phone → it appears on the dashboard.
6. **Phone:** fill the questionnaire with "Troubles de la vue = oui" → emergency; the dashboard shows an "Urgence" alert.
7. **Linking:** create a new patient account in the app, fill the profile, then on the dashboard **Codes et demandes → Générer un code**, enter it in the app ("Ajouter mon médecin"), and **Accepter** on the dashboard → she appears in the patient list.
8. **Access rules:** log in as `dr.haddad@demo.dz` → only his 5 patients are visible, none of Dr Benali's.

Reset afterwards with `pnpm --filter web db:seed`.

### Inspect the database

```bash
pnpm --filter web db:studio   # opens every table in the browser
```

## API reference

All routes answer JSON; errors are `{ "error": CODE, "message": "French text" }`. Every request needs `Authorization: Bearer <Supabase access token>`. Request and response shapes are Zod schemas in `packages/shared/src/schemas/`.

| Method | Route | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/me` | both | profile, role, pregnancy week (404 `NO_PROFILE` = profile to fill) |
| POST | `/api/patient/profile` | patient | create / update the profile with consent → `{ risk }` |
| GET | `/api/patient/risk` | patient | current risk with factors and reasons |
| POST / GET | `/api/patient/link` | patient | submit a doctor's code / link status |
| POST / GET | `/api/patient/sessions` | patient | new reading → `{ session, evaluation, risk }` / history |
| POST / GET | `/api/patient/questionnaires` | patient | daily questionnaire → `{ evaluation, risk }` / history |
| POST / GET | `/api/doctor/invites` | doctor | new 6-character code (24 h, single use) / active codes |
| GET | `/api/doctor/link-requests` | doctor | pending requests (name and date only) |
| PATCH | `/api/doctor/link-requests/:id` | doctor | `{ action: "ACCEPT" \| "REFUSE" }` |
| GET | `/api/doctor/patients` | doctor | triage list, sorted by urgency |
| GET / PATCH | `/api/doctor/patients/:id` | doctor | full patient file / expected readings per day |
| POST | `/api/doctor/patients/:id/notes` | doctor | add a note or decision |
| GET | `/api/doctor/alerts?status=` | doctor | alerts of linked patients |
| PATCH | `/api/doctor/alerts/:id` | doctor | `{ action: "ACK" \| "CLOSE" }` |
| GET / POST | `/api/jobs/silence` | cron | silence detection + expiry of pending severe readings (`CRON_SECRET`) |

The chat does not use the API: both apps read and write the `Message` table directly through Supabase (RLS allows only the patient and her accepted doctor). See [docs/MOBILE-GUIDE.md](docs/MOBILE-GUIDE.md).

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| App says **"Pas de connexion. Réessayez dans un instant."** after login | The app cannot reach the API | Check `EXPO_PUBLIC_API_URL` is set to the PC's current IP, the API is running, then restart Expo with `pnpm --filter mobile start -c` |
| `http://<IP>:3000/api/me` does not load on the phone | Phone and PC cannot talk | Same Wi-Fi (or the phone's hotspot); allow **Node.js** in Windows Firewall (Private and Public); some campus / event Wi-Fi blocks devices from each other → use a hotspot |
| The API starts on **3001** | An old server still holds port 3000 (Ctrl+C on Windows can leave Node running) | PowerShell: `Get-NetTCPConnection -LocalPort 3000 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`, then start again |
| `ENOENT … .next-dev … route.js` or `Expected clientReferenceManifest` | The dev build folder was changed while the server was running | Stop the server (as above), delete `apps/web/.next-dev`, run `pnpm --filter web dev` again |
| New account cannot log in ("Email not confirmed") | Supabase email confirmation is on | Turn off **Confirm email** in Supabase, or click the link in the email |
| It worked yesterday, not today | Your IP changed (new network or hotspot) | `ipconfig`, update `EXPO_PUBLIC_API_URL`, restart Expo with `-c` |
| Port 3000 busy by another project | — | Stop it, or run `pnpm --filter web dev -- --port 3001` and use `:3001` in the mobile `.env` |

## Team and Git workflow

| Person | Part | Folder | Branch |
| --- | --- | --- | --- |
| Ramy ([@RamyRxr](https://github.com/RamyRxr)) | Doctor dashboard, API, database, rules | `apps/web`, `packages/shared` | `ramy` |
| Yasser ([@yasser-zm](https://github.com/yasser-zm)) | Mobile app | `apps/mobile` | `yasser` |
| AI / LLM developer (coming) | Doctor summary, draft advice, patient assistant | `apps/web/src/lib/llm` | to create |

`main` must always be demonstrable; everything reaches it through pull requests.

**Get the latest merged code** (before starting work, and after every merge):

```bash
git checkout main && git pull origin main
git checkout <your-branch> && git merge main && git push origin <your-branch>
pnpm install
```

If `pnpm-lock.yaml` conflicts: `git checkout --theirs pnpm-lock.yaml && pnpm install && git add pnpm-lock.yaml`.

Conventions: conventional commits (`feat(web): …`, `fix(mobile): …`), TypeScript strict, French UI text through `i18n/fr.ts` files, status always shown as icon + colour + word, and before any PR: typecheck, lint and tests pass.

## Security and privacy

- Every API query is scoped to the signed-in user: a patient sees only her own data; a doctor sees only patients with an **accepted** link to him. Nothing is shared before acceptance.
- Row Level Security is on for every table; only the chat table is open to the apps, and only to the two people of an accepted link.
- The service-role key and database URLs exist only in `apps/web` server code; the mobile app holds public values only.
- Invite codes: 6 characters without ambiguous letters, valid 24 h, single use; wrong, expired and used codes get the same message; attempts are rate-limited.
- Each patient's writes run under a database lock, so double taps and the background job cannot create inconsistent readings or duplicate alerts.
- Logs never contain clinical values with names; all demo data is fictional.

## Roadmap

Next: AI doctor summary and draft advice (with a static fallback, never sent automatically), the patient information assistant, the indicators page, and deployment (Vercel + Supabase).

Not planned for the hackathon: device import, SMS channel, Arabic RTL, trained ML model, server push notifications, multi-doctor teams.

---

**Medical disclaimer.** TensioCare is a hackathon prototype. Its thresholds, danger signs and risk factors are initial values that must be validated by a doctor or midwife. It does not replace medical care: in case of a worrying symptom, go to the maternity emergency room or call **14**.
