/**
 * @fileoverview ProvablyFairRng.ts
 *
 * Cryptographically verifiable deterministic RNG for slot spins.
 *
 * Uses HMAC-SHA256 via js-sha256 (works in both Node.js and browser).
 *
 * Each spin outcome is uniquely determined by three inputs:
 *   1. serverSeed  – 32-byte hex string, revealed after the spin
 *   2. clientSeed  – 32-byte hex string, fixed per user
 *   3. nonce       – monotonically increasing integer per user
 *
 * For every symbol cell in the grid, we compute:
 *   HMAC_SHA256(serverSeed, clientSeed + "|" + nonce + "|" + counter)
 *
 * The first 4 bytes of the HMAC digest are interpreted as a uint32
 * and taken modulo 999 to produce the same range as the legacy RNG.
 */

import { sha256 } from 'js-sha256';
const hmac = sha256.hmac as (key: string, message: string) => string;

/** Separator used when building the HMAC message. */
const SEP = '|';

/**
 * Generate deterministic entropy for a single grid cell.
 *
 * @param serverSeed  Hex-encoded server seed (revealed after spin)
 * @param clientSeed  Hex-encoded client seed (fixed per user)
 * @param nonce       Global per-user spin counter
 * @param counter     Cell index within the grid (0 … rows×cols-1)
 * @returns           Integer in range [0, 999)
 */
export function provablyFairRng(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  counter: number
): number {
  const message = `${clientSeed}${SEP}${nonce}${SEP}${counter}`;
  const digest = hmac(serverSeed, message);
  // First 8 hex chars = 4 bytes = uint32
  const value = parseInt(digest.slice(0, 8), 16);
  return value % 999;
}

/**
 * Build an RNG function factory for the SpinEngine.
 *
 * Returns a closure that yields the next cell's RNG value when called.
 * The closure maintains an internal counter so SpinEngine can call it
 * blindly, one value per cell.
 */
export function makeProvablyFairRng(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): () => number {
  let counter = 0;
  return () => {
    const value = provablyFairRng(serverSeed, clientSeed, nonce, counter);
    counter++;
    return value;
  };
}

/**
 * Compute the public commitment hash for a server seed.
 *
 * Before a spin, the server sends `serverHash` to the client.
 * After the spin, the server reveals `serverSeed`.
 * The client verifies: `sha256(serverSeed) === serverHash`.
 */
export function computeServerHash(serverSeed: string): string {
  return sha256('lucky-slots-commitment-v1' + serverSeed);
}

/**
 * Verify that a revealed server seed matches its pre-spin commitment.
 */
export function verifyCommitment(serverSeed: string, serverHash: string): boolean {
  return computeServerHash(serverSeed) === serverHash;
}

/**
 * Generate a cryptographically secure 32-byte hex seed.
 * In Node.js uses crypto.randomBytes; in browser uses crypto.getRandomValues.
 */
export function generateSeed(): string {
  const arr = new Uint8Array(32);
  // globalThis.crypto is available in browsers and Node 20+
  (globalThis as unknown as { crypto: { getRandomValues: (array: Uint8Array) => Uint8Array } }).crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Re-run a spin with stored parameters and compare the resulting grid.
 *
 * The verifier uses strip-based offsets (one RNG call per reel).
 *
 * @returns `true` if the recomputed grid exactly matches the original.
 */
export function verifySpin(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number,
  cols: number,
  originalSymbols: string[][],
  strips: string[][]
): boolean {
  const rng = makeProvablyFairRng(serverSeed, clientSeed, nonce);

  for (let col = 0; col < cols; col++) {
    const strip = strips[col];
    const offset = rng() % strip.length;
    for (let row = 0; row < rows; row++) {
      const idx = (offset + row) % strip.length;
      const recomputed = strip[idx];
      const original = originalSymbols[row]?.[col];
      if (recomputed !== original) {
        return false;
      }
    }
  }
  return true;
}
