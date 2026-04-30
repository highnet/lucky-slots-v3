# Lucky Slots v2 — Unity to Web Migration Plan

## Executive Summary

Port the Unity slot machine architecture to a modern web stack, preserving:
- **Core algorithms** (weighted RNG, DFS payline graph, payout multipliers, wild replacement)
- **State machine** (game phases: AwaitBet → HandleBet → GenerateSpin → SpawnFake → SpawnReal → LandReal → CalculatePayout → AnimatePaylines → AnimateWinningSymbols → AnimateWinnings → Reset → back to AwaitBet)
- **Logic** (bet cycling, balance management, payline reset, symbol reset, winning text reset)

This is **not** a line-by-line port. It is a conceptual re-architecture for the browser using modern web rendering, state management, and backend services.

---

## 1. Tech Stack (Locked In)

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo |
| Frontend | Nuxt 3, TypeScript, Tailwind CSS, Pinia |
| 3D Engine | TresJS + `@tresjs/drei` |
| Tweening | `@tresjs/cientos` (animations), GSAP (fallback) |
| State Machine | XState (isomorphic, runs client-side for UI flow) |
| Backend API | Node 20 / Bun, GraphQL Yoga, Pothos (Code-first schema) |
| Database | PostgreSQL (player data, spin history) |
| ORM | Drizzle ORM |
| Cache / Sessions | Redis |
| Auth | Argon2id password hashing, HTTP-only session cookies |
| Symbols | Emoji characters (no 3D assets needed) |
| Testing | Vitest (unit), Playwright (E2E) |
| Containerization | Docker + Docker Compose |

### Why Nuxt + TresJS over Next.js + R3F
- The user explicitly wants Vue/Nuxt and Pinia.
- TresJS is the idiomatic Vue-native declarative Three.js renderer (inspired by R3F).
- No React/Vue interop pain. State flows cleanly through Pinia.

---

## 2. Unity → Web Architecture Mapping

| Unity Concept | Web Equivalent | Implementation |
|---------------|----------------|----------------|
| `Animator` State Machine | XState Machine | Declarative state charts with entry/exit actions, guards, delayed transitions. Mirrors Unity's `OnStateEnter`, transition conditions, and coroutine waits exactly. |
| `StateMachineBehaviour` (OnStateEnter) | XState `entry` actions | E.g., `SpawnFakeSymbols` state `entry` triggers fake symbol animation coroutine logic. |
| `GameObject.FindGameObjectWithTag` | ES Module imports / Dependency Injection | No runtime lookup. Import stores/engine instances directly. |
| `MonoBehaviour` (Update loops) | TresJS `useRenderLoop` | Per-frame updates for falling fake symbols, continuous animations. |
| `DOTween` | TresJS animation helpers / GSAP | Declarative spring/tween animations for symbol landing, UI elements. |
| `GameSymbolPool` (Object Pooling) | VDOM recycling / InstancedMesh | In TresJS, reuse `<TresMesh>` instances. For emojis, lightweight HTML overlay recycling via `<Html>` from Drei. |
| `SymbolSpawner` (Coroutines) | Async generators / Promise chains | `async function* spawnRealSymbols()` with `await delay(ms)` between reels. |
| `SpinDatum` / `GenerateRoll` | `SpinEngine` | Pure TypeScript class. **Server-side only** for security. |
| `PaylinePathGenerator` + `PayoutCalculator` | `PaylineEngine` + `PayoutEngine` | Pure TypeScript. Precompute all paths at build time. Runs server-side for validation. |
| `Player` + `BetHandler` | Pinia Store + GraphQL API | Pinia for reactive UI state. GraphQL mutations for server-authoritative actions. |
| `UI` (TMP/Text/Button) | Tailwind DOM Overlay | HTML overlaid on the `<TresCanvas>` using `position: absolute`. |

---

## 3. Symbol Mapping (Emoji)

