# Lucky Slots Web

A provably fair online slot machine engine. V3 rewrite with a focus on clean architecture, modularity, and developer experience. The core engine is implemented in TypeScript and shared between the frontend (Nuxt 3) and backend (Node 22 + GraphQL Yoga). The system includes a Monte Carlo RTP simulator, a two-phase stochastic reel optimizer, and a cryptographically verifiable spin system.

## Architecture

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Nuxt 3 + Pinia + Tailwind CSS + TresJS 3D rendering
- **Backend**: Node 22 + GraphQL Yoga + Drizzle ORM
- **Database**: PostgreSQL
- **Cache/Sessions**: Redis
- **Auth**: Argon2id + HTTP-only cookies + Redis sessions
- **Engine**: Isomorphic TypeScript with provably fair HMAC-SHA256 RNG
- **State Machine**: XState
- **Linting**: ESLint 10 + typescript-eslint (flat config)

---

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

---

## Engine Package (`packages/engine`)

The engine is the heart of the system. It is **isomorphic** (runs in both browser and Node) but the **spin logic is designed to stay server-side** for security.

### Physical Reel Strip System

Unlike traditional slot engines that use probability tables or CDF thresholds, this engine uses **physical reel strips** — ordered arrays of symbol names that the RNG samples from directly.

- Each reel is a `string[]` strip of configurable size (default 100 symbols)
- A spin picks a random offset into each strip and reads the next N symbols vertically
- Strips wrap around, so any offset is valid
- This makes the math transparent and the optimizer's job precise

### Wildcard System

Wild symbols (`🃏`) are expanded greedily during payout calculation:

1. After the grid is generated, every Wild is conceptually replaced by each payline symbol in turn
2. The PayoutEngine tests each substitution independently (highest-value symbol first)
3. Once a Wild is "spent" by a winning path, it cannot be reused by a lower-value match
4. This gives Wilds their true power: they complete the best possible payline, not just any payline

### Payline Engine — DFS Path Generation

The engine dynamically generates **all valid left-to-right paths** through an N×M grid using depth-first search:

- Each step moves to the next column, at most one row up or down
- Paths must be at least `minMatch` cells long to count as a match
- All paths are precomputed once per grid size and cached
- Works for **any** M×N grid without code changes — just update `GRID_CONFIG`

### Payout Engine — BigInt Bitmask Dirty-Path Filtering

The PayoutEngine uses **BigInt bitmasks** for O(1) path containment checks:

- Each cell gets a bit position = `row × cols + col`
- A path's mask = OR of all its cell bits
- A 4-match fully contained inside a 5-match is automatically filtered out ("dirty subpath")
- Wilds already "spent" by a higher-value match are excluded from lower-value checks
- Multipliers are summed from the remaining clean paths

### Auto-Repairing Multiplier System

The multiplier table is **self-healing** — it never breaks when you change grid sizes:

- Hardcoded multipliers cover common combinations (e.g. `4 Ace`, `5 Ten`)
- Missing values are auto-computed via:
  - **Extrapolation**: `value × 4^(steps)` upward or `value ÷ 4^(steps)` downward
  - **Interpolation**: Linear interpolation between two known values
- If a symbol has no data at all, it falls back to a safe `0.1` default
- Auto-generated keys are tracked and can be logged for game-designer review

### Two-Phase ReelOptimizer (Simulated Annealing)

A constrained stochastic optimizer that designs both **reel-strip layouts** and **payout multipliers** to hit a target RTP **and** a target hit-rate.

**Phase 1 — Strip Layout Optimization**
- Redistributes symbols unevenly across reels to lower cross-reel match probability
- Uses three move operators:
  - `redistributeSymbol`: Moves up to 35 occurrences of a symbol from the reel with the most to the reel with the least
  - `moveSymbolBetweenReels`: Swaps one symbol occurrence between two reels
  - `antiClusterSwap`: Breaks up within-reel runs of identical symbols
- Simulated annealing accepts worse states early (high temperature) and converges to better layouts

**Phase 2 — Multiplier Scaling**
- Scales multipliers up or down to hit the exact RTP target
- Uses two move operators:
  - `global`: Scales **all** multipliers by a common factor (fast, large jumps)
  - `local`: Tweaks one multiplier at a time (fine-grained refinement)
- Preserves the hit-rate achieved in Phase 1

**Usage**:
```bash
# Environment variables or CLI prompts
TARGET_RTP=95 TARGET_HITRATE=0.20 OPT_ITERATIONS=300 \
  pnpm --filter @lucky-slots/engine optimize-strips
```

### RTPSimulator — Monte Carlo Analysis

Runs millions of simulated spins in seconds using the fast **Mulberry32** PRNG:

- Overall RTP percentage
- Hit frequency (fraction of winning spins)
- Average multiplier per spin
- Maximum multiplier observed
- Per-symbol RTP contribution breakdown
- Variance / volatility estimate
- 95% confidence interval

### Runtime Safety Validation

