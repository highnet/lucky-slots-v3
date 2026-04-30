# Agent Instructions

## Monorepo Basics

- **Package manager**: pnpm 10.33.2 (locked in `packageManager`). Always use `pnpm`.
- **Workspace**: Turborepo + pnpm workspaces (`apps/*`, `packages/*`).
- **All packages** use `"type": "module"` (ESM only).

## Developer Commands

Run everything from the repo root via turbo:

```bash
pnpm lint          # ESLint all workspaces
pnpm typecheck     # tsc --noEmit (or nuxt typecheck for web)
pnpm test          # vitest run in all workspaces
pnpm build         # production build (api: tsc, web: nuxt build)
pnpm dev           # parallel dev servers
```

Run a single workspace:

```bash
pnpm --filter @lucky-slots/api dev
pnpm --filter @lucky-slots/web lint
pnpm --filter @lucky-slots/engine test
```

Other useful root scripts:

```bash
pnpm cli               # interactive slots CLI (tsx scripts/slots-cli.ts)
pnpm update-strips     # regenerate engine reel strips
```

API database commands (run in `@lucky-slots/api`):

```bash
pnpm --filter @lucky-slots/api db:push       # push schema (uses drizzle-kit)
pnpm --filter @lucky-slots/api db:generate   # generate migrations
pnpm --filter @lucky-slots/api db:migrate    # run migrations
```

## Dev Setup (Required Before First Run)

1. `pnpm install`
2. `docker compose up -d postgres redis` — **note: Redis maps to host port 6380, not 6379**
3. `cp apps/api/.env.example apps/api/.env`
4. `pnpm --filter @lucky-slots/api db:push`
5. Start API: `pnpm --filter @lucky-slots/api dev` (port 4000)
6. Start Web: `pnpm --filter @lucky-slots/web dev` (port 3000)

## Lint / Type / Build Verification Order

Always run in this order before considering changes done:

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- `lint` uses the root **flat config** `eslint.config.mjs` (ESLint 10 + typescript-eslint). No `.eslintrc` files anywhere.
- `typecheck` for web runs `nuxt typecheck`, not `tsc`.
- `build` only applies to `apps/api` (tsc → `dist/`) and `apps/web` (nuxt → `.output/`).

## TypeScript Config Quirks

- Shared configs live in `packages/ts-config/` (`base.json`, `nuxt.json`, `node.json`).
- **Critical**: `apps/web/tsconfig.json` must extend **both** `@lucky-slots/ts-config/nuxt.json` **and** `./.nuxt/tsconfig.json`:
  ```json
  { "extends": ["@lucky-slots/ts-config/nuxt.json", "./.nuxt/tsconfig.json"] }
  ```
  Without `.nuxt/tsconfig.json`, Nuxt auto-imports (`ref`, `computed`, `navigateTo`, etc.) and `~/` path aliases will fail type-checking.
- `apps/web/nuxt.config.ts` must have an explicit `NuxtConfig` type annotation on the export to avoid `TS2883`.

## Engine Package Quirks

- **`packages/engine/src/config.ts`** — `GRID_CONFIG` is the single source of truth for grid dimensions (rows, cols, stripSize, etc.).
- If you change `GRID_CONFIG`, you **must** regenerate reel strips:
  ```bash
  pnpm update-strips
  ```
- `packages/engine/src/validate.ts` runs at module load time and throws a fatal `EngineFatalError` if constants, thresholds, or reel strips are misaligned. This catches config drift immediately.
- The engine exports `GRAPHQL_EMOJIS` (string-keyed) for the frontend. GraphQL returns uppercase string symbol names (`"TEN"`, `"WILD"`), **not** the engine's numeric `Symbol` enum values.

## Nuxt Web Quirks

- Uses TresJS (Vue-native Three.js) for 3D rendering.
- `@lucky-slots/engine` and `@lucky-slots/state-machine` are explicitly `transpile`d in `nuxt.config.ts`.
- Heavy use of Nuxt/Pinia auto-imports. Do not add explicit imports for Vue composables or Nuxt utilities unless ESLint complains.

## API Quirks

- GraphQL Yoga with merged resolvers (`authResolvers`, `spinResolvers`).
- Loads env via `import 'dotenv/config'` — **requires** `apps/api/.env` to exist.
- Session ID is read from the `cookie` header (looks for `sessionId=`).

## What to Ignore

ESLint already ignores: `dist/`, `.output/`, `.nuxt/`, `node_modules/`, `pnpm-lock.yaml`, `drizzle/`.

## Architecture at a Glance

```
apps/
  api/          GraphQL Yoga + Drizzle ORM + Redis sessions
  web/          Nuxt 3 + TresJS + Pinia + Tailwind
packages/
  engine/       SpinEngine, PaylineEngine, PayoutEngine, RNG, RTP tools
  state-machine/ XState game flow machine
  ts-config/    Shared tsconfig presets
```

- `apps/api` and `apps/web` both depend on `packages/engine` via `workspace:*`.
- `apps/web` also depends on `packages/state-machine`.
- Engine is isomorphic but the **spin logic must stay server-side** for security.