| Unity Symbol | Emoji | Notes |
|--------------|-------|-------|
| `Ten` | 🔟 | Number 10 |
| `Jack` | 👦 | Thematic face card |
| `Queen` | 👸 | Thematic face card |
| `King` | 👑 | Thematic face card |
| `Ace` | 🅰️ | Letter A |
| `Wild` | 🃏 | Joker wild card |
| `Bonus` | 🎁 | Ignored for now (no bonus mechanics) |

Emojis are rendered via `<Html>` from `@tresjs/drei`, positioned slightly above each grid cell's 3D geometry. This avoids texture loading, asset pipelines, and font rendering issues in WebGL.

---

## 4. Project Structure

```
lucky-slots-web/
├── apps/
│   ├── web/                    # Nuxt 3 application
│   │   ├── components/
│   │   │   ├── canvas/         # TresJS 3D components
│   │   │   │   ├── SlotMachine.vue
│   │   │   │   ├── Reel.vue
│   │   │   │   ├── SymbolCell.vue
│   │   │   │   ├── PaylineEffect.vue
│   │   │   │   └── Scene.vue
│   │   │   ├── ui/             # Tailwind DOM overlay components
│   │   │   │   ├── BalanceDisplay.vue
│   │   │   │   ├── BetDisplay.vue
│   │   │   │   ├── SpinButton.vue
│   │   │   │   ├── ChangeBetButton.vue
│   │   │   │   ├── WinningModal.vue
│   │   │   │   ├── AuthForm.vue
│   │   │   │   └── Leaderboard.vue
│   │   │   └── providers/
│   │   ├── composables/        # Vue composables (useGameState, useAuth)
│   │   ├── stores/             # Pinia stores
│   │   ├── pages/              # Nuxt file-based routing
│   │   ├── layouts/
│   │   ├── public/             # Static assets
│   │   └── server/             # Nuxt server routes (if any proxy needs)
│   │
│   └── api/                    # GraphQL API server
│       ├── src/
│       │   ├── schema/         # Pothos schema definitions
│       │   ├── resolvers/      # Query & mutation resolvers
│       │   ├── services/       # Business logic (SpinService, PlayerService)
│       │   ├── datasources/    # Drizzle ORM, Redis client
│       │   ├── lib/            # Argon2id, session helpers
│       │   └── index.ts        # Yoga server entry
│       └── Dockerfile
│
├── packages/
│   ├── engine/                 # Isomorphic core logic
│   │   ├── src/
│   │   │   ├── SpinEngine.ts
│   │   │   ├── PaylineEngine.ts
│   │   │   ├── PayoutEngine.ts
│   │   │   ├── types.ts        # Symbol enum, SpinDatum, etc.
│   │   │   └── constants.ts    # Grid size, thresholds, multipliers
│   │   └── package.json
│   │
│   ├── state-machine/          # XState game machine
│   │   └── src/
│   │       └── gameMachine.ts
│   │
│   └── ts-config/              # Shared TypeScript configurations
│       ├── base.json
│       ├── nuxt.json
│       └── node.json
│
├── docker-compose.yml
├── turbo.json
└── README.md
```

---

## 5. Database Schema (PostgreSQL)

```sql
-- Users table with Argon2id password hashes
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 1000.00,
    current_bet DECIMAL(12, 2) NOT NULL DEFAULT 0.10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log of every spin (server-authoritative)
CREATE TABLE spins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbols JSONB NOT NULL,               -- 4x5 grid as JSON array
    bet DECIMAL(12, 2) NOT NULL,
    multiplier DECIMAL(12, 4) NOT NULL,
    winnings DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spins_user_created ON spins(user_id, created_at DESC);
```

---

## 6. GraphQL Schema (Draft)

