# Lucky Slots Web

A provably fair online slot machine engine. V3 rewrite with a focus on clean architecture, modularity, and developer experience. The core engine is implemented in TypeScript and shared between the frontend (Nuxt 3) and backend (Node 22 + GraphQL Yoga). The system includes a Monte Carlo RTP simulator and reverse optimizer for tuning payout rates.

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Nuxt 3 + Pinia + Tailwind CSS + responsive CSS-grid reels
- **Backend**: Node 22 + GraphQL Yoga + Drizzle ORM
- **Database**: PostgreSQL
- **Cache/Sessions**: Redis
- **Auth**: Argon2id + HTTP-only cookies + Redis sessions
- **Engine**: Isomorphic TypeScript with provably fair HMAC-SHA256 RNG
- **State Machine**: XState
- **Linting**: ESLint 10 + typescript-eslint (flat config)

## Provably Fair System

Every spin outcome is cryptographically verifiable:

1. **Commitment**: Before each spin, the server generates a `serverSeed` and sends `serverHash = SHA256(serverSeed)` to the client.
2. **Deterministic outcome**: The spin uses `HMAC_SHA256(serverSeed, clientSeed + "|" + nonce + "|" + counter)` for each grid cell.
3. **Reveal**: After the spin, the server reveals `serverSeed`.
4. **Verification**: Any client can re-run the same HMAC computation to prove the outcome was not manipulated.

- `clientSeed`: Fixed per user, generated on registration, never rotates.
- `nonce`: Global per-user counter, increments on every spin.
- `serverSeed`: 32-byte cryptographically random hex, unique per spin.

### GraphQL Endpoints

- `nextCommitment`: Returns the upcoming spin's `serverHash`, `clientSeed`, and `nonce`.
- `spin`: Executes the spin, reveals `serverSeed`, returns next commitment.
- `verifySpin(id)`: Re-runs the spin with stored seeds and reports match/mismatch.

## RTP Engine

The engine includes a Monte Carlo simulator and reverse optimizer for tuning payout rates.

### RTPSimulator

Runs N simulated spins and reports:
- Overall RTP percentage
- Hit frequency
- Average multiplier
- Per-symbol RTP contribution
- Variance / volatility
- 95% confidence interval

### RTPBalancer

Reverse Monte Carlo optimizer that adjusts both **symbol probabilities** (reel thresholds) and **payout multipliers** to hit a target RTP.

**Algorithm**: Greedy coordinate descent with bounded random restarts.
- Each iteration tests a small perturbation on one parameter.
- Measures RTP delta via fast 10K-spin simulation.
- Commits the change if it moves closer to target.
- Supports any M×N grid size.

**Usage via CLI**:
```bash
pnpm cli
# → Select "Analyze RTP" or "Balance RTP"
```

## Project Structure

```
lucky-slots-web/
├── apps/
│   ├── web/          # Nuxt 3 frontend (port 3000)
│   └── api/          # GraphQL API server (port 4000)
├── packages/
│   ├── engine/       # Core slot logic + provably fair + RTP
│   ├── state-machine/# XState game machine
│   └── ts-config/    # Shared TypeScript configs
├── scripts/
│   └── slots-cli.ts  # Interactive TUI for engine management
├── eslint.config.mjs # Root ESLint flat config
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Engine Package (`packages/engine`)

| Module | Purpose |
|--------|---------|
| `SpinEngine.ts` | Generates N×M grids from RNG |
| `PaylineEngine.ts` | Precomputes all valid DFS paths |
| `PayoutEngine.ts` | Matches paths, filters dirty subpaths, sums multipliers |
| `ProvablyFairRng.ts` | HMAC-SHA256 deterministic entropy |
| `RTPSimulator.ts` | Monte Carlo analysis |
| `RTPBalancer.ts` | Reverse Monte Carlo optimizer |
| `validate.ts` | Critical safety checks at module load |
| `config.ts` | Grid dimensions (rows, cols, minMatch, etc.) |
| `constants.ts` | Thresholds, multipliers, reel strips |

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
pnpm cli           # Interactive TUI (RTP, config, strips, dev)
pnpm update-strips # Regenerate engine reel strips
```

### Interactive CLI (TUI)

```bash
pnpm cli
```

Menu options:
- **Show Config** — Display current grid dimensions
- **Update Config** — Change rows, cols, minMatch, etc. (auto-regenerates strips)
- **Regenerate Strips** — Rebuild reel strips from current config
- **Analyze RTP** — Run Monte Carlo simulation with configurable spin count
- **Balance RTP** — Run reverse Monte Carlo optimizer toward a target RTP
- **Run Migrations** — Push Drizzle schema to Postgres
- **Build All** — TypeScript build of all packages
- **Start Dev** — Launch API + Web dev servers
- **Full Setup** — Strips → Migrations → Build

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

## GraphQL Schema

```graphql
type Query {
  me: User
  mySpins(limit: Int = 20, offset: Int = 0): [SpinResult!]!
  leaderboard: [LeaderboardEntry!]!
  reelStrips: [[Symbol!]!]!
  gridConfig: GridConfig!
  nextCommitment: Commitment!
  verifySpin(id: ID!): VerificationResult!
}

type Mutation {
  register(username: String!, password: String!): User!
  login(username: String!, password: String!): User!
  logout: Boolean!
  setBet(amount: Float!): User!
  cycleBet: User!
  spin: SpinResult!
}
```

### SpinResult (Provably Fair Fields)

```graphql
type SpinResult {
  id: ID!
  symbols: [[Symbol!]!]!
  winningPaths: [PaylinePath!]!
  multiplier: Float!
  winnings: Float!
  bet: Float!
  newBalance: Float!
  timestamp: String!
  serverSeed: String!      # Revealed after spin
  serverHash: String!      # Pre-spin commitment
  clientSeed: String!      # Fixed per user
  nonce: Int!              # Global per-user counter
  nextServerHash: String!  # Commitment for next spin
  nextNonce: Int!          # Next nonce
}
```

## Docker Compose

```bash
# Full stack (web + api + postgres + redis)
docker compose up --build

# Infrastructure only
docker compose up -d postgres redis
```

## License

Private
