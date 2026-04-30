/**
 * @fileoverview lib/session.ts
 *
 * Stateless session management backed by Redis.
 *
 * Sessions are stored as short-lived JSON blobs keyed by a random UUID.
 * The session ID is delivered to the client as an HttpOnly cookie.
 */

import { redis } from '../datasources/redis';
import { v4 as uuidv4 } from 'uuid';

/** Redis key prefix to avoid collisions with other data. */
const SESSION_PREFIX = 'sess:';
/** Session TTL in seconds (7 days). */
const SESSION_TTL = 60 * 60 * 24 * 7;

/** Minimal session payload stored in Redis. */
export interface SessionData {
  userId: string;
  username: string;
}

/**
 * Create a new session and persist it in Redis.
 *
 * @param data  User info to store
 * @returns     The newly generated session ID (UUID)
 */
export async function createSession(data: SessionData): Promise<string> {
  const sessionId = uuidv4();
  await redis.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(data));
  return sessionId;
}

/**
 * Retrieve a session from Redis by its ID.
 *
 * @param sessionId  UUID from the client's cookie
 * @returns          Parsed session data or `null` if expired/missing
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Invalidate a session by removing it from Redis.
 *
 * @param sessionId  UUID from the client's cookie
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}
