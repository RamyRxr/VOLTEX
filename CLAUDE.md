# CLAUDE.md — TensioCare (pregnancy hypertension follow-up)

Read this file fully before writing code. Then read:
1. `idea.md` — the product: what we build, for whom, and the expected demo.
2. `tools-explanation.md` — the skills, agents, hooks and commands available in the global `.claude` folder. Prefer those tools over doing the same work by hand.

When this file and your assumptions disagree, this file wins. When it is silent, **ask** before inventing product or medical behaviour.

---

## 1. Project in short

TensioCare follows **hypertension during pregnancy** (gestational hypertension, pre-eclampsia) between consultations.

- **Mobile app** (`apps/mobile`, Expo) — for the pregnant patient: profile, blood pressure, daily questionnaire, result screen, history, chat, reminders, info assistant.
- **Web dashboard** (`apps/web`, Next.js) — for the doctor: invite codes, link requests, triage list, alerts, patient file, risk evolution, AI summary, chat, indicators. The same app hosts the **API** used by both.
- **Shared package** (`packages/shared`) — Zod schemas, types, risk rules, alert rules. Pure code with tests.

**Principle:** the app assists, the doctor decides. Never diagnose, prescribe, or change a treatment. A low risk estimate never tells a patient not to seek help.

**Team:** Rey owns `apps/web` + API + Prisma + `packages/shared`. His teammate owns `apps/mobile`. When working in one app, don't modify the other without being asked.

**The loop that must always work:** patient records BP / symptoms on the phone → the API computes risk and alerts → the doctor's dashboard shows it within a few seconds → doctor opens the file, sees why, acts (chat / note).

---

## 2. Rules for you (Claude Code)

1. **One engine.** Risk estimation and alert detection live **only** in `packages/shared/src/domain/` as pure functions. Mobile and web never re-implement them. The API calls them; the apps display results.
2. **Writes go through the API.** Profile, readings, questionnaires, invites and links go through Next.js API routes. Only the **chat** uses Supabase directly (Realtime).
3. **Schema first.** The Prisma schema (section 7) is the contract. Ask before adding or renaming tables/fields.
4. **API contract first.** Endpoints and JSON shapes (section 8) are shared with the mobile developer. Changing them breaks his app: ask first, then update the Zod schema in `packages/shared` so both sides get the change.
5. **Tests for every rule** in `packages/shared/src/domain/` (Vitest). Domain functions take `now: Date` as a parameter; never call `new Date()` inside them.
6. **Medical numbers in one file:** `packages/shared/src/domain/config.ts`. Never hardcode a threshold elsewhere. Every value there is marked "to validate with a doctor".
7. **No live LLM in the demo path.** Every LLM feature has a timeout and a static fallback; demo patients have pre-generated outputs.
8. **Scope discipline.** Build in the order of section 11. Roadmap items are never built.
9. **No new dependencies** beyond section 5 without asking.
10. **Small steps.** Finish and verify one feature end to end before the next. Before saying "done": typecheck, lint and tests pass.
11. **French UI.** All user-facing text in French, through a dictionary file per app (`i18n/fr.ts`), never hardcoded in components.
12. **Status is never colour alone:** always icon + colour + word.

---

## 3. Users and access

| Role | App | Can see |
| --- | --- | --- |
| PATIENT | Mobile | Own profile, readings, questionnaires, risk, alerts shown to her, chat with her doctor |
| DOCTOR | Web | Only patients with an **ACCEPTED** link to him |

- Every API query is scoped to the authenticated user (`patientId = me` or `doctorId = me AND link accepted`).
- A patient has at most **one** accepted doctor at a time.
- No data is shared with a doctor before he accepts the link.

### Doctor ↔ patient linking
1. Doctor generates an **invite code**: 6 characters from `A-Z` + `2-9` (no `0/O/1/I`), valid **24 h**, **single use**.
2. Patient submits the code → a `LinkRequest` with status `PENDING` is created; the code is marked used.
3. Doctor **accepts** or **refuses**. On accept, the patient's data and the chat become visible to him.
4. Wrong, expired or used code → generic error message (do not reveal which).
5. Rate-limit code attempts per patient (e.g. 5 per 10 minutes).

