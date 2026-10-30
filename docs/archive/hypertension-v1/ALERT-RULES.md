# Alert Rules — Normative Specification

**This file is law.** Every threshold, precedence rule and user-facing string lives here and in `src/lib/alerts/thresholds.ts`. No UI component, API route or seed script may contain a blood-pressure number.

The engine is a **pure function**: same input → same output, no database, no clock, no network.

```ts
evaluatePatient(input: EvalInput): EvalResult
```

If it isn't pure, it isn't testable, and the demo can't be rehearsed.

---

## 1. Input

```ts
type Symptom =
  | 'HEADACHE' | 'DIZZINESS' | 'NOSEBLEED'      // not danger
  | 'CHEST_PAIN' | 'VISION' | 'CONFUSION'
  | 'WEAKNESS' | 'SPEECH';                      // DANGER

type Session = {
  id: string;
  startedAt: Date;          // UTC
  avgSys: number;           // mean of the session's readings
  avgDia: number;
  avgPulse: number | null;
  channel: 'WEB' | 'SMS';
  status: 'PENDING' | 'CONFIRMED';
  pillTaken: boolean | null;   // null = not reported, NOT "false"
  symptoms: Symptom[];
  supersededBySessionId?: string | null;  // set when this session was folded into another
  confirmedAt?: Date | null;
};

type EvalInput = {
  patient: {
    targetSys: number | null;        // doctor-set, may be null
    targetDia: number | null;
    expectedReadingsPerWeek: number; // default 3
    highRisk: boolean;               // drives the silence window
    lastOfficeSys: number | null;
    lastOfficeDia: number | null;
  };
  sessions: Session[];   // ALL sessions for this patient, any order, incl. pending
  now: Date;             // injected, never Date.now()
};
```

## 2. Output

```ts
type Level = 'EMERGENCY' | 'CRISIS' | 'ORANGE' | 'YELLOW' | 'SILENT' | 'GREEN' | 'PENDING';

type EvalResult = {
  level: Level;
  rank: number;             // sort key, lower = more urgent
  ruleId: string;           // e.g. 'CRISIS_CONFIRMED'
  evidence: string;         // one sentence, always with real numbers
  patientMessage: string;   // what the patient sees
  notifyDoctorNow: boolean; // true only for EMERGENCY and CRISIS
  insights: Insight[];      // pattern / white-coat / trend cards, always computed
  stats: {
    avg7: { sys: number; dia: number } | null;
    trendPerWeek: number | null;
    adherence: number | null;       // 0..1, null if no pill data
    silentDays: number | null;
  };
};
```

`stats` is returned so the dashboard never recomputes a number differently from the engine. **Two implementations of an average is how demos break.**

## 3. Rank map (triage sort order)

| rank | level | why here |
|---|---|---|
| 0 | EMERGENCY | a danger symptom is happening now |
| 1 | CRISIS | confirmed ≥180/120 |
| 2 | PENDING | unconfirmed high, patient never re-measured — invisible without this |
| 3 | ORANGE | 2 of last 3 high |
| 4 | YELLOW | average / trend / pattern |
| 5 | SILENT | no data — cannot be assessed, must not look like worsening |
| 6 | GREEN | fine |

Sort ascending by `rank`, then descending by `lastActivityAt` (most recent first). SILENT sorts by `silentDays` descending within rank 5.

## 4. Thresholds (single source)

```ts
export const T = {
  HOME_TARGET:      { sys: 135, dia: 85 },   // default when patient has no personal target
  ORANGE_READING:   { sys: 160, dia: 100 },
  CRISIS_READING:   { sys: 180, dia: 120 },
  LOW:              { sys: 90,  dia: 60  },
  CONFIRM_MINUTES:  30,      // confirmation window (normal)
  CONFIRM_MINUTES_DEMO: 1,   // demo mode
  RECHECK_MINUTES:  5,       // "rest 5 min and measure again"
  TREND_MIN_PER_WEEK: 2.0,   // mmHg/week slope that counts as rising
  TREND_HORIZON_DAYS: 21,    // only alert if the projection crosses target within this
  TREND_MIN_SESSIONS: 5,     // slope on fewer points is noise
  PATTERN_MIN_DIFF: 5,       // mmHg difference for the missed-pill pattern
  PATTERN_MIN_GROUP: 2,      // sessions needed in each group
  WHITECOAT_DIFF:   10,      // office − home ≥ 10 mmHg
  SILENCE_MULTIPLIER: 2,     // silence = 2 × expected interval
  SILENCE_MIN_DAYS: 3,
};
```

Rules:
- Personal target wins: `target = patient.targetSys ?? T.HOME_TARGET.sys`.
- A threshold is crossed with **OR**: `sys >= t.sys || dia >= t.dia`.
- Every threshold is declared "to be validated with a partner doctor" in the pitch.

## 5. Confirmation model

A **session** = one measurement occasion (2 readings 1 min apart on web, 1 reading via SMS). A **confirmation** = a second session within the confirmation window that validates the first.