```graphql
type User {
  id: ID!
  username: String!
  balance: Float!
  currentBet: Float!
}

type SpinResult {
  id: ID!
  symbols: [[Symbol!]!]!         # 4x5 grid
  winningPaths: [PaylinePath!]!
  multiplier: Float!
  winnings: Float!
  bet: Float!
  newBalance: Float!
  timestamp: String!
}

type PaylinePath {
  symbol: Symbol!
  size: Int!                     # 3, 4, or 5
  coordinates: [Coordinate!]!
}

type Coordinate {
  row: Int!
  col: Int!
}

type LeaderboardEntry {
  username: String!
  balance: Float!
  rank: Int!
}

enum Symbol {
  TEN
  JACK
  QUEEN
  KING
  ACE
  WILD
  BONUS
}

type Query {
  me: User                        # Returns null if not authenticated
  mySpins(limit: Int = 20, offset: Int = 0): [SpinResult!]!
  leaderboard: [LeaderboardEntry!]!
}

type Mutation {
  register(username: String!, password: String!): User!
  login(username: String!, password: String!): User!
  logout: Boolean!
  setBet(amount: Float!): User!
  cycleBet: User!                 # .1 -> .5 -> 1 -> ... -> 1000 -> .1
  spin: SpinResult!               # Server-authoritative
}

type Subscription {
  leaderboardUpdated: [LeaderboardEntry!]!
}
```

---

## 7. Authentication Design

### Registration Flow
1. Client calls `register(username, password)`.
2. Server validates username uniqueness (case-insensitive).
3. Server hashes password with **Argon2id** (memory-hard, resistant to GPU cracking).
4. Server creates user row with default balance `1000.00` and bet `0.10`.
5. Server creates session in Redis with TTL (e.g., 7 days).
6. Server sets **HTTP-only, Secure, SameSite=Strict** session cookie.
7. Returns `User` object (excluding password hash).

### Login Flow
1. Client calls `login(username, password)`.
2. Server fetches user by username.
3. Server verifies password with Argon2id.
4. Server creates session in Redis, sets cookie.
5. Returns `User` object.

### Session Verification
1. Every GraphQL request carries the session cookie automatically.
2. Yoga context middleware reads cookie → looks up session ID in Redis → fetches `User` → injects into resolver context.
3. If session invalid/expired, `me` returns null; mutations throw `UNAUTHENTICATED`.

### Logout Flow
1. Client calls `logout`.
2. Server deletes session from Redis.
3. Server clears the cookie.

### Security Considerations
- **Never store JWT in localStorage** — XSS would steal tokens.
- **HTTP-only cookies** prevent JavaScript access to session IDs.
- **Rate limiting** on `login` and `register` (Redis `INCR` with expiry) to prevent brute force.
- **Password requirements**: Minimum 8 characters, at least one letter and one number (enforced server-side).

---

## 8. Redis Usage

| Use Case | Data Structure | Reason |
|----------|---------------|--------|
| Session Store | Key-Value (`sess:<id>` → JSON user data) | Fast lookups, automatic TTL expiry |
| Rate Limiting | `INCR` with `EXPIRE` | Prevent brute force on auth, spin spam |
| Leaderboard | `SORTED SET` (`ZADD` / `ZRANGE`) | O(log N) insert/rank queries |
| Game Config Cache | `STRING` (JSON) | Payline paths, multipliers (rarely change) |
| Spin Result Cache | `HASH` | Optional caching of recent spins for replay |

---

## 9. Phase-by-Phase Implementation

### Phase 0: Foundation
1. Initialize Turborepo monorepo with `apps/web`, `apps/api`, `packages/engine`, `packages/state-machine`, `packages/ts-config`.
2. Configure shared TypeScript configs.
3. Set up `docker-compose.yml` with `postgres`, `redis`, and placeholder services.
4. Configure ESLint, Prettier, and Vitest across packages.

### Phase 1: Auth & API Skeleton
1. Initialize Drizzle ORM with PostgreSQL connection.
2. Write migration for `users` and `spins` tables.
3. Implement Argon2id password hashing utilities in `apps/api/src/lib/`.
4. Set up Redis client (ioredis or redis npm package).
5. Initialize GraphQL Yoga with Pothos schema builder.
6. Implement `register`, `login`, `logout`, `me` resolvers.
7. Write session middleware: cookie parsing → Redis lookup → context injection.
8. Unit test auth flows with Vitest.

