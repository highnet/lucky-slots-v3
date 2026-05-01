# Deploy to Fly.io

This guide walks through deploying the full Lucky Slots stack (API + Web + Postgres + Redis) to [Fly.io](https://fly.io).

## Prerequisites

1. [Install `flyctl`](https://fly.io/docs/hands-on/install-flyctl/)
2. Log in: `fly auth login`
3. Ensure you have built the project locally at least once: `pnpm install && pnpm build`

---

## First-Time Deploy Checklist

Follow these steps **in order** on a clean project. Skipping a step or changing the order is the most common cause of a failed deployment.

### 1. Create the API app

```bash
fly apps create lucky-slots-api
```

### 2. Create the Web app

```bash
fly apps create lucky-slots-web
```

### 3. Provision Postgres

```bash
fly postgres create --name lucky-slots-db
```

Attach it to the API app (this creates the DB user and sets `DATABASE_URL`):

```bash
fly postgres attach lucky-slots-db -a lucky-slots-api
```

> **Common mistake:** Using `--postgres-app` instead of the positional argument. The correct syntax is `fly postgres attach <db-name> -a <app-name>`.

### 4. Provision Redis (Upstash)

```bash
fly redis create --name lucky-slots-redis
```

Get the connection string:

```bash
fly redis status lucky-slots-redis
```

Set it as a secret on the API app using the **Private URL** (starts with `redis://`, not `rediss://`):

```bash
fly secrets set REDIS_URL="redis://default:...@fly-lucky-slots-redis.upstash.io:6379" --app lucky-slots-api
```

> **Critical:** Use the exact `redis://` private URL from `fly redis status`. Do NOT use the `rediss://` (TLS) URL — ioredis fails with TLS handshake / `MaxRetriesPerRequestError` inside Fly's private network.

### 5. Set the remaining API secrets

```bash
fly secrets set WEB_URL="https://lucky-slots-web.fly.dev" --app lucky-slots-api
```

> **Note:** Secrets are only loaded when a machine **starts**. If you ever update secrets later, you must redeploy or restart the app (`fly apps restart lucky-slots-api`) for running machines to pick them up.

### 6. Deploy the API

```bash
fly deploy --config fly.api.toml
```

Wait for the deploy to finish and both machines to reach a healthy state.

### 7. Push the database schema

The API container is now running, but the database is still empty. You must create the tables before registration will work.

```bash
fly ssh console --app lucky-slots-api --pty
# Inside the container:
sh -c 'cd apps/api && npx drizzle-kit push:pg'
```

> **Common mistake:** Running `npx drizzle-kit push:pg` from `/app` instead of `/app/apps/api`. The config file is at `apps/api/drizzle.config.ts`, so Drizzle must be invoked from that directory.

Alternatively, proxy the Fly Postgres locally and run migrations from your machine:

```bash
fly proxy 5432 --app lucky-slots-db
# In another terminal:
# 1. Update DATABASE_URL in apps/api/.env to point to localhost:5432
# 2. pnpm --filter @lucky-slots/api db:push
```

### 8. Verify the API is healthy

```bash
curl -s -X POST https://lucky-slots-api.fly.dev/graphql \
  -H "Content-Type: application/json" \
  -H "Origin: https://lucky-slots-web.fly.dev" \
  -d '{"query": "mutation { register(username: \"smoke_test\", password: \"testpass123\") { id username balance } }"}'
```

You should get a JSON response with a user ID and balance of `1000`. If you get `"Unexpected error"`, see the Troubleshooting section below.

### 9. Deploy the Web app

```bash
fly deploy --config fly.web.toml
```

> **Important:** The web app must be redeployed any time you change composables, `nuxt.config.ts`, or any code that affects the built bundle. Fly deploys are immutable — old machines do not pick up new source code.

### 10. Verify the full stack

- Open `https://lucky-slots-web.fly.dev` in your browser.
- Register a new account — it should succeed and redirect to the game.
- Open DevTools and confirm `window.__NUXT__.config.public.apiUrl` equals `https://lucky-slots-api.fly.dev/graphql`. If it shows `localhost:4000`, the web app was not rebuilt after the `nuxt.config.ts` changes.

---

## What We Learned (Deployment Battle Log)

This section documents the specific failures we hit during the first real deploy and how to avoid them.

### Lesson 1 — `fly postgres attach` syntax

**What failed:** `fly postgres attach --postgres-app lucky-slots-db --app lucky-slots-api` returned an "unknown flag" error.  
**Fix:** The correct syntax is `fly postgres attach lucky-slots-db -a lucky-slots-api` (positional argument, not `--postgres-app`).

### Lesson 2 — Schema must be pushed AFTER the API is deployed

**What failed:** Registration returned "Unexpected error" because the `users` table did not exist. Postgres was attached, but `drizzle-kit push:pg` had never been run against the Fly database.  
**Fix:** Always push the schema in step 7, after the API containers are running.

### Lesson 3 — `rediss://` (TLS) Redis URL causes ioredis to hang

**What failed:** The `REDIS_URL` secret was set with a `rediss://` URL. ioredis attempted a TLS handshake that failed with `MaxRetriesPerRequestError`. Because `enableOfflineQueue` is true by default, every Redis command (including session creation during `register`) queued forever, causing the mutation to hang and eventually time out.  
**Fix:** Use the exact `redis://` **Private URL** shown by `fly redis status`.

### Lesson 4 — Secrets are not hot-reloaded

**What failed:** After fixing `REDIS_URL` and `DATABASE_URL`, some machines still had the old values. Fly's proxy load-balanced requests to a stale machine, so registration still hung or failed intermittently.  
**Fix:** After changing secrets, redeploy or restart the app. If old machines persist, destroy them explicitly:

```bash
fly machines list --app lucky-slots-api
fly machines destroy <old-machine-id> --app lucky-slots-api --force
```

### Lesson 5 — The web app bundle is baked at build time

**What failed:** The live web app was still hardcoded to `http://localhost:4000/graphql` because it was deployed before the `runtimeConfig` + composable changes were made.  
**Fix:** Always run `fly deploy --config fly.web.toml` after any code change that affects the frontend bundle. Verify in the browser with `window.__NUXT__.config.public.apiUrl`.

### Lesson 6 — `drizzle-kit` must run from the API workspace directory

**What failed:** Running `npx drizzle-kit push:pg` from `/app` (the repo root inside the container) could not find `drizzle.config.ts`.  
**Fix:** Use `sh -c 'cd apps/api && npx drizzle-kit push:pg'` so Drizzle finds its config file.

### Lesson 7 — pnpm 10 ignores build scripts by default

**What failed:** During Docker build, pnpm printed `Ignored build scripts: argon2@0.40.3`. Argon2 worked anyway because it ships prebuilt binaries, but this is fragile.  
**Fix:** `package.json` now includes a `pnpm.onlyBuiltDependencies` list so `argon2`, `@parcel/watcher`, and `esbuild` are always built during `pnpm install`.

---

## SSH & CLI Operations (Running on the Fly Backend)

The API container includes the full monorepo source, so you can SSH into the running machine to run the engine CLI, optimize RTP, and perform other maintenance tasks.

### SSH into the API machine

```bash
fly ssh console --app lucky-slots-api
```

You will land in `/app` with the full repo available.

### Running the interactive slots CLI

The interactive TUI may not render well over a non-TTY SSH session. If you see display issues, run it with a forced TTY:

```bash
# Force a TTY so the interactive menu renders correctly
fly ssh console --app lucky-slots-api --pty
# Then inside the container:
npx tsx scripts/slots-cli.ts
```

Available menu options inside the CLI:
- **Show Config** — view current `GRID_CONFIG`
- **Update Config** — edit rows, cols, strip size, etc.
- **Regenerate Strips** — re-randomise reel strips
- **Analyze RTP** — run a Monte Carlo RTP simulation
- **Optimize Strips** — run the AI optimizer to target a specific RTP / hit-rate
- **Run Migrations** — push DB schema changes
- **Build All** — recompile the API and web packages
- **Start Dev** — start local dev servers (not useful on Fly, but available)

### Non-interactive: Optimize RTP directly

For scripted or non-TTY use, run the optimizer directly with environment variables instead of using the interactive menu:

```bash
fly ssh console --app lucky-slots-api --pty
# Inside the container:
TARGET_RTP=96 \
TARGET_HITRATE=0.22 \
OPT_ITERATIONS=300 \
OPT_SPINS=10000 \
WRITE_CONSTANTS=1 \
npx tsx packages/engine/scripts/optimizeStrips.ts
```

| Variable | Default | Description |
|----------|---------|-------------|
| `TARGET_RTP` | `95` | Desired RTP percentage (e.g. `96` for 96%) |
| `TARGET_HITRATE` | `0.15` | Desired hit-rate as a decimal (e.g. `0.22` for 22%) |
| `OPT_ITERATIONS` | `100` | Number of optimizer iterations |
| `OPT_SPINS` | `5000` | Spins per evaluation during optimization |
| `WRITE_CONSTANTS` | `0` | Set to `1` to overwrite `packages/engine/src/constants.ts` |

After optimizing strips on the remote machine, you **must redeploy** so the new constants are baked into the image:

```bash
fly deploy --config fly.api.toml
fly deploy --config fly.web.toml
```

> **Note:** Changes made inside a running machine are ephemeral. `WRITE_CONSTANTS=1` updates the file in the container, but containers are immutable. Always redeploy after optimization so the new reel strips and multipliers are persisted in the Docker image. Alternatively, copy the optimized `packages/engine/src/constants.ts` back to your local repo, commit, and redeploy.

### Non-interactive: Analyze RTP directly

```bash
fly ssh console --app lucky-slots-api
# Inside the container, run a quick 100k spin analysis:
npx tsx -e "
const { RTPSimulator } = require('@lucky-slots/engine');
const { GRID_CONFIG } = require('@lucky-slots/engine');
const { REEL_STRIPS } = require('@lucky-slots/engine');
const { getMultiplier } = require('@lucky-slots/engine');

const multipliers = {};
const symbols = ['Ten','Jack','Queen','King','Ace'];
for (const s of symbols.slice(0, GRID_CONFIG.paylineSymbols)) {
  for (let size = GRID_CONFIG.minMatch; size <= GRID_CONFIG.cols; size++) {
    multipliers[\`\${size} \${s}\`] = getMultiplier(size, s);
  }
}

const sim = new RTPSimulator({
  rows: GRID_CONFIG.rows,
  cols: GRID_CONFIG.cols,
  minMatch: GRID_CONFIG.minMatch,
  paylineSymbols: GRID_CONFIG.paylineSymbols,
  reelStrips: REEL_STRIPS,
  multipliers,
});

const result = sim.run(100_000, 1.0, Date.now());
console.log('RTP:', result.rtp.toFixed(2) + '%');
console.log('Hit Frequency:', (result.hitFrequency * 100).toFixed(2) + '%');
console.log('Avg Multiplier:', result.avgMultiplier.toFixed(3));
"
```

### Database operations via SSH

```bash
fly ssh console --app lucky-slots-api
# Inside the container:
sh -c 'cd apps/api && npx drizzle-kit migrate'
sh -c 'cd apps/api && npx drizzle-kit push:pg'
```

Alternatively, proxy the Fly Postgres to your local machine and run commands locally (requires `psql` or `pgcli`):

```bash
fly proxy 5432 --app lucky-slots-db
# In another terminal, update apps/api/.env DATABASE_URL to point to localhost:5432
pnpm --filter @lucky-slots/api db:migrate
```

---

## Troubleshooting

### Registration returns "Unexpected error"

1. **Check the API logs:** `fly logs --app lucky-slots-api`
2. **Missing `DATABASE_URL`:** If you see `ECONNREFUSED 127.0.0.1:5432`, Postgres was not attached. Run `fly postgres attach lucky-slots-db -a lucky-slots-api`.
3. **Schema not pushed:** If you see a relation/table error, the DB schema doesn't exist yet. SSH into the API and run `sh -c 'cd apps/api && npx drizzle-kit push:pg'`.
4. **Redis connection errors:** If requests hang or you see `getaddrinfo ENOTFOUND` / `MaxRetriesPerRequestError`, the `REDIS_URL` secret is wrong. Use the exact `redis://` private URL from `fly redis status`, then redeploy.
5. **Stale machines after secret changes:** Fly may route requests to old machines that still have the previous secret values. Check with `fly machines list --app lucky-slots-api` and destroy old machines if needed.

### API health check failures / "not listening on 0.0.0.0:8080"

The API may take a few seconds to start (especially on cold boot). This is usually transient during rolling deploys. If it persists, check logs for startup crashes (missing modules, DB errors, etc.).

### Web app calls `localhost:4000` instead of the Fly API

The web app must be redeployed after any code changes to the composables or `nuxt.config.ts`. Verify the runtime config in the browser by inspecting `window.__NUXT__.config.public.apiUrl`.

### `fly deploy` times out or machines show "canceled"

If a deploy command times out, the rolling strategy may still be in progress in the background. Check the status with `fly status --app lucky-slots-api` and verify machines are healthy before continuing.

---

## Useful commands

```bash
# View logs
fly logs --app lucky-slots-api
fly logs --app lucky-slots-web

# Scale
fly scale count 2 --app lucky-slots-api

# Restart (picks up new secrets)
fly apps restart lucky-slots-api
fly apps restart lucky-slots-web

# Secrets
fly secrets list --app lucky-slots-api
fly secrets set KEY=value --app lucky-slots-api

# List machines
fly machines list --app lucky-slots-api

# SSH into a specific machine
fly ssh console --app lucky-slots-api --machine <machine-id>

# One-command deploy both apps
./scripts/deploy-fly.sh
```

---

## Architecture on Fly.io

| Service | Fly App | Resource |
|---------|---------|----------|
| API | `lucky-slots-api` | Node.js + tsx |
| Web | `lucky-slots-web` | Nuxt 3 (Nitro) |
| Postgres | `lucky-slots-db` | Fly Postgres |
| Redis | `lucky-slots-redis` | Upstash Redis |

The Web app talks to the API via the public GraphQL endpoint. Sessions are stored in Redis. Game data is persisted in Postgres.