---

## 4. Product behaviour

### 4.1 Mobile (patient)
1. **Sign up / log in** — Supabase Auth (email + password). Then **consent** screen (required, store `consentAt`).
2. **Profile** — name, birth date (age computed), **due date OR last menstrual period** (pregnancy week computed daily), first pregnancy, multiple pregnancy, chronic hypertension, previous pre-eclampsia, diabetes (before pregnancy / gestational), kidney disease, autoimmune disease, family history of pre-eclampsia, family history of hypertension, IVF, height, weight, current treatments (free text). *Final list to be confirmed by Rey.*
3. **Initial risk** shown after profile: category + factors + "Estimation indicative, pas un diagnostic".
4. **Add my doctor** — enter code → "En attente d'acceptation" → linked.
5. **Add blood pressure** — big +/− steppers (systolic, diastolic, pulse). Defaults 120/80/80, step 1, long-press repeat. Short guidance first (rest 5 min, seated, arm at heart level). `source = MANUAL`.
6. **Daily questionnaire** — yes/no items (section 6.3). Can be filled with or without a BP reading.
7. **Result screen** — returned by the API: status (icon + colour + word), message, and if needed the action:
   - Danger → full screen "Allez aux urgences de la maternité ou appelez le 14 maintenant" + `tel:14` button.
   - Severe reading, not yet confirmed → "Reposez-vous et mesurez à nouveau dans 15 minutes" + countdown.
8. **History** — BP chart with 140/90 and 160/110 lines; past questionnaires.
9. **Chat** — Supabase Realtime. Permanent banner: "Le chat n'est pas pour les urgences."
10. **Reminders** — Expo local notifications (BP morning/evening, questionnaire daily), times editable.
11. **Info assistant** — general information only (see 9.3).

### 4.2 Web (doctor)
1. **Log in** (Supabase Auth, role DOCTOR).
2. **Invite codes** — generate, see active codes, see **pending link requests**, accept / refuse.
3. **Triage list (home)** — sorted per section 6.5. Each row: status icon + colour + word, name, pregnancy week, last BP + time, current risk category, alert reason. Polling every 3 s (TanStack Query `refetchInterval`).
4. **Alerts inbox** — open alerts, reason, evidence, time; acknowledge / close.
5. **Patient file**
   - Profile and history
   - **Risk card:** category + contributing factors (explanations), and a **risk timeline** (all assessments)
   - BP chart with threshold lines, sessions marked confirmed / unconfirmed
   - Questionnaire answers over time
   - Alert history
   - **AI summary** (section 9.1)
   - **Doctor notes / decisions** (add, list with date)
   - Chat panel
6. **Indicators** — section 10.

---

## 5. Tech stack (decided)

| Part | Choice |
| --- | --- |
| Monorepo | pnpm workspaces: `apps/web`, `apps/mobile`, `packages/shared` |
| Web + API | Next.js (App Router), TypeScript strict, Tailwind CSS, TanStack Query, Recharts, React Hook Form + Zod |
| Mobile | React Native + **Expo** (Expo Router), TypeScript, TanStack Query, React Hook Form + Zod, `expo-notifications` (local only), `@supabase/supabase-js` |
| Database | **Supabase Postgres** with **Prisma** (migrations owned by `apps/web`) |
| Auth | **Supabase Auth** on both apps. The API reads `Authorization: Bearer <supabase access token>` and verifies it server-side (`supabase.auth.getUser(token)`), then loads the `Profile` row to get the role |
| Chat | **Supabase Realtime** subscription on `Message` inserts, protected by **RLS** |
| Tests | Vitest (`packages/shared` mainly) |
| Deploy | Vercel (web + API), Supabase (DB/Auth/Realtime), Expo Go for the demo phone (no native build) |
| LLM | Called only from Next.js server routes; provider via env vars |

