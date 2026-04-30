import { describe, it, expect } from 'vitest';
import { PayoutEngine } from '../src/PayoutEngine';
import { PaylineEngine } from '../src/PaylineEngine';
import { Symbol, NUM_ROWS, NUM_REELS } from '../src/types';
import { GRID_CONFIG } from '../src/config';
import { getMultiplier } from '../src/constants';

describe('PayoutEngine', () => {
  const paylineEngine = new PaylineEngine();
  const payoutEngine = new PayoutEngine(paylineEngine);

  it('returns zero payout for no matches', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Bonus)
    );
    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);
    expect(result.winnings).toBe(0);
    expect(result.multiplier).toBe(0);
    expect(result.winningPaths).toHaveLength(0);
  });

  it('calculates a simple row match', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Bonus)
    );
    for (let col = 0; col < NUM_REELS; col++) {
      grid[0][col] = Symbol.Ten;
    }

    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    const tenPaths = result.winningPaths.filter(
      (p) => p.size === NUM_REELS && p.symbol === Symbol.Ten
    );
    expect(tenPaths.length).toBeGreaterThan(0);
    const expected = getMultiplier(NUM_REELS, 'Ten') * tenPaths.length;
    expect(result.multiplier).toBe(expected);
  });

  it('calculates dirty path filtering correctly', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Ace)
    );
    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    // Paths smaller than minMatch should never appear
    for (let size = 1; size < GRID_CONFIG.minMatch; size++) {
      const paths = result.winningPaths.filter(
        (p) => p.size === size && p.symbol === Symbol.Ace
      );
      expect(paths.length).toBe(0);
    }

    // In a fully-connected grid of Aces, any path smaller than NUM_REELS
    // is a subset of a maximal path and should be filtered out.
    for (let size = GRID_CONFIG.minMatch; size < NUM_REELS; size++) {
      const paths = result.winningPaths.filter(
        (p) => p.size === size && p.symbol === Symbol.Ace
      );
      expect(paths.length).toBe(0);
    }

    // Max-size paths should survive dirty-path filtering
    const maxPaths = result.winningPaths.filter(
      (p) => p.size === NUM_REELS && p.symbol === Symbol.Ace
    );
    expect(maxPaths.length).toBeGreaterThan(0);
  });

  it('uses correct multipliers', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Ace)
    );
    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 2.0);

    const acePaths = result.winningPaths.filter((p) => p.size === NUM_REELS && p.symbol === Symbol.Ace);
    const expected = getMultiplier(NUM_REELS, 'Ace') * acePaths.length;
    expect(result.multiplier).toBeCloseTo(expected, 10);
    expect(result.winnings).toBeCloseTo(result.multiplier * 2.0, 10);
  });

  it('calculates bet * multiplier correctly', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Queen)
    );
    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 10.0);

    const queenPaths = result.winningPaths.filter((p) => p.size === NUM_REELS && p.symbol === Symbol.Queen);
    const expected = getMultiplier(NUM_REELS, 'Queen') * queenPaths.length;
    expect(result.multiplier).toBeCloseTo(expected, 10);
    expect(result.winnings).toBeCloseTo(expected * 10.0, 10);
  });

  it('wilds greedily match the highest symbol first', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Bonus)
    );
    for (let col = 0; col < NUM_REELS; col++) {
      grid[0][col] = Symbol.Ace;
      grid[1][col] = Symbol.Ten;
    }
    grid[0][2] = Symbol.Wild;
    grid[1][2] = Symbol.Wild;

    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    const acePaths = result.winningPaths.filter((p) => p.symbol === Symbol.Ace);
    const tenPaths = result.winningPaths.filter((p) => p.symbol === Symbol.Ten);

    expect(acePaths.some((p) => p.size === NUM_REELS)).toBe(true);

    const sharedWildPaths = tenPaths.filter((p) =>
      p.coordinates.some((c) => c.row === 0 && c.col === 2)
    );
    expect(sharedWildPaths.length).toBe(0);
  });

  it('wilds can still match lower symbols if not used by higher', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, () =>
      Array(NUM_REELS).fill(Symbol.Bonus)
    );
    for (let col = 0; col < NUM_REELS; col++) {
      grid[0][col] = Symbol.Ten;
    }
    grid[0][2] = Symbol.Wild;

    const wildReplacements = replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    const tenPaths = result.winningPaths.filter((p) => p.symbol === Symbol.Ten);
    expect(tenPaths.some((p) => p.size === NUM_REELS)).toBe(true);
  });
});

function replaceWilds(symbols: Symbol[][]): Symbol[][][] {
  const replacements: Symbol[][][] = [];
  for (let i = 0; i < GRID_CONFIG.paylineSymbols; i++) {
    const grid: Symbol[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < NUM_REELS; col++) {
        if (symbols[row][col] === Symbol.Wild) {
          grid[row][col] = i as Symbol;
        } else {
          grid[row][col] = symbols[row][col];
        }
      }
    }
    replacements.push(grid);
  }
  return replacements;
}
