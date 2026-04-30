import { describe, it, expect } from 'vitest';
import { PayoutEngine } from '../src/PayoutEngine';
import { PaylineEngine } from '../src/PaylineEngine';
import { Symbol } from '../src/types';

describe('PayoutEngine', () => {
  const paylineEngine = new PaylineEngine();
  const payoutEngine = new PayoutEngine(paylineEngine);

  it('returns zero payout for no matches', () => {
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Bonus));
    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);
    expect(result.winnings).toBe(0);
    expect(result.multiplier).toBe(0);
    expect(result.winningPaths).toHaveLength(0);
  });

  it('calculates a simple Ten match', () => {
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Bonus));
    for (let col = 0; col < 5; col++) {
      grid[0][col] = Symbol.Ten;
    }

    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    const fiveTens = result.winningPaths.filter((p) => p.size === 5 && p.symbol === Symbol.Ten);
    expect(fiveTens.length).toBeGreaterThan(0);
    expect(result.multiplier).toBeGreaterThanOrEqual(5);
  });

  it('calculates dirty path filtering correctly', () => {
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Ace));
    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    const size4Aces = result.winningPaths.filter((p) => p.size === 4 && p.symbol === Symbol.Ace);
    const size3Aces = result.winningPaths.filter((p) => p.size === 3 && p.symbol === Symbol.Ace);
    expect(size4Aces.length).toBe(0);
    expect(size3Aces.length).toBe(0);
  });

  it('uses correct multipliers', () => {
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Ace));
    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 2.0);

    const total5AceMultiplier = 56 * result.winningPaths.filter((p) => p.size === 5 && p.symbol === Symbol.Ace).length;
    expect(result.multiplier).toBe(total5AceMultiplier);
    expect(result.winnings).toBe(result.multiplier * 2.0);
  });

  it('calculates bet * multiplier correctly', () => {
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Queen));
    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 10.0);

    const expectedMultiplier = 20 * result.winningPaths.filter((p) => p.size === 5 && p.symbol === Symbol.Queen).length;
    expect(result.multiplier).toBe(expectedMultiplier);
    expect(result.winnings).toBe(expectedMultiplier * 10.0);
  });

  it('wilds greedily match the highest symbol first', () => {
    // A grid with wilds that could match as Ace OR Ten
    // Row 0: [Ace, Ace, Wild, Ace, Ace] — can form 5-Ace
    // Row 1: [Ten, Ten, Wild, Ten, Ten] — can form 5-Ten (but wild is already spent by Ace)
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Bonus));
    for (let col = 0; col < 5; col++) {
      grid[0][col] = Symbol.Ace;
      grid[1][col] = Symbol.Ten;
    }
    grid[0][2] = Symbol.Wild;
    grid[1][2] = Symbol.Wild;

    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    // Should find Ace matches but NOT Ten matches for the shared wild
    const acePaths = result.winningPaths.filter((p) => p.symbol === Symbol.Ace);
    const tenPaths = result.winningPaths.filter((p) => p.symbol === Symbol.Ten);

    // There should be Ace 5-of-a-kind paths
    expect(acePaths.some((p) => p.size === 5)).toBe(true);

    // The Ten 5-of-a-kind path that shares the wild at (0,2) should be excluded
    // because the wild was spent on the Ace match
    // (The actual number of Ten paths depends on the payline graph, but the
    //  specific path using the shared wild should not be there)
    const sharedWildPaths = tenPaths.filter((p) =>
      p.coordinates.some((c) => c.row === 0 && c.col === 2)
    );
    expect(sharedWildPaths.length).toBe(0);
  });

  it('wilds can still match lower symbols if not used by higher', () => {
    // Grid where wild is only useful for Ten, not Ace
    const grid: Symbol[][] = Array.from({ length: 4 }, () => Array(5).fill(Symbol.Bonus));
    for (let col = 0; col < 5; col++) {
      grid[0][col] = Symbol.Ten;
    }
    grid[0][2] = Symbol.Wild;

    const wildReplacements = new SpinEngineLike().replaceWilds(grid);
    const result = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);

    const tenPaths = result.winningPaths.filter((p) => p.symbol === Symbol.Ten);
    expect(tenPaths.some((p) => p.size === 5)).toBe(true);
  });
});

class SpinEngineLike {
  replaceWilds(symbols: Symbol[][]): Symbol[][][] {
    const replacements: Symbol[][][] = [];
    for (let i = 0; i < 5; i++) {
      const grid: Symbol[][] = [];
      for (let row = 0; row < 4; row++) {
        grid[row] = [];
        for (let col = 0; col < 5; col++) {
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
}