### Supabase + Prisma notes
- Two URLs: `DATABASE_URL` = pooler (port 6543, `?pgbouncer=true`), `DIRECT_URL` = direct (port 5432) for migrations. `schema.prisma` uses `directUrl = env("DIRECT_URL")`.
- The **service role key** exists only in `apps/web` server code. The mobile app gets only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- RLS policies for `Message` live in a SQL file under `apps/web/prisma/sql/rls.sql`, applied after migrations. Policy: a user can read/insert messages only in a conversation (`LinkRequest` ACCEPTED) where they are the patient or the doctor.
- Enable Realtime only on the `Message` table.

### Monorepo + Expo
Expo resolves workspace packages with a Metro config (`watchFolders` + `nodeModulesPaths`). If this takes more than 30 minutes to make work, **stop and ask** — fallback is copying `packages/shared/src` into the mobile app.

---

## 6. Domain rules (`packages/shared/src/domain/`)

**All values below are initial values from common obstetric guidelines and must be validated by a doctor or midwife.** Keep them in `config.ts`.

### 6.1 Config
```ts
export const CONFIG = {
  bp: {
    hypertension: { sys: 140, dia: 90 },   // ≥ either → hypertensive range
    severe:       { sys: 160, dia: 110 },  // ≥ either → severe range
  },
  confirmSevereAfterMinutes: 15,           // re-measure delay for a severe reading
  confirmationWindowMinutes: 60,           // second session within this window confirms
  demoMode: { confirmSevereAfterSeconds: 10 },
  trend: { windowDays: 14, minSessions: 5, minSlopeSysPerWeek: 2 },
  silence: { multiplier: 2 },              // silent if no session for 2× expected interval
  expectedSessionsPerDay: 2,               // default, editable per patient by the doctor
  risk: {
    ageHigh: 40,                           // moderate factor
    bmiHigh: 35,                           // moderate factor
  },
  dashboardPollMs: 3000,
} as const;
```
"≥ threshold" means **systolic ≥ sys OR diastolic ≥ dia**.

### 6.2 Blood pressure sessions
- A **session** = one measurement entry (sys, dia, pulse, takenAt, source).
- Session status:
  - `NORMAL` — below hypertension threshold
  - `HYPERTENSIVE` — in [140/90, 160/110)
  - `SEVERE_PENDING` — ≥ 160/110, waiting for a confirmation session
  - `SEVERE_CONFIRMED` — a second session within `confirmationWindowMinutes` is also ≥ 160/110
  - `SEVERE_NOT_CONFIRMED` — the confirmation session came back below 160/110
  - `SEVERE_EXPIRED` — no confirmation arrived in the window (shown to the doctor as "non confirmée")
- `SEVERE_PENDING / NOT_CONFIRMED / EXPIRED` are excluded from averages and trends but **always shown** to the doctor.

### 6.3 Questionnaire items
Danger items (any "yes" = emergency):
`SEVERE_HEADACHE`, `VISION_PROBLEMS`, `UPPER_ABDOMINAL_PAIN`, `SUDDEN_SWELLING_FACE_HANDS`, `BREATHING_DIFFICULTY`, `REDUCED_FETAL_MOVEMENT`
Watch items (any "yes" = watch):
`MILD_HEADACHE`, `SWELLING_LEGS`, `NAUSEA_VOMITING`, `UNUSUAL_FATIGUE`
Keep the lists as constants `DANGER_ITEMS` and `WATCH_ITEMS`. **Lists to be validated.**

### 6.4 Detection — `evaluate(input, now)` (order is fixed)
Runs on every new session or questionnaire. Independent from the risk category.
1. **Danger item answered yes** → `EMERGENCY`. Patient: go to maternity emergency / call 14 now. Doctor: immediate alert. **Stop. No re-measure, whatever the BP.**
2. **Resolve pending** severe session if this is a new session within the window (confirmed / not confirmed).
3. **New severe reading** (≥ 160/110), no danger item → `SEVERE_PENDING`; patient asked to re-measure in 15 min (10 s in demo mode). Doctor sees "Mesure sévère non confirmée". If confirmed → `SEVERE` alert: patient told to go to maternity emergency now; doctor immediate alert.
4. **Classify** the patient's current level:

