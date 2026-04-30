/**
 * @fileoverview resolvers/spin.ts
 *
 * GraphQL resolvers for the slot-machine game loop.
 *
 * Queries:
 *   - mySpins          – paginated spin history for the current user
 *   - leaderboard      – top 100 players by balance (sorted set in Redis)
 *   - reelStrips       – current reel configuration
 *   - gridConfig       – current grid dimensions and thresholds
 *   - nextCommitment   – provably-fair commitment for the upcoming spin
 *   - verifySpin       – recompute a past spin to prove fairness
 *
 * Mutations:
 *   - spin      – execute a provably-fair spin, update balance, store result
 *   - setBet    – set the user's current bet amount
 *   - cycleBet  – rotate through predefined bet amounts
 *
 * Subscription:
 *   - leaderboardUpdated – polled every 5s (basic implementation)
 */

import { db } from '../datasources/db';
import { redis } from '../datasources/redis';
import { users, spins } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import {
  SpinEngine,
  PaylineEngine,
  PayoutEngine,
  BET_AMOUNTS,
  symbolsToGraphQL,
  REEL_STRIPS,
  GRID_CONFIG,
  makeProvablyFairRng,
  computeServerHash,
  generateSeed,
  verifySpin as engineVerifySpin,
} from '@lucky-slots/engine';
import type { Context } from '../context';

/** GraphQL string names indexed by {@link Symbol} enum value. */
const GRAPHQL_SYMBOL_NAMES: string[] = ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD', 'BONUS'];

/** Shared payline engine (paths are cached internally). */
const paylineEngine = new PaylineEngine();
/** Shared payout engine backed by the payline engine above. */
const payoutEngine = new PayoutEngine(paylineEngine);

/**
 * Simple Redis-backed rate limiter.
 *
 * @param key            Redis key for this limit bucket
 * @param max            Maximum allowed requests within the window
 * @param windowSeconds  TTL for the bucket (reset after this many seconds)
 * @returns              `true` if the request is allowed
 */
async function checkRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  return current <= max;
}

/**
 * Build a provably-fair commitment for the user's next spin.
 *
 * Generates a fresh server seed, hashes it, and stores the seed in Redis
 * so the spin mutation can retrieve it later.
 */
async function buildCommitment(userId: string, clientSeed: string, nonce: number) {
  const serverSeed = generateSeed();
  const serverHash = computeServerHash(serverSeed);
  // Store seed for 60s so the client can complete the spin
  await redis.setex(`commitment:${userId}:${nonce}`, 60, serverSeed);
  return { serverSeed, serverHash, clientSeed, nonce };
}

/**
 * Retrieve a committed server seed from Redis.
 *
 * @returns The seed string or `null` if the commitment expired.
 */
async function getCommittedSeed(userId: string, nonce: number): Promise<string | null> {
  return redis.get(`commitment:${userId}:${nonce}`);
}

/**
 * Spin/gameplay resolver map merged into the global schema in {@link index.ts}.
 */
