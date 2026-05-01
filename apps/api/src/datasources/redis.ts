/**
 * @fileoverview datasources/redis.ts
 *
 * Shared Redis client (ioredis) used for sessions, rate limiting,
 * provably-fair commitments, and the real-time leaderboard.
 */

import Redis from 'ioredis';

/** Shared Redis client singleton. */
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    });
