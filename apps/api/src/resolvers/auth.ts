import { db } from '../datasources/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../lib/argon2';
import { createSession, deleteSession } from '../lib/session';
import { GraphQLError } from 'graphql';
import type { Context } from '../context';

function setCookie(res: any, sessionId: string | null) {
  if (sessionId) {
    res.setHeader(
      'Set-Cookie',
      `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
    );
  } else {
    res.setHeader(
      'Set-Cookie',
      'sessionId=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    );
  }
}

export const authResolvers = {
  Query: {
    me: async (_parent: any, _args: any, ctx: Context) => {
      if (!ctx.session) return null;
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.userId),
      });
      return user || null;
    },
  },
  Mutation: {
    register: async (_parent: any, args: { username: string; password: string }, ctx: Context) => {
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
      const [user] = await db
        .insert(users)
        .values({
          username: username.toLowerCase(),
          passwordHash,
          balance: '1000.00',
          currentBet: '0.10',
        })
        .returning();
      const sessionId = await createSession({ userId: user.id, username: user.username });
      setCookie(ctx.res, sessionId);
      return user;
    },
    login: async (_parent: any, args: { username: string; password: string }, ctx: Context) => {
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
      const sessionId = await createSession({ userId: user.id, username: user.username });
      setCookie(ctx.res, sessionId);
      return user;
    },
    logout: async (_parent: any, _args: any, ctx: Context) => {
      if (ctx.sessionId) {
        await deleteSession(ctx.sessionId);
      }
      setCookie(ctx.res, null);
      return true;
    },
  },
};
