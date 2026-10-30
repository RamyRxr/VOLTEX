# TensioCare — Build Plan

**Read this first.** The spec (`Hypertension Monitoring Platform — Project Spec.pdf`) is frozen. This file is the execution plan: what to build, in what order, by whom, and what "done" means. If this document and the spec disagree, this document wins — tell me and I'll fix the spec.

Companion files:
- `ALERT-RULES.md` — normative rule engine. **Single source of truth** for every alert. Do not implement thresholds anywhere else.
- `DEMO-DATA.md` — the five story patients with exact numbers that trigger each feature.
- `prisma/schema.prisma` — runnable starter schema. Copy into the app repo.
- `src/lib/alerts/rules.ts` — **working engine, already written and verified.** Copy into the app repo.
- `scripts/verify-demo.mts` — **runnable check.** `node scripts/verify-demo.mts` prints the five story patients and asserts every number in `DEMO-DATA.md`. Currently passes.

> Verified output (do not change without re-running the script):
> ```
> Fatima  ORANGE  2 of the last 3 readings above 160/100 (162/101, 166/98).
> Mohamed YELLOW  Systolic rising 3.6 mmHg/week over 14 days; likely above target in about 13 days.
> Karim   GREEN   Home 131/83 vs office 148/92: possible white-coat effect.
> Zohra   SILENT  Silent: no readings for 9 days, expected 2 per week.
> Ahmed   GREEN   Within target (132/84 vs 135/85).
> ```

---

## 0. Decisions already made (do not relitigate)

| Decision | Choice | Why |
|---|---|---|
| App shape | One Next.js (App Router) codebase: `/patient` and `/doctor` | One deploy, one auth, no native build |
| Language | TypeScript everywhere | Zod + Prisma types make integration cheap |
| DB | Postgres (Neon free tier) + Prisma | Works locally *and* on Vercel; SQLite does not persist on serverless |
| Shared DB | **Every dev points at the same Neon branch** | Seed once, everyone demos the same data |
| Realtime | Polling every 1.5 s (TanStack Query `refetchInterval`) | No WebSocket infra, looks live on stage |
| Auth | Cookie JWT (`jose`), fixed code `1234`, 2 roles | Real OTP is roadmap |
| Patient UI | Mobile web, French first, Arabic/RTL only if ahead | RTL eats hours |
| i18n | Flat dictionary `fr.ts` / `ar.ts`, no library | 20 lines beats a dependency |
| Alerts persisted | Only EMERGENCY, CRISIS, ORANGE | YELLOW/SILENT/GREEN are computed on read — no duplicate-alert bug |
| AI | Pre-generated responses + static fallback, **never a live API call on stage** | Demo safety |

**Gate:** nobody writes a threshold, a colour, or an evidence string anywhere except `src/lib/alerts/rules.ts`. If you find yourself typing `160` in a component, stop.

---

## 1. Repository layout

```
tensiocare/
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      page.tsx                        # landing → pick "Patient" / "Doctor" demo login
      login/page.tsx                  # phone + code 1234
      patient/
        layout.tsx                    # mobile shell, <html dir>
        page.tsx                      # home: status, add-reading CTA, mini chart
        add/page.tsx                  # THE screen: steppers + pill + symptoms
        result/page.tsx               # status + advice (or "Call 14 now")
        history/page.tsx              # chart + target zone
        contact/page.tsx              # call/message doctor
      doctor/
        layout.tsx
        page.tsx                      # TRIAGE LIST  (the money screen)
        alerts/page.tsx               # alert inbox
        patients/[id]/page.tsx        # patient page + insights
        indicators/page.tsx
      api/
        auth/login/route.ts
        readings/route.ts             # POST create session (1..2 readings)
        sms/inbound/route.ts          # POST from Android gateway
        doctor/patients/route.ts      # GET triage list
        doctor/patients/[id]/route.ts # GET patient detail
        alerts/[id]/route.ts          # PATCH acknowledge/close
        messages/route.ts             # POST + GET
        indicators/route.ts           # GET aggregates
        jobs/silence/route.ts         # cron: silence + snapshot
        demo/reset/route.ts           # POST reseed for rehearsals
    lib/
      db.ts                           # Prisma singleton
      auth.ts                         # sign/verify cookie, requireRole()
      alerts/
        rules.ts                      # ★ PURE ENGINE — thresholds + copy + evaluation
        insights.ts                   # DB-facing: builds Session[] from Prisma rows
        session.ts                    # confirmation matching (the only writer)
      sms/parse.ts                    # "TA 165 100 78 MP" → structured
      demo.ts                         # demo mode flag + shortened timers
    components/
      StatusBadge.tsx                 # icon + colour + WORD (never colour alone)
      Stepper.tsx
      Chart.tsx                       # Recharts wrapper
      SymptomPicker.tsx
      TriageRow.tsx
      InsightCard.tsx
  tests/
    rules.test.ts                     # vitest, table-driven
  scripts/
    verify-demo.mts                   # ★ runnable: asserts DEMO-DATA.md against the engine
```

