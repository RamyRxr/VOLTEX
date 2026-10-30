# Mobile app guide (for Yasser)

The API, the database and the doctor website are ready. This guide lists every mobile screen and the route or Supabase call it uses. All request and response shapes are Zod schemas in `packages/shared` (`import { … } from "shared"`): validate with them, never redefine them.

## Basics

| Topic | How |
| --- | --- |
| Login | Supabase Auth, email + password (`supabase.auth.signInWithPassword`). Mobile `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. Never the service-role key. |
| Every API call | Header `Authorization: Bearer <session.access_token>`, body `application/json`. |
| Errors | Status 4xx / 5xx with `{ error, message }` (`apiErrorSchema`). Show `message`: it is already in French. `NO_PROFILE` (404) means "profile not filled yet". `RATE_LIMITED` (429): wait and retry. |
| Dates | ISO strings. Date-only fields (`birthDate`, `dueDate`, `lmpDate`) are `YYYY-MM-DD`. |
| Status display | Always icon + colour + word. The API already gives `patientWord`, `icon`, `color` in `evaluation`. |
| Demo mode | `EXPO_PUBLIC_DEMO_MODE=true` shows the banner "Mode démo : délais raccourcis". The 10-second re-measure delay comes from the API (`remeasureInSeconds`). |

Demo accounts (password `Demo1234!`): patients `amina@demo.dz` (stable, live demo), `nour@demo.dz`, `meriem@demo.dz`, `khadija@demo.dz` (link pending), … Doctors `docteur@demo.dz`, `dr.haddad@demo.dz`, …

## Patient screens

| # | Screen | Call | Schemas |
| --- | --- | --- | --- |
| 1 | Sign up / log in | Supabase Auth | — |
| 2 | Who am I | `GET /api/me` → `role`, `patient.hasProfile`, `patient.pregnancyWeek`. 404 `NO_PROFILE` → go to the profile form. | `meSchema` |
| 3 | Profile + consent | `POST /api/patient/profile` → `{ risk }` | `profileInputSchema`, `profileOutputSchema` |
| 4 | Initial risk | from step 3, or `GET /api/patient/risk`. Show the category and every factor, plus "Estimation indicative, pas un diagnostic". | `riskSchema` |
| 5 | Add my doctor | `POST /api/patient/link { code }` → `{ status: "PENDING" }`; then `GET /api/patient/link` → status + doctor name. | `linkInputSchema`, `linkStateSchema` |
| 6 | Add blood pressure | `POST /api/patient/sessions { sys, dia, pulse? }` → `{ session, evaluation, risk }` | `sessionInputSchema`, `sessionOutputSchema` |
| 7 | Daily questionnaire | `POST /api/patient/questionnaires { answers }` (all 10 items, true/false) → `{ evaluation, risk }` | `questionnaireInputSchema` |
| 8 | Result screen | the `evaluation` from 6 or 7 (below) | `evaluationSchema` |
| 9 | History | `GET /api/patient/sessions?from=&to=`, `GET /api/patient/questionnaires?from=&to=`. Chart lines at 140/90 and 160/110 (`CONFIG.bp`). | `sessionSchema`, `questionnaireSchema` |
| 10 | Chat | Supabase directly (below) | — |
| 11 | Reminders | local `expo-notifications` only | — |
| 12 | Info assistant | `POST /api/patient/assistant` (coming in step F) | `assistantInputSchema` |

**Profile fields** (`profileInputSchema`): `fullName`, `phone?`, `birthDate` (age is computed), `dueDate` **or** `lmpDate` (pregnancy week computed daily), `firstPregnancy`, `multiplePregnancy`, `chronicHypertension`, `previousPreeclampsia`, `preexistingDiabetes`, `gestationalDiabetes`, `kidneyDisease`, `autoimmuneDisease`, `familyPreeclampsia`, `familyHypertension`, `ivfPregnancy`, `heightCm?`, `weightKg?`, `treatments?`, `consent: true`. No "sex" field: every patient is a pregnant woman.

**Questionnaire items**: `DANGER_ITEMS` and `WATCH_ITEMS` from `shared` (French labels: `ITEM_LABELS`).

**Result screen** (`evaluation`):

| `action` | Show |
| --- | --- |
| `CALL_EMERGENCY` | Full screen: `message` ("Allez aux urgences de la maternité ou appelez le 14 maintenant") + a `tel:14` button. |
| `REMEASURE` | `message` + a countdown of `remeasureInSeconds`, then open "Add blood pressure" again. |
| none | `patientWord` + `icon` + `color` + `message`. |

## Chat (Supabase, not the API)

The conversation is the accepted link: `linkId` from `GET /api/patient/link`. RLS lets only the patient and her doctor read or write it.

```ts
// history
supabase.from("Message").select("id, senderId, body, createdAt").eq("linkId", linkId).order("createdAt");
// send: id is required (no database default), senderId = the user's id
supabase.from("Message").insert({ id: Crypto.randomUUID(), linkId, senderId: session.user.id, body });
// live
supabase.channel(`chat:${linkId}`)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "Message", filter: `linkId=eq.${linkId}` }, onMessage)
  .subscribe();
```

Keep the banner "Le chat n'est pas pour les urgences." visible on the chat screen.

## Doctor screens (light mode on mobile)

| Screen | Call | Schemas |
| --- | --- | --- |
| Patient list | `GET /api/doctor/patients` (already sorted by urgency; poll every 3 s) | `triageSchema` |
| Patient summary | `GET /api/doctor/patients/:id` (name, week, level, last readings, risk, AI summary) | `patientFileSchema` |
| Generate a code | `POST /api/doctor/invites` → `{ code, expiresAt }`; active codes: `GET /api/doctor/invites` | `inviteSchema` |
| Link requests | `GET /api/doctor/link-requests`, `PATCH /api/doctor/link-requests/:id { action: "ACCEPT" \| "REFUSE" }` | `linkRequestsSchema` |

The full doctor workspace (history, alerts, notes, chat) is the website.

## Rules to keep

- Never compute risk, thresholds or alerts in the app: the API returns them (spec §2 rule 1).
- French text through `i18n/fr.ts`, never hardcoded in components.
- 44 px minimum touch targets, labels on inputs.
