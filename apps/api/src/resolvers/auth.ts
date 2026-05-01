/**
 * @fileoverview auth.ts
 *
 * GraphQL resolvers for user authentication.
 *
 * Handles registration, login, logout, and seed backfilling for existing users
 * who were created before the provably fair system was introduced.
 */
/**
 * @fileoverview resolvers/auth.ts
 *
 * GraphQL resolvers for authentication and user management.
 *
 * Queries:
 *   - me       – return the currently logged-in user
 *
 * Mutations:
 *   - register – create account, hash password, start session
 *   - login    – verify credentials, start session
 *   - logout   – destroy session and clear cookie
 */

import { db } from '../datasources/db';
import { users } from '../db/schema';
import { eq, count } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../lib/argon2';
import { createSession, deleteSession } from '../lib/session';
import { GraphQLError } from 'graphql';
import type { Context } from '../context';
import { generateSeed } from '@lucky-slots/engine';

/**
 * Write the session cookie to the HTTP response.
 *
 * Passing `null` clears the cookie (used during logout).
 */
function setCookie(res: { setHeader(name: string, value: string): void }, sessionId: string | null) {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = isProduction ? 'None' : 'Strict';
  if (sessionId) {
    res.setHeader(
      'Set-Cookie',
      `sessionId=${sessionId}; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=604800`
    );
  } else {
    res.setHeader(
      'Set-Cookie',
      `sessionId=; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=0`
    );
  }
}

/**
 * Ensure a user has a client seed and correct nextNonce.
 * Backfills existing users who were created before provably fair.
 */
async function ensureUserSeeds(userId: string): Promise<{ clientSeed: string; nextNonce: number }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) throw new Error('User not found during seed backfill');

  let clientSeed = user.clientSeed;
  let nextNonce = user.nextNonce;

  // Backfill: generate client seed if missing
  if (!clientSeed || clientSeed.length === 0) {
    clientSeed = generateSeed();
    // Set nextNonce to number of existing spins so new spins continue the chain
    const spinCount = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.id, userId));
    nextNonce = spinCount[0]?.count ?? 0;

    await db
      .update(users)
      .set({ clientSeed, nextNonce })
      .where(eq(users.id, userId));
  }

  return { clientSeed, nextNonce };
}

/**
 * Authentication resolver map merged into the global schema in {@link index.ts}.
 */
export const authResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.session) return null;
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.userId),
      });
      return user || null;
    },
  },
  Mutation: {
    register: async (_parent: unknown, args: { username: string; password: string }, ctx: Context) => {
      const { username, password } = args;
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        throw new GraphQLError('Password must contain at least one letter and one number', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      const existing = await db.query.users.findFirst({
        where: eq(users.username, username.toLowerCase()),
      });
      if (existing) {
        throw new GraphQLError('Username already taken', {
          extensions: { code: 'CONFLICT' },
        });
      }
      const passwordHash = await hashPassword(password);
      const clientSeed = generateSeed();
      const [user] = await db
        .insert(users)
        .values({
          username: username.toLowerCase(),
          passwordHash,
          balance: '1000.00',
          currentBet: '0.10',
          clientSeed,
          nextNonce: 0,
        })
        .returning();
      const sessionId = await createSession({ userId: user.id, username: user.username });
      setCookie(ctx.res, sessionId);
      return user;
    },
    login: async (_parent: unknown, args: { username: string; password: string }, ctx: Context) => {
      const user = await db.query.users.findFirst({
        where: eq(users.username, args.username.toLowerCase()),
      });
      if (!user) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      const valid = await verifyPassword(user.passwordHash, args.password);
      if (!valid) {
        throw new GraphQLError('Invalid credentials', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      // Backfill seeds for existing users
      await ensureUserSeeds(user.id);
      const sessionId = await createSession({ userId: user.id, username: user.username });
      setCookie(ctx.res, sessionId);
      return user;
    },
    logout: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (ctx.sessionId) {
        await deleteSession(ctx.sessionId);
      }
      setCookie(ctx.res, null);
      return true;
    },
  },
};
