# apps/mobile — TensioCare app (Expo)

Owner: **Yasser** (branch `yasser`). Read `../../CLAUDE.md` (§4.1, §8, §11) and `../../idea.md` first.

One app, two spaces chosen by the role of the signed-in account:

| Space | Who | What |
| --- | --- | --- |
| **Patient** | pregnant woman | consent, medical profile, initial risk, add my doctor (code), measure BP (guided steppers), daily questionnaire, result screens (emergency / re-measure countdown), history chart, chat, reminders, info assistant |
| **Doctor** (light) | doctor | open alerts sorted by urgency, "mark as seen", notifications on new alerts, notification settings. The full patient file stays on the web dashboard. |

## Run it

```bash
# from the repo root
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:mobile            # then scan the QR code with Expo Go
```

With `EXPO_PUBLIC_API_URL` empty the app runs on its **built-in demo backend** (data kept on the phone):

| Account | Password |
| --- | --- |
| `amina@demo.dz` (patient, 31 weeks, linked to Dr Benali) | `Demo1234!` |
| `docteur@demo.dz` (doctor) | `Demo1234!` |

- New patient accounts can be created; the demo doctor code is **K7M4PQ** (accepted automatically after ~8 s).
- Demo scenario: measure **165/112** → re-measure countdown (10 s in demo mode) → measure **≥ 160/110** again → emergency screen. Questionnaire with any danger sign → emergency screen.
- "Mon espace → Réinitialiser les données de démo" restores the seed. The doctor's Réglages has "Simuler une alerte urgente".

## Checks

```bash
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile test     # Vitest: pregnancy dates, invite codes, demo engine
```

## Structure

```
src/app/              Expo Router routes
  (auth)/             welcome, login, register
  (onboarding)/       consent, profile (shown until the profile exists)
  (patient)/          tabs (home, history, chat, more) + measure, questionnaire, result, risk, doctor, reminders, assistant
  (doctor)/           alerts, settings
src/api/              contract.ts (what screens can ask), http.ts (Next.js API, CLAUDE.md §8), mock/ (demo backend)
src/auth/             session (token + /api/me), guards in src/app/_layout.tsx (Stack.Protected)
src/notifications/    local reminders, re-measure alarm, doctor alert notifier, push registration
src/components/ui/    design system (Button, Card, Stepper, StatusBadge, YesNo…)
src/i18n/fr.ts        every user-facing string
src/theme/            colours, type scale, status tones
```

Rules kept: no medical rule is computed by the app (results come from the API; `api/mock/engine.ts` is a demo
stand-in using the `shared` thresholds, deleted once the API is live). Status = icon + colour + word. Touch targets ≥ 48 px.
One safety net on the phone: if the questionnaire has a danger sign and the API is unreachable, the emergency screen is shown anyway.

## Switching to the real backend (when Ramy's API + Supabase are ready)

1. Set `EXPO_PUBLIC_API_URL` (and the Supabase keys) in `.env` — `src/api/index.ts` switches from mock to `http.ts`.
2. Wire Supabase in `http.ts`: `auth.signIn / signUp` (Supabase Auth, store the session in `auth/tokenStore.ts`) and
   `chat.list / send / subscribe` (Realtime on `Message`). These are the only two `notWired` parts.
3. Replace the hand-written types in `src/api/types.ts` with the Zod schemas from `packages/shared` once they exist.
4. To confirm with Ramy:
   - `GET /api/doctor/alerts` should include `patientName` and `pregnancyWeek` (see `DoctorAlert`).
   - `POST /api/patient/profile` also carries `phone` (stored on `Profile`).
   - **Doctor push notifications** need a new route `POST /api/doctor/push-token { token }` + a `pushToken` field, and the
     server sending via Expo Push when an alert opens. CLAUDE.md lists server push as roadmap — agree before building.
     Until then the doctor gets local notifications while the app is open or recently in the background.

## Installing on a phone

- **Demo:** Expo Go (QR code). Local notifications work there; server push does not (Expo Go limit since SDK 53).
- **Android APK** (any Android phone): `npx eas-cli@latest build -p android --profile preview` (free Expo account; `eas init` once).
- **iPhone:** needs an Apple Developer account ($99/year) for TestFlight / App Store.
- **Push for doctors:** a development or production build (`--profile development`), not Expo Go.
