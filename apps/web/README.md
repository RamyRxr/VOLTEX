# apps/web — doctor dashboard + API

The Next.js app that serves the doctor's web dashboard and the API used by both apps.

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