### Phase 2: Core Engine (`packages/engine`)
This is the highest-risk phase. The math must be identical to Unity.

#### 2.1 Types & Constants
- Port `Symbol` enum: `{ Ten, Jack, Queen, King, Ace, Wild, Bonus }`
- Port `SlotsAttributes`: 4 rows, 5 reels, 7 symbols.
- Port RNG thresholds exactly: `Ten=450, Jack=550, Queen=750, King=880, Ace=970, Wild=990, Bonus=999`.

#### 2.2 SpinEngine (`SpinDatum` port)
- `generateRoll(): Symbol[][]`
- `replaceWilds(symbols): Symbol[][][]` (generates 5 arrays, one per possible wild substitution)
- **RNG**: Use `crypto.getRandomValues` for cryptographically secure randomness on the server.
- **Security**: `generateRoll` runs **exclusively** in `apps/api`. The client never generates outcomes.

#### 2.3 PaylineEngine (`PaylinePathGenerator` port)
- Port the `Graph` class with DFS path generation.
- Port the 20-vertex adjacency list.
- Port the `GeneratePaths` calls.
- Port `slotsMapping` (int → grid coordinate).
- **Optimization**: Precompute all paths at build time and ship as JSON to eliminate runtime DFS in the browser.

#### 2.4 PayoutEngine (`PayoutCalculator` port)
- `calculatePayout(spinDatum, bet, paths): { winnings, multiplier, winningPaths }`
- Port exact logic:
  1. Iterate symbols (Ten → Ace).
  2. Check all paths against `spinnedSymbolsReplacedWilds[symbolID]`.
  3. Categorize into size-5, size-4, size-3 matches.
  4. Filter "dirty" subpaths (e.g., 4-match fully contained in a 5-match).
  5. Sum multipliers from the exact `switch` table.
  6. Return `bet * multiplier`.
- **Unit Tests**: Exhaustive tests. Every threshold, every path overlap case, every multiplier. Run 10k deterministic seeds and compare distribution.

### Phase 3: Spin API Endpoint
1. Implement `spin` mutation resolver:
   - Authenticate user (session from Redis).
   - Rate-limit check (Redis).
   - Fetch player from Postgres. Validate `bet <= balance`.
   - Deduct balance in transaction.
   - Run `SpinEngine.generateRoll()` server-side.
   - Run `PayoutEngine.calculatePayout()`.
   - Award winnings atomically.
   - Persist spin result to Postgres (audit trail).
   - Update leaderboard in Redis (`ZADD`).
   - Return `SpinResult`.
2. Implement `setBet` and `cycleBet` mutations.
3. Implement `mySpins` and `leaderboard` queries.
4. Write integration tests for full spin flow.

### Phase 4: State Machine (`packages/state-machine`)
Replace Unity's Animator State Machine with **XState**.

From all `StateMachineBehaviour` scripts, the complete state flow is:

```
[AwaitBet]
    │ (on: SPIN_CLICKED, guard: canAffordBet)
    ▼
[HandleBet] ──entry: deductBalance──▶
    │ (on: HANDLED_BET)
    ▼
[GenerateSpin] ──entry: generateSpin──▶
    │ (always)
    ▼
[SpawnFakeSymbols] ──entry: startFakeAnimation──▶
    │ (after: 3000ms, or on: FORCE_STOP)
    ▼
[SpawnRealSymbols] ──entry: spawnRealSymbols──▶
    │ (after: 2000ms)
    ▼
[LandRealSymbols] ──(pass-through or visual delay)──▶
    │ (always)
    ▼
[CalculatePayout] ──entry: calculatePayout──▶
    │ (guard: hasWinnings)
    ▼
[AnimatePaylines] ──entry: drawPaylines──▶
    │ (after: 1500ms)
    ▼
[AnimateWinningSymbols] ──entry: highlightWinners──▶
    │ (after: 1500ms)
    ▼
[AnimateWinnings] ──entry: showWinningsText──▶
    │ (after: 3000ms)
    ▼
[Reset] ──entry: resetBoard──▶
    │ (always)
    ▼
[ResetSymbols] ──entry: clearSymbols──▶
    │ (always)
    ▼
[ResetPaylines] ──entry: clearPaylines──▶
    │ (always)
    ▼
[ResetWinningText] ──entry: clearText──▶
    │ (always)
    ▼
(back to [AwaitBet])
```

