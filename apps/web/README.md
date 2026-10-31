# apps/web — doctor dashboard + API

The Next.js app that serves the doctor's web dashboard and the API used by both apps.

## Screenshots

Fictional demo data, demo doctor `docteur@demo.dz`.

| | |
| --- | --- |
| ![Login](../../docs/screenshots/web/login.png) | ![Patients](../../docs/screenshots/web/patients.png) |
| **Login** — doctor accounts only | **Patientes** — triage list, most urgent first, filters with counts, search |
| ![Patient file](../../docs/screenshots/web/patient-file.png) | ![Risk](../../docs/screenshots/web/patient-risk.png) |
| **Patient file** — why this level, BP chart, AI summary, chat | **Risk** — contributing factors, learned risk (experimental), notes |
| ![Emergency at the top](../../docs/screenshots/web/patients-emergency.png) | ![Alerts](../../docs/screenshots/web/alerts.png) |
| A danger sign sent from the phone: the patient moves to the top | **Alertes** — open / acknowledged / closed |
| ![Messages](../../docs/screenshots/web/messages.png) | ![Notification](../../docs/screenshots/web/notification.png) |
| **Messages** — patients who wrote, most urgent first | Live card when a patient writes |
| ![Invites](../../docs/screenshots/web/invites.png) | |
| **Codes et demandes** — one-time codes (24 h), link requests | |

## Docs

Everything about running, testing and the API is in the [root README](../../README.md):

- [Run the web dashboard and the API](../../README.md#run-the-web-dashboard-and-the-api)
- [API reference](../../README.md#api-reference)
- [Demo accounts](../../README.md#demo-accounts)

| Folder | Content |
| --- | --- |
| `prisma/` | schema, migrations, `sql/rls.sql`, seed |
| `src/server/` | API services (auth, rules pipeline, patient, doctor, linking) |
| `src/app/api/` | API routes |
| `src/app/d/`, `src/components/` | dashboard pages and components |
| `src/lib/` | API client, queries, formatting, French dictionary (`i18n/fr.ts`) |

Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `db:deploy`, `db:migrate`, `db:rls`, `db:seed`, `db:studio`.
