import { redis } from '../datasources/redis';
import { v4 as uuidv4 } from 'uuid';

const SESSION_PREFIX = 'sess:';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionData {
  userId: string;
  username: string;
}

export async function createSession(data: SessionData): Promise<string> {
  const sessionId = uuidv4();
  await redis.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL, JSON.stringify(data));
  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}