**Ownership rule:** one person per top-level folder. A owns `app/patient` + `components`, B owns `app/doctor`, C owns `app/api` + `lib/db` + `lib/auth` + `prisma`, D owns `lib/alerts` + `lib/sms` + `prisma/seed.ts` + `tests`. Nobody edits another's folder without saying it out loud in the group chat.

---

## 2. Setup (first 20 minutes, one person, then tell the team)

```bash
npx create-next-app@latest tensiocare --ts --tailwind --app --no-src-dir
cd tensiocare
npm i @prisma/client zod jose @tanstack/react-query recharts date-fns lucide-react
npm i -D prisma tsx vitest dotenv
npx prisma init --datasource-provider postgresql
```

`.env`:
```env
DATABASE_URL="postgresql://..."          # Neon pooler URL
SESSION_SECRET="anything-long-random"
DEMO_CODE="1234"
DEMO_MODE="true"
CRON_SECRET="random"
SMS_GATEWAY_TOKEN="random"
LLM_API_KEY=""                           # optional, pre-generated only
```

Checklist:
- [ ] Create Neon project, copy **pooled** connection string
- [ ] `npx prisma migrate dev --name init`
- [ ] `npx prisma db seed` (after D delivers seed) → 30 patients
- [ ] `npm run dev` → dashboard renders 30 rows
- [ ] `vercel link && vercel deploy` → **a real URL exists today, before any feature works**
- [ ] Add `DATABASE_URL` + `SESSION_SECRET` to Vercel env, redeploy, confirm `/api/health` returns 200
- [ ] Send the URL to the group chat

Definition of done: the deployed URL shows a page, and `npx prisma studio` shows 30 patients.

---

## 3. Phases and tasks

Hour labels are blocks from kickoff, not clock time. If you have less time, compress blocks proportionally and apply the cut line in §6.

### Block 0 — 0:00 → 1:30 · Skeleton in parallel

Nobody waits for anybody. Three of four tracks need no database.

**T-C1 · Backend foundation** — owner C
- [ ] `lib/db.ts` Prisma singleton; `lib/auth.ts` with `signSession`, `verifySession`, `requireRole`
- [ ] `POST /api/auth/login` — phone + code `1234` → `{ role, redirect }`, sets cookie
- [ ] `GET /api/health` → `{ ok: true, patients: n }`
- [ ] Shared `apiHandler` wrapper: zod parse → 400 with `{ error, issues }`; catch → 500 with message
- **DoD:** `curl` login returns a cookie; a doctor cookie sees 30 patients, a patient cookie sees 1.

**T-D1 · Rule engine** — owner D
- [x] `src/lib/alerts/rules.ts` is **already written** — pure, no DB, thresholds + copy + evaluation
- [x] `scripts/verify-demo.mts` is **already written** and passes — run `node scripts/verify-demo.mts`
- [ ] Port the 20-row test table from `ALERT-RULES.md` §11 into `tests/rules.test.ts` (vitest)
- [ ] `lib/alerts/session.ts`: confirmation matching — the only place a session is written
- [ ] `lib/alerts/insights.ts`: load Prisma rows → `Session[]`, call `evaluatePatient`, return result
- **DoD:** `node scripts/verify-demo.mts` green, `npx vitest run` green, and no number `135`/`160`/`180` appears outside `rules.ts`.

