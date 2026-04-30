import { db } from './datasources/db';
import { redis } from './datasources/redis';
import type { SessionData } from './lib/session';
import type { ServerResponse } from 'node:http';

export interface Context {
  sessionId: string | null;
  session: SessionData | null;
  db: typeof db;
  redis: typeof redis;
  res: ServerResponse;
}