| Level | Evidence | Trigger | Patient word |
| --- | --- | --- | --- |
| `EMERGENCY` | questionnaire | danger item | Urgent |
| `SEVERE` | confirmed session | confirmed ≥ 160/110 | Urgent |
| `HIGH` | 2 of last 3 valid sessions | ≥ 140/90 | Attention |
| `WATCH` | trend / risk / watch items | rising trend, risk category increased, or watch item yes | À surveiller |
| `SILENT` | time | no session for `multiplier × expected interval` | À suivre |
| `OK` | recent sessions | none of the above | Bon |

- Most severe level wins; `SILENT` is shown as an extra tag if another level applies.
- Trend: linear regression of systolic on valid sessions over 14 days (≥ 5 sessions); rising if slope ≥ `minSlopeSysPerWeek`.
- Alerts are **de-duplicated**: one open alert per patient per level + evidence; update instead of duplicating.

### 6.5 Triage sort
`EMERGENCY` → `SEVERE` → patients with an unconfirmed severe reading → `HIGH` → `WATCH` → `SILENT` → `OK`. Inside a group: most recent first.

### 6.6 Risk estimation — `estimateRisk(profile, recent, now)`
Explainable, rule-based. Returns `{ category: 'LOW' | 'MODERATE' | 'HIGH', factors: { code, label, weight: 'HIGH' | 'MODERATE' }[], reasons: string[] }`.

**Initial factors** (from profile) **[to validate]**:
- High-weight: previous pre-eclampsia, chronic hypertension, pre-existing diabetes, kidney disease, autoimmune disease, multiple pregnancy.
- Moderate-weight: first pregnancy, age ≥ 40, BMI ≥ 35, family history of pre-eclampsia, IVF pregnancy.

Initial category: **HIGH** if ≥ 1 high-weight factor or ≥ 2 moderate; **MODERATE** if 1 moderate; else **LOW**.

**Dynamic re-evaluation** adds observed factors:
- hypertensive sessions (2 of last 3 ≥ 140/90) → raises to at least HIGH
- rising trend → raises one level
- watch items answered yes in the last 7 days → raises one level (max HIGH)

Never lowers below the initial category. Every call is stored as a `RiskAssessment` row (category, factors JSON, trigger) so the doctor sees the risk timeline. The UI must always show the **factors**, never a bare category.

---

## 7. Data model (Prisma) — the contract