**Alternative path from CalculatePayout**:
```
[CalculatePayout]
    │ (guard: noWinnings)
    ▼
[Reset] (skip animations)
```

XState gives us:
- Visualizable state charts (like Unity Animator window).
- Entry/exit actions (like `OnStateEnter` / `OnStateExit`).
- Guards (like Animator transition conditions).
- Delayed transitions (like `yield return new WaitForSeconds`).

### Phase 5: Nuxt Frontend

#### 5.1 Scene Architecture (TresJS)
```vue
<!-- Scene.vue -->
<template>
  <TresCanvas>
    <TresPerspectiveCamera :position="[0, 0, 12]" :fov="45" />
    <TresAmbientLight :intensity="0.5" />
    <TresDirectionalLight :position="[10, 10, 5]" />
    <SlotMachine />
  </TresCanvas>
</template>
```

#### 5.2 SlotMachine Component
- **Grid**: 4 rows × 5 reels.
- **Symbols**: Render emoji via `<Html>` from `@tresjs/drei` positioned at each grid cell.
- **Grid geometry**: Rounded boxes or planes behind each emoji for visual structure.

#### 5.3 Symbol Animation (Replacing DOTween)
- **Fake spin**: Custom `useRenderLoop` composable translates Y positions of placeholder emojis, recycling them when off-screen. Runs for ~3 seconds.
- **Real landing**: When `SpinResult` arrives, animate emojis to their grid positions using spring physics (`@tresjs/cientos` or GSAP).
- **Stagger**: Each reel stops with a slight delay (0.2s stagger) for classic slot feel.

#### 5.4 Payline Effects
When `AnimatePaylines` state is active:
- Read `winningPaths` from XState context.
- Render glowing lines between winning grid coordinates using `<TresLine>` or custom shader.
- Highlight winning symbol emojis with CSS glow/pulse via the `<Html>` wrapper.

#### 5.5 UI Overlay (Tailwind)
HTML overlay sits on top of the canvas (`absolute inset-0 pointer-events-none`):
```vue
<template>
  <div class="absolute inset-0 pointer-events-none">
    <div class="flex justify-between p-6">
      <BalanceDisplay />
      <BetDisplay />
    </div>
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
      <SpinButton />
      <ChangeBetButton />
    </div>
    <WinningModal />
  </div>
</template>
```

#### 5.6 Pages
- `/` — Main game (requires auth, redirects to login if not authenticated).
- `/login` — Login/Register form (tabs to switch).
- `/history` — Spin history table.
- `/leaderboard` — Top players.

### Phase 6: State Management (Pinia)

**Pinia Stores**:

```typescript
// stores/auth.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// stores/game.ts
interface GameState {
  balance: number;
  bet: number;
  phase: GamePhase;
  lastSpin: SpinResult | null;
  winningPaths: PaylinePath[];
  isSpinning: boolean;
}
```

The store acts as the bridge between:
1. **GraphQL API** (fetches spin result, updates balance).
2. **XState Machine** (drives the visual sequence; store subscribes to machine state changes).
3. **UI Components** (reads reactive values for display).

### Phase 7: Docker & DevOps

#### 7.1 `docker-compose.yml`
```yaml
version: '3.8'
services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - apps/web/.env
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "4000:4000"
    env_file:
      - apps/api/.env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: slots
      POSTGRES_PASSWORD: slots
      POSTGRES_DB: lucky_slots
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  redis_data:
```

