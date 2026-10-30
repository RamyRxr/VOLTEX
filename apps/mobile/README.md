# apps/mobile — patient app (Expo)

Owner: **Yasser** (branch `yasser`). Read the project spec (§4.1, §8, §11) and `../../idea.md` first.

## Start the app here

```bash
# from the repo root
cd apps/mobile
npx create-expo-app@latest . --template tabs   # Expo Router + TypeScript
```

Then in `apps/mobile/package.json`:
- set `"name": "mobile"` (so `pnpm --filter mobile start` works);
- add `"shared": "workspace:*"` to `dependencies` (rules + API schemas from `packages/shared`);
- add scripts `"typecheck": "tsc --noEmit"` and `"lint": "expo lint"`.

Run `pnpm install` from the repo root (never `npm install` here: the repo uses pnpm workspaces,
and `.npmrc` sets `node-linker=hoisted` for React Native).

## Using `packages/shared` from Expo

Create `metro.config.js` (spec §5 "Monorepo + Expo"):

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
```

If this takes more than 30 minutes to work, stop and ask: the fallback is copying `packages/shared/src`.

## Rules that matter for the mobile side

- All writes (profile, readings, questionnaires, doctor code) go through the **web API**
  (`EXPO_PUBLIC_API_URL`) with `Authorization: Bearer <supabase access token>`.
  Only the **chat** talks to Supabase directly (Realtime).
- Never re-implement risk or alert rules: display what the API returns (`evaluation`, `risk`).
- French text through `src/i18n/fr.ts`; status = icon + colour + word; touch targets ≥ 44 px.
- Copy `.env.example` to `.env`; never commit `.env`.
