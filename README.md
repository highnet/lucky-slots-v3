# Lucky Slots Web

Migrated from Unity (v2) to a modern web stack.

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Nuxt 3 + TresJS + Pinia + Tailwind CSS
- **Backend**: Node 22 + GraphQL Yoga + Drizzle ORM
- **Database**: PostgreSQL
- **Cache/Sessions**: Redis
- **Auth**: Argon2id + HTTP-only cookies + Redis sessions
- **Engine**: Isomorphic TypeScript (ported from Unity C#)
- **State Machine**: XState
- **Linting**: ESLint 10 + typescript-eslint (flat config)

## Project Structure

```
lucky-slots-web/
├── apps/
│   ├── web/          # Nuxt 3 frontend (port 3000)
│   └── api/          # GraphQL API server (port 4000)
├── packages/
│   ├── engine/       # Core slot logic (SpinEngine, PaylineEngine, PayoutEngine)
│   ├── state-machine/# XState game machine
│   └── ts-config/    # Shared TypeScript configs
├── scripts/
│   └── slots-cli.ts  # Interactive CLI for local slot simulation
├── eslint.config.mjs # Root ESLint flat config
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm
- Docker & Docker Compose (optional, for Postgres/Redis)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure (Postgres + Redis)

```bash
docker compose up -d postgres redis
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

The example env assumes local Docker defaults:

```
DATABASE_URL=postgresql://slots:slots@localhost:5432/lucky_slots
REDIS_HOST=localhost
REDIS_PORT=6380
PORT=4000
```

### 4. Push database schema

```bash
pnpm --filter @lucky-slots/api db:push
```

### 5. Start dev servers

```bash
# API
pnpm --filter @lucky-slots/api dev

# Web (in another terminal)
pnpm --filter @lucky-slots/web dev
```

Open http://localhost:3000 for the game and http://localhost:4000/graphql for the API playground.

## Available Scripts

### Root

```bash
pnpm dev           # Start all dev servers via turbo
pnpm build         # Build all apps/packages via turbo
pnpm lint          # Lint all workspaces via turbo
pnpm test          # Run tests in all workspaces via turbo
pnpm typecheck     # Type-check all workspaces via turbo
pnpm cli           # Interactive slots CLI (tsx scripts/slots-cli.ts)
pnpm update-strips # Regenerate engine reel strips
```

### API

```bash
pnpm --filter @lucky-slots/api dev
pnpm --filter @lucky-slots/api build
pnpm --filter @lucky-slots/api lint
pnpm --filter @lucky-slots/api test
pnpm --filter @lucky-slots/api typecheck
pnpm --filter @lucky-slots/api db:push
pnpm --filter @lucky-slots/api db:generate
pnpm --filter @lucky-slots/api db:migrate
```

### Web

```bash
pnpm --filter @lucky-slots/web dev
pnpm --filter @lucky-slots/web build
pnpm --filter @lucky-slots/web lint
pnpm --filter @lucky-slots/web typecheck
```

### Engine

```bash
pnpm --filter @lucky-slots/engine test
pnpm --filter @lucky-slots/engine lint
pnpm --filter @lucky-slots/engine typecheck
pnpm --filter @lucky-slots/engine update-strips
```

### State Machine

```bash
pnpm --filter @lucky-slots/state-machine test
pnpm --filter @lucky-slots/state-machine lint
pnpm --filter @lucky-slots/state-machine typecheck
```

## Unity Port Details

### Engine (`packages/engine`)

- **SpinEngine**: Generates 4x5 grids using cryptographically secure RNG with exact Unity thresholds
- **PaylineEngine**: Precomputes all DFS paths from the original 20-vertex adjacency graph
- **PayoutEngine**: Matches paths, filters dirty subpaths, and applies exact multiplier table

All engine logic is covered by Vitest unit tests.

### State Machine (`packages/state-machine`)

XState machine replicates the Unity Animator flow:

```
idle -> spinning -> landing -> (showingPaylines -> showingWinners -> showingWinnings) -> resetting -> idle
```

### API (`apps/api`)

GraphQL endpoints:

- Auth: `register`, `login`, `logout`, `me`
- Game: `spin` (server-authoritative), `setBet`, `cycleBet`
- History: `mySpins`
- Leaderboard: `leaderboard`
- Subscription: `leaderboardUpdated`

### Web (`apps/web`)

- TresJS 3D canvas with emoji symbol overlay
- Pinia stores for auth and game state
- Tailwind CSS UI overlay

## Docker Compose

```bash
# Full stack (web + api + postgres + redis)
docker compose up --build

# Infrastructure only
docker compose up -d postgres redis
```

## License

Private