```prisma
enum Role            { PATIENT DOCTOR }
enum LinkStatus      { PENDING ACCEPTED REFUSED }
enum MeasureSource   { MANUAL DEVICE }
enum SessionStatus   { NORMAL HYPERTENSIVE SEVERE_PENDING SEVERE_CONFIRMED SEVERE_NOT_CONFIRMED SEVERE_EXPIRED }
enum RiskCategory    { LOW MODERATE HIGH }
enum AlertLevel      { EMERGENCY SEVERE HIGH WATCH SILENT }
enum AlertStatus     { OPEN ACKNOWLEDGED CLOSED }

model Profile {                     // one per Supabase auth user
  id        String   @id @db.Uuid   // = auth.users.id
  role      Role
  fullName  String
  phone     String?
  createdAt DateTime @default(now())
  patient   Patient?
  doctor    Doctor?
}

model Doctor {
  id        String       @id @default(uuid()) @db.Uuid
  profileId String       @unique @db.Uuid
  profile   Profile      @relation(fields: [profileId], references: [id])
  invites   InviteCode[]
  links     LinkRequest[]
  notes     DoctorNote[]
}

model Patient {
  id                       String    @id @default(uuid()) @db.Uuid
  profileId                String    @unique @db.Uuid
  profile                  Profile   @relation(fields: [profileId], references: [id])
  birthDate                DateTime
  dueDate                  DateTime? // one of dueDate / lmpDate required
  lmpDate                  DateTime?
  firstPregnancy           Boolean
  multiplePregnancy        Boolean
  chronicHypertension      Boolean
  previousPreeclampsia     Boolean
  preexistingDiabetes      Boolean
  gestationalDiabetes      Boolean
  kidneyDisease            Boolean
  autoimmuneDisease        Boolean
  familyPreeclampsia       Boolean
  familyHypertension       Boolean
  ivfPregnancy             Boolean
  heightCm                 Int?
  weightKg                 Float?
  treatments               String?
  expectedSessionsPerDay   Int       @default(2)
  consentAt                DateTime
  aiSummary                String?   // pre-generated for demo patients
  sessions                 BpSession[]
  questionnaires           Questionnaire[]
  risks                    RiskAssessment[]
  alerts                   Alert[]
  links                    LinkRequest[]
  notes                    DoctorNote[]
}

model InviteCode {
  id        String    @id @default(uuid()) @db.Uuid
  code      String    @unique
  doctorId  String    @db.Uuid
  doctor    Doctor    @relation(fields: [doctorId], references: [id])
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

model LinkRequest {
  id         String     @id @default(uuid()) @db.Uuid
  patientId  String     @db.Uuid
  patient    Patient    @relation(fields: [patientId], references: [id])
  doctorId   String     @db.Uuid
  doctor     Doctor     @relation(fields: [doctorId], references: [id])
  status     LinkStatus @default(PENDING)
  createdAt  DateTime   @default(now())
  decidedAt  DateTime?
  messages   Message[]
}

model BpSession {
  id                   String        @id @default(uuid()) @db.Uuid
  patientId            String        @db.Uuid
  patient              Patient       @relation(fields: [patientId], references: [id])
  sys                  Int
  dia                  Int
  pulse                Int?
  takenAt              DateTime
  source               MeasureSource @default(MANUAL)
  status               SessionStatus
  confirmedBySessionId String?       @db.Uuid
  createdAt            DateTime      @default(now())
  @@index([patientId, takenAt])
}

model Questionnaire {
  id         String   @id @default(uuid()) @db.Uuid
  patientId  String   @db.Uuid
  patient    Patient  @relation(fields: [patientId], references: [id])
  answers    Json     // { [itemCode]: boolean }
  answeredAt DateTime
  @@index([patientId, answeredAt])
}

model RiskAssessment {
  id         String       @id @default(uuid()) @db.Uuid
  patientId  String       @db.Uuid
  patient    Patient      @relation(fields: [patientId], references: [id])
  category   RiskCategory
  factors    Json         // [{ code, label, weight }]
  trigger    String       // "PROFILE" | "SESSION" | "QUESTIONNAIRE"
  createdAt  DateTime     @default(now())
}

model Alert {
  id         String      @id @default(uuid()) @db.Uuid
  patientId  String      @db.Uuid
  patient    Patient     @relation(fields: [patientId], references: [id])
  level      AlertLevel
  evidence   String      // e.g. "DANGER_ITEM", "CONFIRMED_SEVERE", "TWO_OF_THREE", "TREND", "SILENCE"
  reason     String      // French, human readable
  sourceId   String?     @db.Uuid // session or questionnaire id
  status     AlertStatus @default(OPEN)
  createdAt  DateTime    @default(now())
  ackAt      DateTime?
  @@index([patientId, status])
}

model DoctorNote {
  id        String   @id @default(uuid()) @db.Uuid
  patientId String   @db.Uuid
  patient   Patient  @relation(fields: [patientId], references: [id])
  doctorId  String   @db.Uuid
  doctor    Doctor   @relation(fields: [doctorId], references: [id])
  body      String
  createdAt DateTime @default(now())
}

model Message {
  id        String      @id @default(uuid()) @db.Uuid
  linkId    String      @db.Uuid   // conversation = accepted link
  link      LinkRequest @relation(fields: [linkId], references: [id])
  senderId  String      @db.Uuid   // Profile.id
  body      String
  createdAt DateTime    @default(now())
  @@index([linkId, createdAt])
}
```