Algorithm (in `lib/alerts/session.ts`, **not** in the route handler):

1. On a new session for patient P, look for P's most recent `CONFIRMED = false` session with `status = PENDING` and `now − startedAt ≤ CONFIRM_MINUTES`.
2. If found → let `first` be that session and `second` be the new one:
   - `first.avgSys = mean(all readings of first + second)`, same for dia/pulse
   - `first.status = 'CONFIRMED'`, `first.confirmedAt = now`
   - `second.status = 'CONFIRMED'`, `second.supersededBySessionId = first.id`
3. Otherwise the new session is `PENDING` and triggers the re-measure prompt.

**Statistics always use:** `status = CONFIRMED AND supersededBySessionId IS NULL`.
That single filter is why "2 of the last 3" doesn't double-count a confirmation, and why the average isn't dragged down by an old unconfirmed value.

**Cross-channel:** confirmation must work from SMS→SMS and web→web. It must **not** match across a gap longer than the window. Matching is by `patientId` + time only, never by channel.

## 6. Evaluation order — first match wins

Evaluate strictly top to bottom. Do not continue after a match (except always compute `insights` and `stats`).

```
S0  NEW        no sessions at all            → treat as SILENT, evidence "No readings yet"
S1  EMERGENCY  latest session has any DANGER symptom (any BP)   → notify now
S2  PENDING    latest session is PENDING and (sys>=160 || dia>=100)
                 · older than CONFIRM_MINUTES  → "patient did not re-measure"
                 · younger than that           → "awaiting confirmation"
                 → never notifies, always visible to the doctor
S3  CRISIS     latest confirmed session (sys>=180||dia>=120)
S4  ORANGE_HI  among last 3 confirmed: count(sys>=160||dia>=100) >= 2
S5  ORANGE_LO  among last 3 confirmed: count(sys<90||dia<60) >= 2
                AND at least one of those has DIZZINESS
S6  SILENT     now − lastConfirmedAt >= silenceWindow(patient)
S7  YELLOW_AVG 7-day mean (>=3 sessions) crosses target        → digest
S8  YELLOW_TREND slope over 14 days >= TREND_MIN_PER_WEEK
                 AND >= TREND_MIN_SESSIONS points
                 AND 0 < daysToTarget <= TREND_HORIZON_DAYS
S9  YELLOW_PATTERN  missed-pill difference >= PATTERN_MIN_DIFF
S10 GREEN      otherwise
```

Notes that matter:

- **S1 runs before everything.** A danger symptom at 128/79 is an EMERGENCY. Never ask a patient with chest pain to sit still for five minutes.
- **S2 exists so unconfirmed highs don't vanish.** The patient logs 195/125, closes the tab, never re-measures → the doctor still sees it. It is *not* an alert: no notification, no red, just a visible row. Evidence must say "unconfirmed". The threshold is the orange one (160/100), not the crisis one — a 165/100 nobody confirmed is also worth seeing. While the patient is still inside the confirmation window the row reads "awaiting confirmation", so the doctor can tell "in progress" from "abandoned".
- **S7 needs ≥3 sessions in 7 days.** With fewer, use the last 3 sessions and say "last 3 readings" in the evidence instead of "7-day average". Never average two points and call it a trend.
- **S8 requires `0 < daysToTarget`**: if the patient is already above target, S7 should have caught it. Don't fire a projection for something that already happened.
- **S9 requires both groups ≥2 and total ≥4**, and **excludes `pillTaken IS NULL`**. Untagged readings must not dilute the comparison — that's how you produce a confident wrong number.

## 7. Evidence strings (generated, never typed)

| ruleId | Template |
|---|---|
| `EMERGENCY_SYMPTOM` | `Danger sign ({symptoms}) with {sys}/{dia}. Call 14 now.` |
| `EMERGENCY_SYMPTOM` (doctor) | `{symptoms} reported with {sys}/{dia} — danger sign, patient told to call 14.` |
| `PENDING_UNCONFIRMED` | `Unconfirmed {sys}/{dia} — patient did not re-measure.` |
| `PENDING_AWAITING` | `Awaiting confirmation of {sys}/{dia}.` |
| `CRISIS_CONFIRMED` | `Confirmed {sys}/{dia}: crisis level (≥180/120).` |
| `ORANGE_REPEATED_HIGH` | `{n} of the last 3 readings above 160/100 ({list}).` |
| `ORANGE_REPEATED_LOW` | `{n} of the last 3 readings below 90/60 with dizziness ({list}).` |
| `YELLOW_AVG` | `7-day home average {avgSys}/{avgDia}, above target {tSys}/{tDia}.` |
| `YELLOW_TREND` | `Systolic rising {slope} mmHg/week over 14 days; likely above target in about {days} days.` |
| `YELLOW_PATTERN` | `Readings {diff} mmHg higher on days with a missed pill ({missed} vs {taken}, {n} sessions).` |
| `SILENT` | `Silent: no readings for {days} days, expected {expected} per week.` |
| `GREEN` | `Within target ({avgSys}/{avgDia} vs {tSys}/{tDia}).` |