export const spinResolvers = {
  Query: {
    mySpins: async (_parent: unknown, args: { limit?: number; offset?: number }, ctx: Context) => {
      if (!ctx.session) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const results = await db.query.spins.findMany({
        where: eq(spins.userId, ctx.session.userId),
        orderBy: desc(spins.createdAt),
        limit: args.limit ?? 20,
        offset: args.offset ?? 0,
      });
      return results.map((s: {
        id: string;
        symbols: unknown;
        winningPaths: unknown;
        serverSeed: string;
        serverHash: string;
        clientSeed: string;
        nonce: number;
        multiplier: string;
        winnings: string;
        bet: string;
        createdAt: Date | null;
      }) => ({
        id: s.id,
        symbols: Array.isArray(s.symbols)
          ? s.symbols.map((row: unknown) =>
              Array.isArray(row)
                ? row.map((val: unknown) =>
                    typeof val === 'number' ? GRAPHQL_SYMBOL_NAMES[val] : val
                  )
                : row
            )
          : s.symbols,
        winningPaths: Array.isArray(s.winningPaths) ? s.winningPaths : [],
        serverSeed: s.serverSeed,
        serverHash: s.serverHash,
        clientSeed: s.clientSeed,
        nonce: s.nonce,
        multiplier: parseFloat(s.multiplier),
        winnings: parseFloat(s.winnings),
        bet: parseFloat(s.bet),
        newBalance: 0,
        timestamp: s.createdAt?.toISOString() ?? '',
      }));
    },
    leaderboard: async () => {
      const entries = await redis.zrevrange('leaderboard', 0, 99, 'WITHSCORES');
      const results: { username: string; balance: number; rank: number }[] = [];
      for (let i = 0; i < entries.length; i += 2) {
        results.push({
          username: entries[i],
          balance: parseFloat(entries[i + 1]),
          rank: Math.floor(i / 2) + 1,
        });
      }
      return results;
    },
    reelStrips: () => REEL_STRIPS,
    gridConfig: () => ({
      rows: GRID_CONFIG.rows,
      cols: GRID_CONFIG.cols,
      minMatch: GRID_CONFIG.minMatch,
      numSymbols: GRID_CONFIG.numSymbols,
      stripSize: GRID_CONFIG.stripSize,
      paylineSymbols: GRID_CONFIG.paylineSymbols,
    }),
    nextCommitment: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.session) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.userId),
      });
      if (!user) {
        throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
      }
      const clientSeed = user.clientSeed || generateSeed();
      const nonce = user.nextNonce ?? 0;
      const commitment = await buildCommitment(user.id, clientSeed, nonce);
      return {
        serverHash: commitment.serverHash,
        clientSeed: commitment.clientSeed,
        nonce: commitment.nonce,
      };
    },
    verifySpin: async (_parent: unknown, args: { id: string }, ctx: Context) => {
      if (!ctx.session) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const spin = await db.query.spins.findFirst({
        where: eq(spins.id, args.id),
      });
      if (!spin) {
        throw new GraphQLError('Spin not found', { extensions: { code: 'NOT_FOUND' } });
      }
      if (spin.userId !== ctx.session.userId) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'FORBIDDEN' } });
      }

      const grid: string[][] = Array.isArray(spin.symbols)
        ? (spin.symbols as unknown[][]).map((row) =>
            row.map((val) => (typeof val === 'number' ? GRAPHQL_SYMBOL_NAMES[val] : String(val)))
          )
        : [];

      const match = engineVerifySpin(
        spin.serverSeed,
        spin.clientSeed,
        spin.nonce,
        GRID_CONFIG.rows,
        GRID_CONFIG.cols,
        grid,
        REEL_STRIPS
      );

      return {
        spinId: spin.id,
        match,
        serverSeed: spin.serverSeed,
        serverHash: spin.serverHash,
        clientSeed: spin.clientSeed,
        nonce: spin.nonce,
        recomputedGrid: grid,
      };
    },
  },
  Mutation: {
    spin: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.session) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const rateKey = `ratelimit:spin:${ctx.session.userId}`;
      const allowed = await checkRateLimit(rateKey, 10, 10);
      if (!allowed) {
        throw new GraphQLError('Rate limit exceeded', { extensions: { code: 'RATE_LIMITED' } });
      }
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.userId),
      });
      if (!user) {
        throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
      }

      // Ensure user has seeds (backfill)
      let clientSeed = user.clientSeed;
      if (!clientSeed) {
        clientSeed = generateSeed();
        await db.update(users).set({ clientSeed }).where(eq(users.id, user.id));
      }

      const nonce = user.nextNonce ?? 0;
      const bet = parseFloat(user.currentBet);
      const balance = parseFloat(user.balance);
      if (bet > balance) {
        throw new GraphQLError('Insufficient balance', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      // Retrieve the committed server seed
      let serverSeed = await getCommittedSeed(user.id, nonce);
      if (!serverSeed) {
        // Client didn't call nextCommitment first — generate one on-the-fly
        serverSeed = generateSeed();
      }

      const newBalance = balance - bet;
      await db.update(users).set({ balance: newBalance.toFixed(2) }).where(eq(users.id, user.id));

      // Provably fair spin (uses reel strips when available)
      const rng = makeProvablyFairRng(serverSeed, clientSeed, nonce);
      const spinEngine = new SpinEngine(rng, undefined, REEL_STRIPS);
      const spinResult = spinEngine.spin();
      const payout = payoutEngine.calculatePayout(spinResult.symbols, spinResult.wildReplacements, bet);
      const finalBalance = newBalance + payout.winnings;
      await db.update(users).set({ balance: finalBalance.toFixed(2) }).where(eq(users.id, user.id));

      // Generate next commitment before DB write so the spin response includes it
      const nextNonce = nonce + 1;
      const nextCommitment = await buildCommitment(user.id, clientSeed, nextNonce);

      const [spinRecord] = await db
        .insert(spins)
        .values({
          userId: user.id,
          symbols: spinResult.symbols as unknown,
          winningPaths: payout.winningPaths.map((wp) => ({
            symbol: GRAPHQL_SYMBOL_NAMES[wp.symbol as number],
            size: wp.size,
            coordinates: wp.coordinates,
          })) as unknown,
          serverSeed,
          serverHash: computeServerHash(serverSeed),
          clientSeed,
          nonce,
          bet: bet.toFixed(2),
          multiplier: payout.multiplier.toFixed(4),
          winnings: payout.winnings.toFixed(2),
        })
        .returning();

      // Increment user's nonce
      await db.update(users).set({ nextNonce }).where(eq(users.id, user.id));

      await redis.zadd('leaderboard', finalBalance, user.username);

      return {
        id: spinRecord.id,
        symbols: symbolsToGraphQL(spinResult.symbols),
        winningPaths: payout.winningPaths.map((wp) => ({
          symbol: GRAPHQL_SYMBOL_NAMES[wp.symbol as number],
          size: wp.size,
          coordinates: wp.coordinates,
        })),
        multiplier: payout.multiplier,
        winnings: payout.winnings,
        bet,
        newBalance: finalBalance,
        timestamp: spinRecord.createdAt?.toISOString() ?? new Date().toISOString(),
        serverSeed,
        serverHash: computeServerHash(serverSeed),
        clientSeed,
        nonce,
        nextServerHash: nextCommitment.serverHash,
        nextNonce,
      };
    },
    setBet: async (_parent: unknown, args: { amount: number }, ctx: Context) => {
      if (!ctx.session) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const [user] = await db
        .update(users)
        .set({ currentBet: args.amount.toFixed(2) })
        .where(eq(users.id, ctx.session.userId))
        .returning();
      return user;
    },
    cycleBet: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.session) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.userId),
      });
      if (!user) {
        throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
      }
      const currentBet = parseFloat(user.currentBet);
      const amounts = [...BET_AMOUNTS];
      const idx = amounts.indexOf(currentBet as (typeof amounts)[number]);
      const nextBet = amounts[(idx + 1) % amounts.length];
      const [updated] = await db
        .update(users)
        .set({ currentBet: nextBet.toFixed(2) })
        .where(eq(users.id, user.id))
        .returning();
      return updated;
    },
  },
  Subscription: {
    leaderboardUpdated: {
      subscribe: async function* () {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const entries = await redis.zrevrange('leaderboard', 0, 99, 'WITHSCORES');
          const results: { username: string; balance: number; rank: number }[] = [];
          for (let i = 0; i < entries.length; i += 2) {
            results.push({
              username: entries[i],
              balance: parseFloat(entries[i + 1]),
              rank: Math.floor(i / 2) + 1,
            });
          }
          yield { leaderboardUpdated: results };
        }
      },
    },
  },
};
