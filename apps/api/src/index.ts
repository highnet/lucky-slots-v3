import 'dotenv/config';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { db } from './datasources/db';
import { redis } from './datasources/redis';
import { getSession } from './lib/session';
import { createSchema } from './schema';
import { authResolvers } from './resolvers/auth';
import { spinResolvers } from './resolvers/spin';

function mergeResolvers(...resolversArray: any[]) {
  const result: any = { Query: {}, Mutation: {}, Subscription: {} };
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
  context: async ({ request, res }: any) => {
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