#### 7.2 Production Deployment
- **Web**: Vercel (native Nuxt 3 support) or self-hosted Docker.
- **API**: Fly.io, Railway, or self-hosted VPS.
- **Database**: Managed PostgreSQL (Neon, Supabase, AWS RDS).
- **Redis**: Upstash Redis (serverless) or managed Redis (Redis Cloud).

#### 7.3 CI/CD Pipeline (GitHub Actions)
1. Lint & Typecheck (`turbo run lint typecheck`)
2. Unit tests (`turbo run test --filter=engine --filter=state-machine`)
3. Build Docker images
4. Deploy web + API

---

## 10. Risk Register

| Risk | Mitigation |
|------|------------|
| **RNG parity** (web RNG ≠ Unity RNG) | Document Unity's `Random.Range(0, 999)` behavior. Port exact integer thresholds. Test with 10k+ deterministic seeds. |
| **State desync** (client shows wrong balance) | Treat server GraphQL response as source of truth. Optimistic UI updates must rollback on error. |
| **Performance** (60fps with 20+ emoji HTML elements) | Use CSS transforms for emoji animations. Avoid re-rendering `<Html>` components. Pool emoji instances. |
| **Cheat exposure** (client generates spins) | **Never** call `SpinEngine.generateRoll()` in the client. Always server-authoritative. |
| **Animation timing** (web timers vs Unity coroutines) | Use XState `after` delays and `useRenderLoop` deltas. Do not rely on `setTimeout` for game logic timing. |
| **Session security** | HTTP-only cookies, Argon2id hashing, rate limiting on auth endpoints, Redis TTL on sessions. |
| **Emoji rendering inconsistency** | Use `font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;` for cross-platform consistency. |

---

## 11. Testing Strategy

1. **Unit Tests (Vitest)**:
   - `SpinEngine`: Test distribution over 100k rolls matches expected probabilities.
   - `PaylineEngine`: Verify exact number of paths generated. Test edge vertices.
   - `PayoutEngine`: Parameterized tests for every multiplier case. Test dirty-path filtering.
   - `Auth`: Test Argon2id hashing, session creation, validation, expiry.

2. **Integration Tests**:
   - GraphQL mutation full flow: `spin` → DB row created → balance updated → Redis leaderboard updated.
   - Auth flow: register → login → me → logout → me returns null.

3. **E2E Tests (Playwright)**:
   - Full user journey: Register → Login → Change Bet → Spin → See Animation → Balance Updates.
   - Visual regression for DOM overlays.
   - API mocking for edge cases (insufficient balance, rate limit).

4. **State Machine Tests (@xstate/test)**:
   - Generate test paths from the game machine to ensure every state is reachable and every guard is exercised.

---

## 12. Immediate Next Steps

1. [ ] **Scaffold**: Initialize Turborepo with `apps/web`, `apps/api`, `packages/engine`, `packages/state-machine`, `packages/ts-config`.
2. [ ] **Docker**: Write `docker-compose.yml` with Postgres and Redis.
3. [ ] **Port Engine**: Write `SpinEngine`, `PaylineEngine`, `PayoutEngine` in `packages/engine` with 100% test coverage.
4. [ ] **Validate**: Run Unity and TS engines with the same seed; compare outputs until identical.
5. [ ] **Auth API**: Implement `register`, `login`, `logout`, `me` with Argon2id and Redis sessions.
6. [ ] **State Machine**: Draft XState machine with `IDLE` and `SPINNING` states to prove concept.
7. [ ] **Hello Canvas**: Render a static 4×5 grid of emoji boxes in TresJS.

---

*Plan updated for Lucky Slots v2 Unity → Web migration.*
*Decisions locked: Nuxt + TresJS, username/password auth (Argon2id), emoji symbols, server-authoritative spins, bonus ignored for MVP.*