Privacy in code: never log clinical values together with names or phone numbers (log ids); every query scoped to the current user; RLS on `Message`.

---

## 8. API contract (`apps/web/src/app/api/...`)

All bodies and responses are defined as Zod schemas in `packages/shared/src/schemas/` and imported by both apps. Auth: `Authorization: Bearer <supabase access token>`.

```
# Profile & risk
GET    /api/me                         → profile + role (+ patient/doctor data)
POST   /api/patient/profile            create/update patient profile → { risk }
GET    /api/patient/risk               → latest RiskAssessment + factors

# Linking
POST   /api/doctor/invites             → { code, expiresAt }
GET    /api/doctor/invites             active codes
POST   /api/patient/link               { code } → { status: 'PENDING' }
GET    /api/patient/link               → current link status + doctor name
GET    /api/doctor/link-requests       pending requests
PATCH  /api/doctor/link-requests/:id   { action: 'ACCEPT' | 'REFUSE' }

# Data in (patient)
POST   /api/patient/sessions           { sys, dia, pulse?, takenAt?, source? } → { session, evaluation, risk }
POST   /api/patient/questionnaires     { answers } → { evaluation, risk }
GET    /api/patient/sessions?from=&to=
GET    /api/patient/questionnaires?from=&to=

# Doctor
GET    /api/doctor/patients            triage list (sorted, section 6.5)
GET    /api/doctor/patients/:id        full file (profile, risks, sessions, questionnaires, alerts, notes)
PATCH  /api/doctor/patients/:id        { expectedSessionsPerDay? }
GET    /api/doctor/alerts?status=OPEN
PATCH  /api/doctor/alerts/:id          { action: 'ACK' | 'CLOSE' }
POST   /api/doctor/patients/:id/notes  { body }
POST   /api/doctor/patients/:id/summary        → { text, generatedAt, fromCache }
POST   /api/doctor/patients/:id/draft-advice   → { text }   (doctor edits, then sends via chat)
GET    /api/doctor/indicators?from=&to=

# Assistant (patient)
POST   /api/patient/assistant          { question } → { answer }

# Jobs
POST   /api/jobs/silence               cron: silence detection + expire pending severe sessions (header CRON_SECRET)
```

`evaluation` shape (shown on the mobile result screen):
```ts
{ level: 'EMERGENCY'|'SEVERE'|'HIGH'|'WATCH'|'SILENT'|'OK',
  patientWord: string, icon: string, color: string,
  message: string,                 // French, from the approved message list
  action?: 'CALL_EMERGENCY' | 'REMEASURE',
  remeasureInSeconds?: number }
```

Chat does **not** use these routes: both apps insert into and subscribe to `Message` with the Supabase client (RLS enforced).

---

## 9. AI / LLM

Server-side only (`apps/web/src/lib/llm/`), 10 s timeout, static fallback, never in the demo path live.

1. **Doctor summary** — input: computed facts only (last sessions, averages, trend, questionnaire answers, alerts, risk factors). Output: one French paragraph; every sentence must be checkable against those facts. Cache in `Patient.aiSummary`. Label in UI: "Synthèse générée par IA — à vérifier".
2. **Draft advice** — short French message suggestion; shown in an editable box; the **doctor** sends it via chat. Never sent automatically.
3. **Patient info assistant** — general information about hypertension in pregnancy and how the app works. System prompt must: refuse diagnosis and treatment advice, and for any symptom or high reading reply with "Si vous avez ce symptôme, allez aux urgences de la maternité ou appelez le 14" and point to the questionnaire.

The LLM **never** computes risk, thresholds or alerts.

---

## 10. Indicators (doctor)