**T-A1 · Patient screens on mock data** — owner A
- [ ] Mobile shell, `StatusBadge` (icon + colour + **word**), `Stepper` (big +/−, no keypad)
- [ ] `add` screen: two readings, pill toggle, symptom grid — all local state
- [ ] `result` screen: normal path and "Call 14 now" path
- [ ] Hardcoded `patient.json` fixture, no API yet
- **DoD:** a judge can add a reading on a phone in under 30 s. Danger symptom shows "Call 14 now" **without** asking to re-measure.

**T-B1 · Dashboard on mock data** — owner B
- [ ] `TriageRow` with level badge, last reading, 7-day avg, trend arrow, adherence, reason text
- [ ] Triage list sorted by the rank map in `ALERT-RULES.md`
- [ ] Patient page with Recharts line chart + shaded target zone
- [ ] Hardcoded `patients.json` fixture of 30
- **DoD:** the list looks convincing at a glance from 3 metres away.

### Block 1 — 1:30 → 4:00 · Make the loop real

**T-C2 · Session creation + confirmation** — owner C (blocking everything)
- [ ] `POST /api/readings` → creates `ReadingSession` with 1–2 `Reading` rows
- [ ] Confirmation matching: if the patient has a `PENDING` session inside the confirmation window (30 min, or ~20 s in demo mode), the new session **confirms** it per `ALERT-RULES.md` §5
- [ ] Calls `evaluatePatient()` + `createAlerts()` after commit
- [ ] Returns `{ sessionId, status, level, evidence, patientMessage }`
- **DoD:** two POSTs from the demo patient produce one CONFIRMED session and one CRISIS alert.

**T-A2 · Patient page → real API** — owner A
- [ ] Login, add-reading submit, result screen from response, history from `GET /api/readings`
- [ ] Store the pending session id in `sessionStorage` so re-measure resumes correctly
- [ ] Demo-mode countdown labels ("Demo mode: timers shortened")
- **DoD:** full patient journey works on a real phone over the deployed URL.

**T-B2 · Dashboard → real API** — owner B
- [ ] TanStack Query hooks, `refetchInterval: 1500`
- [ ] Triage list, alert inbox, patient page, acknowledge, message
- [ ] Optimistic update on acknowledge (no 1.5 s lag on stage)
- **DoD:** a reading posted by A turns B's row red without a manual refresh.

**T-D2 · Insights + seed** — owner D
- [ ] `prisma/seed.ts` with the five story patients from `DEMO-DATA.md` + 25 generated stable patients
- [ ] `insights.ts`: missed-pill pattern, white-coat/masked, trend projection, adherence, silence
- [ ] Verify against the numbers in `DEMO-DATA.md` — print all five evidence strings to console and eyeball them
- **DoD:** `npx prisma db seed` runs twice without duplicates (`upsert` or truncate-then-insert).

### Block 2 — 4:00 → 7:00 · The differentiator

**T-D3 · SMS channel** — owner D
- [ ] `lib/sms/parse.ts`: `TA 145 92 78` / `TA 145 92 78 MP` / `... CP`, tolerant of extra spaces and missing pulse
- [ ] `POST /api/sms/inbound` with a shared-secret header; unknown number → reply asking to register
- [ ] Reply text echoes the **received** numbers, never the name
- [ ] Demo data must not break: an SMS session with one reading has `avg = that reading`
- **DoD:** a real SMS from a basic phone appears on the dashboard and gets a reply, end to end.

**T-C3 · Indicators + cron** — owner C
- [ ] `GET /api/indicators?from&to` → the six indicators from the spec
- [ ] `POST /api/jobs/silence` (header `x-cron-secret`) → writes `MetricSnapshot`, returns silent patients
- [ ] `GET /api/demo/reset` → reseed to the exact demo state (for rehearsals)
- **DoD:** indicators page shows non-zero, believable numbers; reset restores the demo in <5 s.

