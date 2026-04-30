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

## Project Structure

```
lucky-slots-web/
├── apps/
│   ├── web/          # Nuxt 3 frontend
│   └── api/          # GraphQL API server
├── packages/
│   ├── engine/       # Core slot logic (SpinEngine, PaylineEngine, PayoutEngine)
│   ├── state-machine/# XState game machine
│   └── ts-config/    # Shared TypeScript configs
├── docker-compose.yml
└── turbo.json
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

### 3. Run database migrations

```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter @lucky-slots/api db:push
```

### 4. Start dev servers

```bash
# API
pnpm --filter @lucky-slots/api dev

# Web (in another terminal)
pnpm --filter @lucky-slots/web dev
```

Open http://localhost:3000 for the game and http://localhost:4000/graphql for the API playground.

## Unity Port Details

### Engine (packages/engine)

- **SpinEngine**: Generates 4x5 grids using cryptographically secure RNG with exact Unity thresholds
- **PaylineEngine**: Precomputes all DFS paths from the original 20-vertex adjacency graph
- **PayoutEngine**: Matches paths, filters dirty subpaths, and applies exact multiplier table

All engine logic is covered by Vitest unit tests.

### State Machine (packages/state-machine)

XState machine replicates the Unity Animator flow:

```
idle → spinning → landing → (showingPaylines → showingWinners → showingWinnings) → resetting → idle
```

### API (apps/api)

GraphQL endpoints:
- `register`, `login`, `logout`, `me`
- `spin` (server-authoritative)
- `setBet`, `cycleBet`
- `mySpins`, `leaderboard`
- `leaderboardUpdated` subscription

### Web (apps/web)

- TresJS 3D canvas with emoji symbol overlay
- Pinia stores for auth and game state
- Tailwind UI overlay

## Testing

```bash
# Engine tests
pnpm --filter @lucky-slots/engine test

# API tests (when added)
pnpm --filter @lucky-slots/api test
```

## Docker

```bash
docker compose up --build
```

## License

Private
