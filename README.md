# TensioCare — suivi de l'hypertension pendant la grossesse

Hackathon SolveX 3.0 · Problème 2. Produit : `idea.md`. Règles de code : la spec du projet (à lire en premier).

## Équipe et branches

| Personne | Partie | Dossier | Branche |
| --- | --- | --- | --- |
| Ramy (Rey) | Tableau de bord médecin + API + base + règles | `apps/web`, `packages/shared` | `ramy` |
| Yasser ([@yasser-zm](https://github.com/yasser-zm)) | Application patiente (Expo) | `apps/mobile` | `yasser` |
| Développeur IA/LLM (à venir) | Synthèse médecin, brouillon de conseil, assistant | `apps/web/src/lib/llm` | à créer |

`main` reste toujours démontrable : on y fusionne par pull request depuis `ramy` / `yasser`.

## Structure

```
apps/web/         Next.js : tableau de bord médecin + API (utilisée par les deux apps) + Prisma
apps/mobile/      Expo : application patiente
packages/shared/  règles (risque, alertes) + schémas Zod partagés, avec tests
docs/archive/     ancien projet hypertension (référence uniquement)
```

## Commandes

```bash
corepack enable          # une fois : active pnpm (version fixée dans package.json)
pnpm install
pnpm dev:web             # http://localhost:3000
pnpm dev:mobile          # Expo, ouvrir avec Expo Go
pnpm --filter shared test
pnpm check               # typecheck + lint + tests de tout le dépôt
```

> `apps/web` contient encore le prototype hypertension (même architecture) ; il est en cours
> d'adaptation à la grossesse selon la spec du projet.
