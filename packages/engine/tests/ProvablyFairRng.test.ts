import { describe, it, expect } from 'vitest';
import {
  provablyFairRng,
  makeProvablyFairRng,
  computeServerHash,
  verifyCommitment,
  generateSeed,
  verifySpin,
} from '../src/ProvablyFairRng';

const TEST_STRIPS = [
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
];

describe('ProvablyFairRng', () => {
  describe('provablyFairRng', () => {
    it('returns a deterministic value for the same inputs', () => {
      const a = provablyFairRng('seed1', 'seed2', 0, 0);
      const b = provablyFairRng('seed1', 'seed2', 0, 0);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
    });

    it('returns different values for different counters', () => {
      const values = new Set<number>();
      for (let i = 0; i < 20; i++) {
        values.add(provablyFairRng('seed1', 'seed2', 0, i));
      }
      expect(values.size).toBeGreaterThan(1);
    });

    it('returns different values for different nonces', () => {
      const a = provablyFairRng('seed1', 'seed2', 0, 0);
      const b = provablyFairRng('seed1', 'seed2', 1, 0);
      expect(a).not.toBe(b);
    });

    it('returns different values for different server seeds', () => {
      const a = provablyFairRng('seedA', 'seed2', 0, 0);
      const b = provablyFairRng('seedB', 'seed2', 0, 0);
      expect(a).not.toBe(b);
    });

    it('always returns a non-negative value', () => {
      for (let i = 0; i < 100; i++) {
        const val = provablyFairRng('s', 'c', i, i * 2);
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('makeProvablyFairRng', () => {
    it('produces a sequence of values with an internal counter', () => {
      const rng = makeProvablyFairRng('server', 'client', 5);
      const values = [rng(), rng(), rng(), rng()];
      expect(values[0]).not.toBe(values[1]);
      expect(values[1]).not.toBe(values[2]);

      // Re-create with same params and assert the sequence matches
      const rng2 = makeProvablyFairRng('server', 'client', 5);
      expect(rng2()).toBe(values[0]);
      expect(rng2()).toBe(values[1]);
      expect(rng2()).toBe(values[2]);
      expect(rng2()).toBe(values[3]);
    });
  });

  describe('computeServerHash / verifyCommitment', () => {
    it('computes a stable hash for a given seed', () => {
      const h1 = computeServerHash('my-secret-seed');
      const h2 = computeServerHash('my-secret-seed');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different seeds', () => {
      const h1 = computeServerHash('seed-a');
      const h2 = computeServerHash('seed-b');
      expect(h1).not.toBe(h2);
    });

    it('verifies a correct commitment', () => {
      const seed = 'test-seed-123';
      const hash = computeServerHash(seed);
      expect(verifyCommitment(seed, hash)).toBe(true);
    });

    it('rejects an incorrect commitment', () => {
      expect(verifyCommitment('seed-a', computeServerHash('seed-b'))).toBe(false);
    });
  });

  describe('generateSeed', () => {
    it('returns a 64-character hex string', () => {
      const seed = generateSeed();
      expect(seed).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns unique seeds across calls', () => {
      const seeds = new Set<string>();
      for (let i = 0; i < 20; i++) {
        seeds.add(generateSeed());
      }
      expect(seeds.size).toBe(20);
    });
  });

  describe('verifySpin', () => {
    it('returns true for a grid that matches the strip offsets', () => {
      const serverSeed = 'abc123';
      const clientSeed = 'def456';
      const nonce = 7;
      const rows = 3;
      const cols = 3;

      const rng = makeProvablyFairRng(serverSeed, clientSeed, nonce);
      const grid: string[][] = [];
      for (let c = 0; c < cols; c++) {
        const strip = TEST_STRIPS[c];
        const offset = rng() % strip.length;
        for (let r = 0; r < rows; r++) {
          if (!grid[r]) grid[r] = [];
          const idx = (offset + r) % strip.length;
          grid[r][c] = strip[idx];
        }
      }

      expect(verifySpin(serverSeed, clientSeed, nonce, rows, cols, grid, TEST_STRIPS)).toBe(true);
    });

    it('returns false when the grid does not match', () => {
      const grid = [
        ['TEN', 'TEN', 'TEN'],
        ['TEN', 'TEN', 'TEN'],
        ['TEN', 'TEN', 'TEN'],
      ];
      expect(verifySpin('s', 'c', 0, 3, 3, grid, TEST_STRIPS)).toBe(false);
    });

    it('returns false when a single cell is wrong', () => {
      const serverSeed = 'abc123';
      const clientSeed = 'def456';
      const nonce = 0;
      const rows = 2;
      const cols = 2;

      const rng = makeProvablyFairRng(serverSeed, clientSeed, nonce);
      const grid: string[][] = [];
      for (let c = 0; c < cols; c++) {
        const strip = TEST_STRIPS[c];
        const offset = rng() % strip.length;
        for (let r = 0; r < rows; r++) {
          if (!grid[r]) grid[r] = [];
          const idx = (offset + r) % strip.length;
          grid[r][c] = strip[idx];
        }
      }

      // Mutate one cell
      grid[0][0] = grid[0][0] === 'TEN' ? 'JACK' : 'TEN';
      expect(verifySpin(serverSeed, clientSeed, nonce, rows, cols, grid, TEST_STRIPS)).toBe(false);
    });
  });
});
