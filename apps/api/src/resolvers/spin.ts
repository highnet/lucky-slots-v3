import { db } from '../datasources/db';
import { redis } from '../datasources/redis';
import { users, spins } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { SpinEngine, PaylineEngine, PayoutEngine, BET_AMOUNTS, symbolsToGraphQL, REEL_STRIPS } from '@lucky-slots/engine';
import { randomFillSync } from 'crypto';
import type { Context } from '../context';

const GRAPHQL_SYMBOL_NAMES: string[] = ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD', 'BONUS'];

const spinEngine = new SpinEngine(() => {
  const buf = new Uint32Array(1);
  randomFillSync(buf);
  return buf[0] % 999;
});

const paylineEngine = new PaylineEngine();
const payoutEngine = new PayoutEngine(paylineEngine);

async function checkRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  return current <= max;
}

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
        winningPaths: [],
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
      const bet = parseFloat(user.currentBet);
      const balance = parseFloat(user.balance);
      if (bet > balance) {
        throw new GraphQLError('Insufficient balance', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const newBalance = balance - bet;
      await db.update(users).set({ balance: newBalance.toFixed(2) }).where(eq(users.id, user.id));
      const spinResult = spinEngine.spin();
      const payout = payoutEngine.calculatePayout(spinResult.symbols, spinResult.wildReplacements, bet);
      const finalBalance = newBalance + payout.winnings;
      await db.update(users).set({ balance: finalBalance.toFixed(2) }).where(eq(users.id, user.id));
      const [spinRecord] = await db
        .insert(spins)
        .values({
          userId: user.id,
          symbols: spinResult.symbols as unknown,
          bet: bet.toFixed(2),
          multiplier: payout.multiplier.toFixed(4),
          winnings: payout.winnings.toFixed(2),
        })
        .returning();
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