**T-A3 · Print report + contact** — owner A
- [ ] `@media print` CSS on the patient page route: doctor's one-page pre-consultation report
- [ ] `tel:` link and message thread on the patient side
- **DoD:** Ctrl+P from the patient page produces one clean page. No PDF library.

### Block 3 — 7:00 → 9:00 · Demo hardening (this is a feature, not overhead)

- [ ] **T-D4** MM/LLM artifacts: pre-generate the French/Arabic/Darija rephrasing of one real advice string, store as JSON, label "example". Fallback = same JSON.
- [ ] **T-D4** Doctor summary paragraph: pre-generated per story patient, stored in seed (`Patient.demoSummary` or a JSON map keyed by phone).
- [ ] **T-A4** Emergency-contact SMS on EMERGENCY (via the same gateway) with the no-clinical-details text.
- [ ] **T-B4** Empty/loading/error states. The dashboard must not show a white screen if a fetch fails.
- [ ] **T-ALL** Record the **90-second backup video** of the full loop, on a phone, from the deployed URL. Save to two devices.
- [ ] **T-ALL** Rehearse twice, out loud, timed. Then freeze code.

---

## 4. API contracts (agree before coding)

```ts
// POST /api/readings
{ phone: string, readings: {sys,dia,pulse}[], pillTaken: boolean|null,
  symptoms: Symptom[], demoMode?: boolean }
→ { sessionId, status: 'PENDING'|'CONFIRMED', level, evidence,
    patientMessage, needsRecheck: boolean, emergency: boolean }

// POST /api/sms/inbound   header: x-gateway-token
{ from: string, body: string }
→ { reply: string }

// GET /api/doctor/patients        (doctor cookie)
→ [{ patientId, name, age, level, rank, reason, last:{sys,dia,at},
     avg7:{sys,dia}|null, trend:'up'|'flat'|'down', adherence, silentDays, openAlerts }]

// GET /api/doctor/patients/:id
→ { patient, sessions[], insights:[{id,title,body}], summary, notes[], alerts[] }

// PATCH /api/alerts/:id      { status:'ACKNOWLEDGED'|'CLOSED' }
// POST  /api/messages        { patientId, body }
// GET  /api/indicators?from&to
→ { frequency, evolution:[{week,sys,dia}], alertsByLevel:{...},
    regularity, controlRate, responseMinutes }
```

Rules that apply to every endpoint:
- `requireRole()` first, then zod parse, then work.
- A doctor may only touch patients where `patient.doctorId === session.doctorId`. Every query filters by it — no exceptions.
- Never return another patient's data in an error message.

---

## 5. Non-negotiables (these are what the jury actually sees)

1. **Icon + colour + word** on every status. Never colour alone.
2. **Every alert shows why it fired, with the numbers.** No "high risk" without evidence.
3. **Danger symptom ⇒ "Call 14 now", immediately, before any re-measure.**
4. **Only red notifies instantly.** Everything else waits for the digest. Say the sentence out loud in the pitch.
5. **Never claim a feature you didn't build.** Escalation, OTP, OCR, adaptive reminders = roadmap. Say the word "roadmap" and you gain credibility.
6. **No live LLM call on stage.** Pre-generated only.
7. **Numbers in copy are computed, never typed.** If the seed changes, the text changes.

---

## 6. Cut line (decide by Block 2 end, not at 5 a.m.)

| If this isn't working by then | Do this instead |
|---|---|
| SMS gateway not delivering by hour 4 | Keep the form, add a "paste incoming SMS" textarea in a hidden demo page. Demo the real phone only if it works at 8:00. |
| Patient page not on real API by Block 2 | Demo the patient flow on a local dev tunnel; dashboard stays on the deployed URL. |
| Insights (white-coat / pattern) not rendering | Ship the ones that work, delete the others from the UI. Don't ship a broken card. |
| Indicators empty or wrong | Hardcode *nothing*. Compute control rate + frequency only; drop the rest with a "roadmap" line. |
| Running out of time generally | Cut in this order: print report → emergency-contact SMS → Arabic → doctor summary → white-coat → alert inbox. **Never cut:** triage list, acknowledge, the red loop, evidence strings. |

---

## 7. Demo runbook (3 minutes, scripted)