| Indicator | Definition |
| --- | --- |
| Fréquence des mesures | Valid sessions per patient per week |
| Évolution des valeurs | Group average sys/dia per week |
| Nombre d'alertes | Alerts per level per week |
| Régularité du suivi | % of patients not silent; count silent |
| Patientes en zone hypertensive | % of patients at level HIGH or above |
| Temps de réponse | Median minutes from EMERGENCY/SEVERE alert to acknowledgement |

---

## 11. Build order (30 h)

**Rey — web/API/shared**
1. Monorepo + Supabase project + Prisma schema + migration + deploy skeleton to Vercel
2. `packages/shared`: schemas, config, `evaluate`, `estimateRisk` + tests
3. API: me, profile, sessions, questionnaires, invites, link requests
4. Dashboard: triage list, accept requests, patient file (risk card + chart), alerts
5. Chat (RLS + Realtime) on the web side
6. AI summary + draft advice (with fallback), notes
7. Indicators, seed data, demo mode

**Teammate — mobile**
1. Expo skeleton, Supabase Auth, navigation, API client with shared schemas
2. Profile + consent, initial risk screen
3. Add BP (steppers), questionnaire, result screen (incl. emergency + re-measure)
4. Add doctor code, link status
5. History, chat, reminders, assistant

**Checkpoint H8:** mobile sends a session → API stores it → it appears in the dashboard.

Roadmap (never build): device import, SMS channel, Arabic RTL, trained ML model, server push notifications, multi-doctor teams.

---

## 12. Seed data (`apps/web/prisma/seed.ts`, idempotent)

Fictional only. One demo doctor (`docteur@demo.dz` / `Demo1234!`). Patients:
- **Amina**, 29, 31 weeks, first pregnancy — stable; live demo patient
- **Sarah**, 36, 26 weeks — previous pre-eclampsia + chronic hypertension → HIGH initial risk
- **Lina**, 24, 33 weeks — systolic rising over 14 days → WATCH + risk raised
- **Meriem**, 31, 22 weeks, twins — 2 of last 3 sessions ≥ 140/90 → HIGH
- **Yasmine**, 27, 29 weeks — no session for 3 days at 2/day expected → SILENT
- **Nour**, 33, 35 weeks — one severe 165/112 never re-measured → "non confirmée"
- ~10 stable OK patients

Each patient must reach her level **through the rules**, not by hardcoding it. Include pre-generated `aiSummary` texts.

---

## 13. Demo mode

`DEMO_MODE=true` (web) / `EXPO_PUBLIC_DEMO_MODE=true` (mobile): shortens the severe re-measure delay to `CONFIG.demoMode.confirmSevereAfterSeconds` and shows a banner "Mode démo : délais raccourcis" on both apps. It never hides or fakes a rule.

---

## 14. Conventions

- TypeScript strict, no `any`.
- Zod schemas shared from `packages/shared`; validate every API input.
- Web: server components by default; client components for interaction and polling.
- Mobile: functional components, TanStack Query for server state, no global store unless needed.
- Accessibility: labels on inputs, 44 px minimum touch targets, icon + word for every status.
- Small files named after what they do. Commit after each working feature.

## 15. Commands

```
pnpm install
pnpm --filter web dev
pnpm --filter mobile start            # Expo, open with Expo Go
pnpm --filter shared test
pnpm -r typecheck
pnpm -r lint
pnpm --filter web prisma migrate dev
pnpm --filter web prisma db seed
```
Before saying a task is done: `pnpm -r typecheck && pnpm -r lint && pnpm --filter shared test`.

## 16. Environment variables

`apps/web/.env`
```
DATABASE_URL=            # Supabase pooler, port 6543, ?pgbouncer=true
DIRECT_URL=              # Supabase direct, port 5432
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server only
LLM_API_KEY=
CRON_SECRET=
DEMO_MODE=true
```
`apps/mobile/.env`
```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_DEMO_MODE=true
```
Never commit `.env`; keep `.env.example` files updated.

## 17. Open questions (ask, don't guess)

- Final profile fields and questionnaire items (Rey).
- Thresholds, danger items and risk factors — doctor/midwife validation.
- Expected measurement frequency per patient.
- LLM provider.
