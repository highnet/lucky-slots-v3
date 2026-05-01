/**
 * @fileoverview index.ts
 *
 * Entry point for the Lucky Slots GraphQL API server.
 *
 * Sets up a GraphQL Yoga server over plain HTTP, merges domain resolvers
 * (auth + spin), and builds a request context that includes the current
 * user session, database handle, and Redis client.
 */

import 'dotenv/config';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { db } from './datasources/db';
import { redis } from './datasources/redis';
import { getSession } from './lib/session';
import { createSchema } from './schema';
import { authResolvers } from './resolvers/auth';
import { spinResolvers } from './resolvers/spin';

/**
 * Merge multiple resolver objects into a single resolver map.
 *
 * Each resolver object may export Query, Mutation, or Subscription fields.
 * The result is passed to {@link createSchema}.
 */
function mergeResolvers(
  ...resolversArray: Array<{
    Query?: Record<string, unknown>;
    Mutation?: Record<string, unknown>;
    Subscription?: Record<string, unknown>;
  }>
) {
  const result: {
    Query: Record<string, unknown>;
    Mutation: Record<string, unknown>;
    Subscription: Record<string, unknown>;
  } = { Query: {}, Mutation: {}, Subscription: {} };
  for (const resolvers of resolversArray) {
    if (resolvers.Query) Object.assign(result.Query, resolvers.Query);
    if (resolvers.Mutation) Object.assign(result.Mutation, resolvers.Mutation);
    if (resolvers.Subscription) Object.assign(result.Subscription, resolvers.Subscription);
  }
  return result;
}

const schema = createSchema(mergeResolvers(authResolvers, spinResolvers));

const yoga = createYoga({
  schema,
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['POST', 'GET', 'OPTIONS'],
  },
  context: async ({ request, res }: { request: Request; res: unknown }) => {
    const cookie = request.headers.get('cookie') || '';
    const sessionId = cookie
      .split(';')
      .map((c: string) => c.trim())
      .find((c: string) => c.startsWith('sessionId='))
      ?.split('=')[1];

    const session = sessionId ? await getSession(sessionId) : null;

    return {
      sessionId: sessionId || null,
      session,
      db,
      redis,
      res,
    };
  },
});

const server = createServer(yoga);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
});