| Time | Action | What must be true |
|---|---|---|
| 0:00 | Dashboard: 30 patients, sorted | Every row has a reason string visible |
| 0:20 | Open **Fatima** → pattern card | Reads "+16 mmHg higher on days with a missed pill" |
| 0:40 | Open **Karim** → white-coat card | "Home 131/83 vs office 148/92" |
| 0:55 | Point at **Zohra** | Grey "Silent" tag, separate from worsening |
| 1:10 | Phone: **Ahmed** enters 182/118, no symptoms | Page asks to re-measure (seconds, labelled demo mode) |
| 1:30 | Second session confirms | Dashboard row red in <2 s, no refresh |
| 1:45 | Click it | "Confirmed 182/118: crisis level" |
| 1:55 | Acknowledge + send "Come to the clinic today" | Patient side receives it |
| 2:15 | Basic phone sends `TA 165 100 78 MP` | Reading appears; reply echoes 165/100 |
| 2:40 | Indicators page | Frequency, evolution, alerts, regularity, control, response |
| 2:55 | Close on the line | "The guidelines decide, the doctor stays in charge, and no patient is left out because of their phone." |

**Failure drills — rehearse each once:**
- SMS phone dead → switch to paste-simulator, keep talking, no apology.
- Wi-Fi dead → tether to a phone; if that fails, play the backup video *while narrating it as if live* and say "this is the recording, the venue network is down."
- Database down → switch to the local build against a seeded SQLite copy (`DEMO_FALLBACK=1`).
- A row doesn't turn red in 2 s → say "polling, next tick," count to two.

---

## 8. Jury crib (beyond the spec's)

| Question | Answer |
|---|---|
| What if the patient doesn't re-measure? | The unconfirmed reading is still visible to the doctor as "pending — patient did not re-measure". Nothing vanishes. |
| Why no AI diagnosis? | The brief puts the decision with the doctor. Rules are explainable and auditable; an LLM that invents advice is a liability. We use AI only to translate and summarise. |
| Is 160/100 evidence-based? | It's a pragmatic clinic threshold, marked "to validate with a partner doctor", and every patient can have a personal target. 135/85 at home is guideline-based. |
| How does this reach 6.4 million people? | No new device: any 2,500–5,000 DZD home monitor works. No app install: SMS. No EMR integration. Cost per patient is roughly one SMS per reading (a few dinars) — validate locally. |
| Who pays? | Pharmacies/clinics sponsor screening; SMS packs are the main recurring cost; the doctor's dashboard is a per-seat subscription. State it as a model, not a contract. |
| What about data protection? | Consent at sign-up, role-scoped access, pseudonymised records, no names in SMS, designed for in-country hosting under Law 18-07. Design intent, not a legal claim. |
| What's your false-alarm rate? | We can't claim a number yet. Confirmation re-measure removes the most common cause (movement/talking). That's why we built it. |

---

## 9. Done definition for the whole project

Ship only if **all** of these are true:

- [ ] A reading enters via web **and** via SMS and lands in one place
- [ ] A confirmed 182/118 with no symptoms creates a CRISIS alert within 2 s
- [ ] A danger symptom creates EMERGENCY and skips the re-measure
- [ ] Every alert carries a generated evidence string with the actual numbers
- [ ] Doctor can acknowledge and message; the patient sees it
- [ ] All five story patients show their feature on the deployed URL
- [ ] Indicators page is populated from real data
- [ ] Backup video recorded and copied to two devices
- [ ] Code frozen 90 minutes before the pitch

---

## 10. Hour-zero checklist

1. [ ] `create-next-app`, deps, Prisma, Neon, `.env` — **C**
2. [ ] Deploy an empty skeleton to Vercel today — **C**
3. [ ] Create the 4 folders and `git init`, push to GitHub, add all 4 as collaborators — **C**
4. [ ] A and B start from fixtures, not from the API — **A, B**
5. [ ] D starts writing tests from `ALERT-RULES.md` before any DB exists — **D**
6. [ ] Test the SMS gateway phone in the first 4 hours, not the last 4
7. [ ] Pin the demo script (`§7`) in the group chat and don't let it grow