`validate.ts` runs **automatically on every module import** and throws a fatal `EngineFatalError` if anything is misconfigured:

- Grid dimensions are within safe bounds (≤ 200 cells)
- `minMatch` ≤ number of reels
- Strip size ≥ number of rows
- All reel strips contain only valid symbol names
- Reel strip count matches `cols`
- Reel strip length matches `stripSize`
- Multiplier keys are well-formed (`{size} {SymbolName}`)
- All valid (size, symbol) combinations can be resolved by the auto-repair system
- Bet amounts are strictly ascending and positive
- Default balance and bet are valid

This means a config error crashes the app **immediately on startup**, not after 10,000 spins in production.

### Grid Configuration — Single Source of Truth

All dimensions live in one file (`config.ts`). Change `rows`, `cols`, `minMatch`, `stripSize`, etc., then regenerate strips — the entire engine adapts without touching business logic.

```typescript
export const GRID_CONFIG = {
  rows: 4,        // Vertical cells per reel
  cols: 4,        // Number of reels
  minMatch: 4,    // Minimum contiguous symbols for a payline
  stripSize: 100, // Symbols per physical reel strip
  numSymbols: 6,  // Ten, Jack, Queen, King, Ace, Wild
  paylineSymbols: 5, // Ten through Ace (Wild is special)
} as const;
```

After changing `GRID_CONFIG`:
```bash
pnpm update-strips        # Regenerate random strips from base distribution
pnpm optimize-strips      # Or run the full optimizer for target RTP/hit-rate
```

### Legacy Database Compatibility

Old spin records in the database may contain symbol indices from removed symbols (e.g., Bonus/Blank). The API resolvers gracefully fall back to `'TEN'` for any out-of-bounds or unknown symbol index, so historical data never crashes the frontend.

---

## Engine Module Reference

| Module | Purpose |
|--------|---------|
| `SpinEngine.ts` | Generates N×M grids by sampling physical reel strips |
| `PaylineEngine.ts` | Precomputes all valid DFS paths for the current grid size |
| `PayoutEngine.ts` | Matches paths, filters dirty subpaths with BigInt bitmasks, sums multipliers |
| `ProvablyFairRng.ts` | HMAC-SHA256 deterministic entropy with commitment scheme |
| `RTPSimulator.ts` | Monte Carlo RTP/hit-rate/volatility analysis |
| `ReelOptimizer.ts` | Two-phase simulated annealing for strip layout + multiplier scaling |
| `validate.ts` | Critical safety checks at module load time |
| `config.ts` | Grid dimensions (rows, cols, minMatch, stripSize, etc.) |
| `constants.ts` | Reel strips, multipliers, bet amounts, auto-repair system |
| `types.ts` | Symbol enum, SpinResult, PaylinePath, PayoutResult, GraphQL mappings |

---

## RTP Engine

### Analyzing Current Balance

```bash
pnpm cli
# → Select "Analyze RTP"
# → Enter number of spins (default 100,000)
```

### Optimizing for Target RTP and Hit-Rate

```bash
pnpm cli
# → Select "Optimize Strips"
# → Enter target RTP % (default 95)
# → Enter target hit-rate % (default 20)
# → Enter iterations (default 300)
```

Or run directly:
```bash
TARGET_RTP=95 TARGET_HITRATE=0.20 OPT_ITERATIONS=300 \
  WRITE_CONSTANTS=1 pnpm --filter @lucky-slots/engine optimize-strips
```

The optimizer will:
1. Run Phase 1 to create asymmetric reel distributions that lower hit-rate
2. Run Phase 2 to scale multipliers until RTP hits the target
3. Write the optimized strips and multipliers back to `constants.ts`

---

## Project Structure

```
lucky-slots-web/
├── apps/
│   ├── web/          # Nuxt 3 frontend (port 3000)
│   └── api/          # GraphQL API server (port 4000)
├── packages/
│   ├── engine/       # Core slot logic + provably fair + RTP + optimizer
│   ├── state-machine/# XState game machine
│   └── ts-config/    # Shared TypeScript configs
├── scripts/
│   └── slots-cli.ts  # Interactive TUI for engine management
├── eslint.config.mjs # Root ESLint flat config
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

---

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

---

## Available Scripts

### Root

```bash
pnpm dev           # Start all dev servers via turbo
pnpm build         # Build all apps/packages via turbo
pnpm lint          # Lint all workspaces via turbo
pnpm test          # Run tests in all workspaces via turbo
pnpm typecheck     # Type-check all workspaces via turbo
pnpm cli           # Interactive TUI (RTP, config, strips, dev)
pnpm update-strips # Regenerate engine reel strips from base distribution
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
- **Optimize Strips** — Run two-phase simulated annealing optimizer toward target RTP/hit-rate
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
pnpm --filter @lucky-slots/engine optimize-strips
```

---

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

---

## Docker Compose

```bash
# Full stack (web + api + postgres + redis)
docker compose up --build

# Infrastructure only
docker compose up -d postgres redis
```

## License

Private
