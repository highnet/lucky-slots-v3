/**
 * @fileoverview context.ts
 *
 * GraphQL context type definition.
 *
 * The context is created per-request in {@link index.ts} and carries
 * the authenticated user session, database ORM handle, Redis client,
 * and the raw HTTP response object (used to set cookies).
 */

import { db } from './datasources/db';
import { redis } from './datasources/redis';
import type { SessionData } from './lib/session';
import type { ServerResponse } from 'node:http';

/** Per-request context available in every GraphQL resolver. */
export interface Context {
  sessionId: string | null;
  session: SessionData | null;
  db: typeof db;
  redis: typeof redis;
  res: ServerResponse;
}
