/**
 * @fileoverview lib/argon2.ts
 *
 * Thin wrapper around argon2 for password hashing and verification.
 *
 * Uses argon2id (recommended variant) with library defaults.
 */

import argon2 from 'argon2';

/**
 * Hash a plain-text password with argon2id.
 *
 * @param password  Raw user password
 * @returns         Argon2id hash string safe for DB storage
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Verify a plain-text password against a stored argon2id hash.
 *
 * @param hash      Hash retrieved from the database
 * @param password  Raw password supplied by the user
 * @returns         `true` if the password matches
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