Insight cards (patient page, not alert levels — these never set the colour):

| insight | Body |
|---|---|
| `WHITE_COAT` | `Home {hSys}/{hDia} vs office {oSys}/{oDia}: possible white-coat effect.` |
| `MASKED` | `Home {hSys}/{hDia} vs office {oSys}/{oDia}: possible masked hypertension.` |
| `ADHERENCE` | `{pct}% of readings tagged "took my pill".` |
| `TREND` | Always shown when a slope exists, even below threshold. |

Every number is rounded: BP to integer, slope to 1 decimal, percentages to integer.

## 8. Patient-facing copy

| level | message (FR) | action |
|---|---|---|
| EMERGENCY | `Appelez le 14 maintenant.` | one-tap `tel:14`, big, red, full screen |
| CRISIS | `Reposez-vous 30 minutes, remesurez, et contactez votre médecin aujourd'hui.` | call doctor |
| ORANGE | `Votre tension est élevée. Votre médecin a été informé.` | — |
| YELLOW | `Continuez à mesurer. Pensez à votre traitement et au sel.` | — |
| PENDING | `Reposez-vous 5 minutes et remesurez.` | re-measure |
| SILENT | `Vous n'avez pas mesuré récemment.` | measure |
| GREEN | `Bon, continuez comme ça.` | — |

Hard invariants:
- The patient is **never** told to call 14 because the *doctor* didn't answer. 14 appears only for a danger symptom, always, regardless of alert state.
- The SMS reply never contains the patient's name.
- No message may ever suggest stopping, starting or changing a dose.

## 9. Silence window

```
expectedIntervalDays = 7 / max(expectedReadingsPerWeek, 1)
silenceDays = max(T.SILENCE_MIN_DAYS, round(T.SILENCE_MULTIPLIER * expectedIntervalDays))
```

| expected per week | interval | silence fires after |
|---|---|---|
| 7 (daily) | 1 d | 3 d |
| 3 | 2.3 d | 5 d |
| 2 | 3.5 d | 7 d |
| 1 | 7 d | 14 d |

This is why the threshold is per-patient: a fixed "5 days" would flag every stable patient who measures twice a week, which is exactly the noise the brief warns about.

## 10. Alerts persistence

- Persist `EMERGENCY`, `CRISIS`, `ORANGE` only. One open alert per patient per level — re-evaluate on a new session, don't stack duplicates.
- `YELLOW`, `SILENT`, `GREEN` are **computed at read time**. No rows, no duplicates, no cleanup job.
- The hourly cron writes a `MetricSnapshot` (counts per level) so the indicators page has a time series without alert rows for yellow.

## 11. Test table (implement all of these before wiring the UI)

| # | Input | Expect |
|---|---|---|
| 1 | Single confirmed 128/79, target 135/85 | GREEN |
| 2 | Single confirmed 141/88 | YELLOW_AVG after ≥3 sessions; with 1 session → GREEN (insufficient data) |
| 3 | Confirmed 182/118 + CHEST_PAIN | EMERGENCY (not CRISIS) |
| 4 | Confirmed 128/79 + CHEST_PAIN | EMERGENCY — BP is irrelevant |
| 5 | Pending 195/125, now = +31 min | PENDING / `PENDING_UNCONFIRMED`, `notifyDoctorNow === false` |
| 6 | Pending 195/125, now = +2 min | PENDING / `PENDING_AWAITING`, `notifyDoctorNow === false` |
| 7 | Confirmed 182/118, no symptoms | CRISIS |
| 8 | Last 3 confirmed: 158/98, 162/101, 166/98 | ORANGE_REPEATED_HIGH |
| 9 | Last 3: 158/98, 150/95, 156/99 | not ORANGE (0 of 3 above 160) |
| 10 | Last 3: 88/58+dz, 86/56+dz, 130/80 | ORANGE_REPEATED_LOW |
| 11 | Last 3: 88/58, 86/56, 130/80 (no dizziness) | not ORANGE_LO → SILENT/YELLOW/GREEN by other rules |
| 12 | 14 daily sessions, slope +4/week, 7-day mean 128/84 | YELLOW_TREND, daysToTarget ≤21 |
| 13 | Same slope but 4 sessions only | not YELLOW_TREND (min 5 points) |
| 14 | pillTaken: 3× null, 2× true (mean 132), 2× false (mean 148) | YELLOW_PATTERN diff ≈16, nulls excluded |
| 15 | expected 2/wk, last session 7 d ago | SILENT |
| 16 | expected 2/wk, last session 6 d ago | not SILENT |
| 17 | Session PENDING then confirmation 10 min later | one CONFIRMED session, superseded one excluded from stats |
| 18 | Confirmation 45 min later | two separate sessions, no merge |
| 19 | Home 131/83, office 148/92 | insight WHITE_COAT, level GREEN |
| 20 | Home 148/92, office 131/83 | insight MASKED, level YELLOW_AVG |

Every evidence string in these tests must be asserted verbatim. If the copy changes, the test fails — which is the point.
