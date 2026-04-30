/**
 * @fileoverview SpinEngine.ts
 *
 * Generates the slot machine grid using cryptographically secure randomness.
 *
 * The RNG produces integers in [0, 999) and maps them to symbols via a
 * precomputed cumulative-distribution function (CDF). This is faster and
 * more JIT-friendly than a long if-else chain.
 *
 * After generation, wild symbols are expanded into N replacement grids
 * (one per payline symbol) so the payout engine can test each possibility.
 */

import { Symbol, type SpinResult, NUM_ROWS, NUM_REELS } from './types';
import { THRESHOLDS } from './constants';
import { GRID_CONFIG } from './config';

/** Function signature for custom RNGs (useful for deterministic tests). */
export type RngFunction = () => number;

/** Precomputed CDF for O(1) symbol lookup. */
const CDF = [
  { threshold: THRESHOLDS.ten, symbol: Symbol.Ten },
  { threshold: THRESHOLDS.jack, symbol: Symbol.Jack },
  { threshold: THRESHOLDS.queen, symbol: Symbol.Queen },
  { threshold: THRESHOLDS.king, symbol: Symbol.King },
  { threshold: THRESHOLDS.ace, symbol: Symbol.Ace },
  { threshold: THRESHOLDS.wild, symbol: Symbol.Wild },
  { threshold: THRESHOLDS.bonus, symbol: Symbol.Bonus },
];

/** Default RNG: uses crypto.getRandomValues when available, falls back to Math.random. */
function defaultRng(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % 999;
  }
  return Math.floor(Math.random() * 999);
}

/** Map a single RNG value [0, 999) to a {@link Symbol} using the CDF. */
function rngToSymbol(rng: number): Symbol {
  for (const entry of CDF) {
    if (rng < entry.threshold) return entry.symbol;
  }
  return Symbol.Bonus;
}

export class SpinEngine {
  private rng: RngFunction;

  constructor(rng: RngFunction = defaultRng) {
    this.rng = rng;
  }

  /**
   * Generate a fresh N×M grid.
   *
   * @returns 2D array where result[row][col] is the symbol at that cell.
   */
  generateRoll(): Symbol[][] {
    const symbols: Symbol[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      symbols[row] = [];
      for (let col = 0; col < NUM_REELS; col++) {
        symbols[row][col] = rngToSymbol(this.rng());
      }
    }
    return symbols;
  }

  /**
   * Expand wild symbols into N separate grids.
   *
   * For each payline symbol (Ten→Ace), creates a copy of the grid where
   * every {@link Symbol.Wild} is replaced by that symbol. This lets the
   * payout engine test each substitution independently.
   *
   * @param symbols - Original grid (may contain Wilds)
   * @returns Array of {@link GRID_CONFIG.paylineSymbols} grids
   */
  replaceWilds(symbols: Symbol[][]): Symbol[][][] {
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

  /**
   * Full spin: generate grid + wild replacements.
   */
  spin(): SpinResult {
    const symbols = this.generateRoll();
    const wildReplacements = this.replaceWilds(symbols);
    return { symbols, wildReplacements };
  }
}
